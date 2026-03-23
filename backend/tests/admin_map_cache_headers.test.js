process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({ release: jest.fn() });
jest.mock('pg', () => {
    const mockPool = {
        query: mockQuery,
        connect: mockConnect,
    };
    return { Pool: jest.fn(() => mockPool) };
});

const { app } = require('../server');

describe('admin map cache headers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/admin/map disables caching', async () => {
        const adminSession = request.agent(app);

        const session = await adminSession
            .get('/api/csrf-token')
            .expect(200);

        const csrfToken = session.body.csrfToken;

        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'admin-1', name: 'Admin', email: 'admin@example.com', hashed_password: 'hash', role: 'admin' }]
        });

        const bcrypt = require('bcryptjs');
        bcrypt.compare.mockResolvedValueOnce(true);

        await adminSession
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: 'admin@example.com', password: 'password' })
            .expect(200);

        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await adminSession.get('/api/admin/map').expect(200);

        expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
        expect(res.headers.pragma).toBe('no-cache');
    });

    test('GET /api/auth/session ignores conditional cache validators', async () => {
        const res = await request(app)
            .get('/api/auth/session')
            .set('If-None-Match', 'W/"stale"')
            .set('If-Modified-Since', new Date().toUTCString())
            .expect(200);

        expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
        expect(res.headers.pragma).toBe('no-cache');
        expect(res.body).toEqual({ user: null });
    });
});
