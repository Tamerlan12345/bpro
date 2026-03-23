process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');

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

describe('GET /health', () => {
    test('returns 503 when database is disconnected', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
        expect(response.body.database).toBe('disconnected');
    });
});
