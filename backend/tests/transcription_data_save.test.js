process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const ADMIN_ID = '1';
const USER_ID = '2';
const CHAT_ID = 'chat-123';

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
    release: jest.fn(),
});
jest.mock('pg', () => {
    const mockPool = {
        query: mockQuery,
        connect: mockConnect,
    };
    return { Pool: jest.fn(() => mockPool) };
});

const { app, startServer } = require('../server');
let server;

beforeAll(async () => {
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'admin'").mockResolvedValue({ rows: [{ id: ADMIN_ID }] });
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'user'").mockResolvedValue({ rows: [{ id: USER_ID }] });
    when(mockQuery).calledWith(expect.stringMatching(/INSERT INTO users/)).mockResolvedValue({ rows: [] });

    const serverInstance = await startServer();
    server = serverInstance.server;
});

afterAll((done) => {
    if (server) {
        server.close(done);
    } else {
        done();
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/chats/:id/transcription', () => {
    it('should handle partial updates without crashing', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);
        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };

        // Authenticate
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);

        // Mock checkChatAccess query
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT 1 FROM chats c/),
                expect.arrayContaining([CHAT_ID, USER_ID])
            )
            .mockResolvedValue({ rows: [{ '?column?': 1 }] });

        // Simulate pg failure if parameters contain undefined
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/INSERT INTO transcription_data/),
                expect.arrayContaining([undefined])
            )
            .mockRejectedValue(new Error('Bind parameters must not contain undefined. To pass null to PostgreSQL, use the null value.'));

        // Mock success if parameters are valid (do not contain undefined)
        // Note: jest-when matches arguments. If we pass params with undefined, the previous rule should catch it.
        // If we pass params with null, this rule should catch it (if we use expect.not.arrayContaining([undefined]))
        // But expect.not.arrayContaining is tricky with jest-when matching.
        // Instead, let's just make the failure rule specific and the success rule generic, hoping failure matches first or specific wins.
        // But failure is specific to containing undefined.

        when(mockQuery)
            .calledWith(
                expect.stringMatching(/INSERT INTO transcription_data/),
                expect.not.arrayContaining([undefined])
            )
            .mockResolvedValue({ rows: [{ id: 'transcription-1', chat_id: CHAT_ID, status: 'completed' }] });

        // Perform request with partial data (only status)
        // This will result in params: [CHAT_ID, undefined, undefined, 'completed']
        // It should trigger the failure mock.
        const response = await agent
            .post(`/api/chats/${CHAT_ID}/transcription`)
            .set('CSRF-Token', csrfToken)
            .send({ status: 'completed' });

        // Expect success (201)
        // If the bug exists, this will fail with 500 because mockQuery rejects.
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('status', 'completed');
    });
});
