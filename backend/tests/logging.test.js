process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.GOOGLE_API_KEY = 'dummy-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const { getCsrfToken } = require('./test_utils');

// Mock pino to capture log calls
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};
jest.mock('pino', () => () => mockLogger);
jest.mock('pino-http', () => () => (req, res, next) => next());

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

// Mock pg
const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({ release: jest.fn() });
jest.mock('pg', () => {
    const mockPool = { query: mockQuery, connect: mockConnect };
    return { Pool: jest.fn(() => mockPool) };
});

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const { app, startServer } = require('../server');
let server;

beforeAll(async () => {
    // Basic setup for server start
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

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Error Logging Tests', () => {
    it('should log error when /api/generate fails', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);

        // Mock user login
        const user = { id: 1, name: 'user', role: 'user', hashed_password: 'hash' };
        mockQuery.mockResolvedValueOnce({ rows: [user] });
        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);

        // Simulate fetch failure
        const error = new Error('Google API Error');
        mockFetch.mockRejectedValue(error);

        // Call the endpoint
        const response = await agent
            .post('/api/generate')
            .set('CSRF-Token', csrfToken)
            .send({ prompt: 'test prompt' });

        // Expect 500 error
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('An internal server error occurred.');

        // Expect logger.error to have been called with the error object
        expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error));
        // We can check if it's the same error object
        // The first argument to logger.error(error) is the error object itself.
        // Or if logged as logger.error(err, msg), check arguments.
        // The proposed fix is just `logger.error(error)`, so first arg should be the error.
    });
});
