process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.SPEECHMATICS_API_KEY = 'dummy-key';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 2;

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

// Mock Speechmatics BatchClient
jest.mock('@speechmatics/batch-client', () => {
    return {
        BatchClient: jest.fn().mockImplementation(() => {
            return {
                transcribe: jest.fn().mockResolvedValue({
                    results: [{ alternatives: [{ content: 'test' }] }]
                }),
            };
        }),
    };
});

const { app, startServer } = require('../server');
let server;

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

describe('Security: File Upload Size Limit', () => {
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

    it('should reject file uploads exceeding the 50MB limit', async () => {
        // Create a buffer larger than 50MB (e.g., 51MB)
        const largeBuffer = Buffer.alloc(51 * 1024 * 1024);

        const response = await agent
            .post('/api/transcribe')
            .set('CSRF-Token', csrfToken)
            .attach('audio', largeBuffer, 'large_audio.mp3');

        // Multer throws an error when limit is exceeded.
        // The global error handler catches it and returns 500 (or the error status if set).
        // By default, Multer errors have a statusCode or we can check the error message.
        expect(response.status).toBe(500);
        // In server.js, the global error handler returns { error: message }
        // For LIMIT_FILE_SIZE, the message is usually "File too large"
        expect(response.body.error).toBeDefined();
    });

    it('should accept file uploads within the 50MB limit', async () => {
        const smallBuffer = Buffer.alloc(1 * 1024 * 1024); // 1MB

        const response = await agent
            .post('/api/transcribe')
            .set('CSRF-Token', csrfToken)
            .attach('audio', smallBuffer, 'small_audio.mp3');

        expect(response.status).toBe(200);
        expect(response.body.transcript).toBeDefined();
    });
});
