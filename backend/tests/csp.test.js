process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { app, startServer } = require('../server');

// Mocks
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock console.log/error to keep test output clean
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

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

describe('Content Security Policy', () => {
    it('should have a secure CSP header', async () => {
        const response = await request(app).get('/health');
        expect(response.headers['content-security-policy']).toBeDefined();

        const csp = response.headers['content-security-policy'];
        // console.log('Current CSP:', csp);

        // Check script-src
        const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src'));
        expect(scriptSrc).toBeDefined();

        // Verify that script-src does NOT contain 'unsafe-inline'
        expect(scriptSrc).not.toContain("'unsafe-inline'");
    });
});
