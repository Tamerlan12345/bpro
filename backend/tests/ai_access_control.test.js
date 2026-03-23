process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = 'dummy-key';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

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

const originalFetch = global.fetch;
global.fetch = jest.fn();

const { app, startServer } = require('../server');
let server;

beforeAll(async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: 'OK' }] } }]
        })
    });
    const serverInstance = await startServer();
    server = serverInstance.server;
});

afterAll((done) => {
    global.fetch = originalFetch;
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
    global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: 'OK' }] } }]
        })
    });
});

describe('AI endpoints access control', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const regularUser = {
            id: 'user-1',
            name: 'user',
            full_name: 'User One',
            role: 'user',
            hashed_password: 'hash'
        };

        when(bcrypt.compare).calledWith('password', 'hash').mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: 'user@example.com', password: 'password' })
            .expect(200);
    });

    test('POST /api/generate returns 403 when chat does not belong to user', async () => {
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT 1 FROM chats c/),
                expect.arrayContaining(['chat-unauthorized', 'user-1'])
            )
            .mockResolvedValue({ rows: [] });

        const response = await agent
            .post('/api/generate')
            .set('CSRF-Token', csrfToken)
            .send({ prompt: 'test prompt', chat_id: 'chat-unauthorized' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });

    test('POST /api/chats/:id/validate returns 403 when chat does not belong to user', async () => {
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT 1 FROM chats c/),
                expect.arrayContaining(['chat-unauthorized', 'user-1'])
            )
            .mockResolvedValue({ rows: [] });

        const response = await agent
            .post('/api/chats/chat-unauthorized/validate')
            .set('CSRF-Token', csrfToken)
            .send({ process_text: 'Some text' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });
});
