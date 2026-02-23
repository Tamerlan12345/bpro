process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');

// Mock pg to prevent connection attempts
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock bcryptjs just in case (though not used for static files)
jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const { app } = require('../server');

describe('Static Asset Caching', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('should set Cache-Control: no-cache for HTML files', async () => {
        const res = await request(app).get('/index.html');
        // HTML files should never be cached to ensure fresh script versions
        expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('should set Cache-Control: public, max-age=86400 for JS files in production', async () => {
        // Simulate production environment
        process.env.NODE_ENV = 'production';

        const res = await request(app).get('/script.js');

        // Should have long cache time
        expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('should NOT set long Cache-Control for JS files in non-production', async () => {
        process.env.NODE_ENV = 'development';

        const res = await request(app).get('/script.js');

        // Should NOT have long cache time (default is usually public, max-age=0)
        expect(res.headers['cache-control']).not.toContain('max-age=86400');
    });
});
