process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 'user-uuid-123';
const CHAT_ID = 'chat-uuid-456';

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
    // Mock user creation/existence checks in startServer
    when(mockQuery).calledWith(expect.stringMatching(/SELECT id FROM users WHERE name =/)).mockResolvedValue({ rows: [{ id: USER_ID }] });
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

describe('POST /api/chats/:id/versions', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);
    });

    it('should create a new version for an authenticated user', async () => {
        const payload = {
            process_text: 'Test process text',
            mermaid_code: 'graph TD; A-->B;'
        };
        const mockVersion = {
            id: 'version-uuid-789',
            chat_id: CHAT_ID,
            ...payload,
            created_at: new Date().toISOString()
        };

        // Mock ownership check
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        mockQuery.mockResolvedValueOnce({ rows: [mockVersion] });

        const response = await agent
            .post(`/api/chats/${CHAT_ID}/versions`)
            .set('CSRF-Token', csrfToken)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockVersion);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO process_versions/),
            [CHAT_ID, payload.process_text, payload.mermaid_code]
        );
    });

    it('should return 401 Unauthorized if not logged in', async () => {
        const unauthAgent = request.agent(app);
        const token = await getCsrfToken(unauthAgent);

        const response = await unauthAgent
            .post(`/api/chats/${CHAT_ID}/versions`)
            .set('CSRF-Token', token)
            .send({ process_text: 'test' });

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 500 if database error occurs', async () => {
        // Mock ownership check to succeed
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        mockQuery.mockRejectedValueOnce(new Error('Database error'));

        const response = await agent
            .post(`/api/chats/${CHAT_ID}/versions`)
            .set('CSRF-Token', csrfToken)
            .send({ process_text: 'test' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Database error');
    });
});
