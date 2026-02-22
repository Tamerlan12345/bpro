process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { app, startServer } = require('../server');

// Mock Dependencies
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
  return { Pool: jest.fn(() => mPool) };
});
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

let server;
let pool; // Access to the mocked pool

beforeAll(async () => {
    const { Pool } = require('pg');
    pool = new Pool(); // Get the mocked pool instance
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

describe('CSRF Protection', () => {
    it('should reject POST request without CSRF token', async () => {
        const agent = request.agent(app);
        const res = await agent.post('/api/auth/login').send({ name: 'admin', password: 'password' });
        expect(res.status).toBe(403);
        // Expect standard CSRF error from our handler or csurf default
        // We added a handler returning { error: 'Invalid or missing CSRF token' }
        expect(res.body.error).toMatch(/CSRF token/i);
    });

    it('should reject POST request with invalid CSRF token', async () => {
        const agent = request.agent(app);
        // Get valid session first (implied by fetching token or any request)
        await agent.get('/api/csrf-token');

        const res = await agent.post('/api/auth/login')
            .set('CSRF-Token', 'invalid-token')
            .send({ name: 'admin', password: 'password' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/CSRF token/i);
    });

    it('should accept POST request with valid CSRF token', async () => {
        const agent = request.agent(app);

        // 1. Get Token
        const tokenRes = await agent.get('/api/csrf-token');
        expect(tokenRes.status).toBe(200);
        const token = tokenRes.body.csrfToken;
        expect(token).toBeDefined();

        // 2. Use Token
        // Mock DB login for success
        // Since we are mocking pg, pool.query is a jest.fn()
        // We need to set its implementation or return value
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 1, name: 'admin', hashed_password: 'hash', role: 'admin' }]
        });

        const bcrypt = require('bcryptjs');
        bcrypt.compare.mockResolvedValueOnce(true);

        const res = await agent.post('/api/auth/login')
            .set('CSRF-Token', token)
            .send({ name: 'admin', password: 'password' });

        // If login successful, it returns 200
        expect(res.status).toBe(200);
    });
});
