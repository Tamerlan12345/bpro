process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');

// Mock setup
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

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

// Import app after mocks
const { app, startServer } = require('../server');

let server;

beforeAll(async () => {
    // Setup minimal DB mocks for server startup
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'admin'").mockResolvedValue({ rows: [{ id: 'admin-id' }] });
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'user'").mockResolvedValue({ rows: [{ id: 'user-id' }] });

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

describe('New Validation Rules', () => {
    let agent;

    beforeEach(async () => {
        agent = request.agent(app);
        // Mock Login
        const adminUser = { id: 'admin-id', name: 'admin', hashed_password: 'hash', role: 'admin' };
        when(bcrypt.compare).calledWith('password', 'hash').mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] }); // For login query

        await agent
            .post('/api/auth/login')
            .send({ name: 'admin', password: 'password' });
    });

    test('POST /api/generate should fail with empty prompt', async () => {
        const res = await agent
            .post('/api/generate')
            .send({ prompt: '' }); // Empty string

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
    });

    test('POST /api/generate should fail with missing prompt', async () => {
        const res = await agent
            .post('/api/generate')
            .send({});

        expect(res.status).toBe(400);
    });

    test('POST /api/transcribe should fail without file', async () => {
        const res = await agent
            .post('/api/transcribe');

        // Multer might return 400 or Zod?
        // Our code: if (!req.file) return res.status(400).json({ error: 'No audio file uploaded.' });
        // But validation middleware isn't on this route?
        // Wait, I didn't add validateBody to transcribe because it uses Multer and Zod schema is for body?
        // The plan said "Modify /api/transcribe endpoint's finally block".
        // It checks !req.file manually.
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No audio file uploaded.');
    });

    test('POST /api/auth/login should validate body', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ name: '' }); // Missing password, empty name

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
    });

    test('POST /api/chats/:id/versions should validate body', async () => {
        const res = await agent
            .post('/api/chats/123/versions')
            .send({ process_text: '' }); // Empty

        expect(res.status).toBe(400);
    });

    test('POST /api/chats/:id/transcription should validate body', async () => {
        const res = await agent
            .post('/api/chats/123/transcription')
            .send({}); // Missing fields

        expect(res.status).toBe(400);
    });
});
