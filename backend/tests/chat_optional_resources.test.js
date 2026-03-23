process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = '2';
const CHAT_ID = 'chat-optional-123';
const USER_EMAIL = 'user@example.com';

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
    const serverInstance = await startServer();
    server = serverInstance.server;
});

afterAll((done) => {
    if (server && server.listening) {
        server.close((error) => {
            if (error && error.message !== 'Server is not running.') {
                done(error);
                return;
            }
            done();
        });
    } else {
        done();
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

async function loginUser(agent) {
    const csrfToken = await getCsrfToken(agent);
    const regularUser = { id: USER_ID, name: 'user', email: USER_EMAIL, hashed_password: 'user_hash', role: 'user' };

    when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
    mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

    await agent
        .post('/api/auth/login')
        .set('CSRF-Token', csrfToken)
        .send({ email: USER_EMAIL, password: 'password' })
        .expect(200);
}

function allowChatAccess() {
    when(mockQuery)
        .calledWith(
            expect.stringMatching(/SELECT 1 FROM chats c/),
            expect.arrayContaining([CHAT_ID, USER_ID])
        )
        .mockResolvedValue({ rows: [{ '?column?': 1 }] });
}

describe('optional chat resources', () => {
    test('GET /api/chats/:id/transcription returns 200 with null when transcription is absent', async () => {
        const agent = request.agent(app);
        await loginUser(agent);
        allowChatAccess();

        when(mockQuery)
            .calledWith('SELECT * FROM transcription_data WHERE chat_id = $1', [CHAT_ID])
            .mockResolvedValue({ rows: [] });

        const response = await agent
            .get(`/api/chats/${CHAT_ID}/transcription`)
            .expect(200);

        expect(response.body).toBeNull();
    });

    test('GET /api/chats/:id/initial-process returns 200 with null when initial process is absent', async () => {
        const agent = request.agent(app);
        await loginUser(agent);
        allowChatAccess();

        when(mockQuery)
            .calledWith('SELECT * FROM initial_business_processes WHERE chat_id = $1', [CHAT_ID])
            .mockResolvedValue({ rows: [] });

        const response = await agent
            .get(`/api/chats/${CHAT_ID}/initial-process`)
            .expect(200);

        expect(response.body).toBeNull();
    });
});
