const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

// Mocks
jest.mock('bcryptjs', () => ({
    compare: jest.fn((data, encrypted) => {
        if (data === undefined || encrypted === undefined) {
             return Promise.reject(new Error('data and hash arguments required'));
        }
        return Promise.resolve(false);
    }),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const mockQuery = jest.fn((text, params) => {
    if (params && params.some(p => p === undefined)) {
        return Promise.reject(new Error('Bind parameters must not contain undefined'));
    }
    return Promise.resolve({ rows: [] });
});

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

// Avoid pino logs during tests
jest.mock('pino', () => () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));
jest.mock('pino-http', () => () => (req, res, next) => next());

const { app, startServer } = require('../server');
let server;

beforeAll(async () => {
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

describe('POST /api/auth/login Robustness', () => {
    it('should return 400 Bad Request when name is missing', async () => {
        const agent = request.agent(app);
        const token = await getCsrfToken(agent);

        const response = await agent
            .post('/api/auth/login')
            .set('CSRF-Token', token)
            .send({ password: 'password' }); // Missing name

        expect(response.status).toBe(400);
        // We expect validation error details or generic invalid request
    });

    it('should return 400 Bad Request when password is missing', async () => {
        const agent = request.agent(app);
        const token = await getCsrfToken(agent);

        // Mock user lookup returning a user, just in case logic gets that far (it shouldn't with validation)
        const mockUser = { id: 1, name: 'admin', hashed_password: 'hash' };
        mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

        const response = await agent
            .post('/api/auth/login')
            .set('CSRF-Token', token)
            .send({ name: 'admin' }); // Missing password

        expect(response.status).toBe(400);
    });

    it('should return 400 Bad Request when body is empty', async () => {
        const agent = request.agent(app);
        const token = await getCsrfToken(agent);

        const response = await agent
            .post('/api/auth/login')
            .set('CSRF-Token', token)
            .send({});

        expect(response.status).toBe(400);
    });
});
