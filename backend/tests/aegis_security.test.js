process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.SPEECHMATICS_API_KEY = 'dummy-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

// Mock external dependencies
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

// Mock Users
const USER_ID = 1;
const CHAT_ID = 'chat-uuid-123';

beforeAll(async () => {
    mockQuery.mockResolvedValue({ rows: [] });
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

describe('🛡️ Aegis Security Audit', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);
        jest.clearAllMocks();
    });

    describe('Rate Limiting (Brute Force Protection)', () => {
        it('should block excessive login attempts', async () => {
            const attempts = 15;
            let blocked = false;

            // Mock successful query (user exists) but failed password (bcrypt returns false)
            mockQuery.mockResolvedValue({ rows: [{ id: USER_ID, name: 'admin', hashed_password: 'hash' }] });
            when(bcrypt.compare).calledWith(expect.any(String), 'hash').mockResolvedValue(false);

            for (let i = 0; i < attempts; i++) {
                const res = await agent
                    .post('/api/auth/login')
                    .set('CSRF-Token', csrfToken)
                    .set('X-Forwarded-For', '10.0.0.1') // Use specific IP for this test
                    .send({ name: 'admin', password: 'wrong' });

                if (res.status === 429) {
                    blocked = true;
                    break;
                }
            }
            expect(blocked).toBe(true);
        });
    });

    describe('Input Validation (Zod Enforcement)', () => {
        beforeEach(async () => {
             // Login first for authenticated routes
             const user = { id: USER_ID, name: 'admin', hashed_password: 'hash', role: 'admin' };
             // Mock login query success
             mockQuery.mockResolvedValueOnce({ rows: [user] });
             when(bcrypt.compare).calledWith('password', 'hash').mockResolvedValue(true);

             await agent
                 .post('/api/auth/login')
                 .set('CSRF-Token', csrfToken)
                 .set('X-Forwarded-For', '10.0.0.2') // Use different IP to avoid rate limit from previous test
                 .send({ name: 'admin', password: 'password' });

             // Mock generic chat access check success (for middleware that checks ownership)
             // We do this by mocking subsequent queries to return something valid if needed.
             // But since validation happens BEFORE db access, the mock might not even be hit if validation works.
             // If validation fails, we get 400. If validation is missing (current state), we hit DB.
             // So we should mock DB to 'succeed' so that if validation is missing, the request returns 200/201/500, not 400.
             mockQuery.mockResolvedValue({ rows: [] });
        });

        it('should reject invalid prompts on /api/generate', async () => {
            // If validation is missing, this might hit the external API or fail differently.
            // We want to ensure it returns 400 immediately.
            const res = await agent
                .post('/api/generate')
                .set('CSRF-Token', csrfToken)
                .send({ prompt: '' }); // Empty prompt

            expect(res.status).toBe(400);
        });

        it('should reject invalid comments on /api/chats/:id/comments', async () => {
             // Validation runs before DB, so no DB mock needed if validation works.
             const res = await agent
                .post(`/api/chats/${CHAT_ID}/comments`)
                .set('CSRF-Token', csrfToken)
                .send({ text: '' }); // Empty text

             expect(res.status).toBe(400);
        });

        it('should reject invalid status updates', async () => {
             // Validation runs before DB.
             const res = await agent
                .put(`/api/chats/${CHAT_ID}/status`)
                .set('CSRF-Token', csrfToken)
                .send({ status: 'INVALID_STATUS' });

             expect(res.status).toBe(400);
        });
    });
});
