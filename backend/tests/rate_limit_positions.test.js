const request = require('supertest');

// Lightweight pg/session mocks so server app can boot in isolation.
jest.mock('connect-pg-simple', () => {
    return (session) => class MockStore extends session.Store {
        get(_sid, cb) { cb(null, {}); }
        set(_sid, _sess, cb) { cb(null); }
        destroy(_sid, cb) { cb(null); }
        touch(_sid, _sess, cb) { cb(null); }
    };
});

jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn()
    }))
}));

describe('rate limit exclusions for position persistence', () => {
    const originalEnv = process.env;

    let app;
    beforeAll(() => {
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            SESSION_SECRET: 'secret',
            FRONTEND_URL: 'http://localhost:3000',
            RATE_LIMIT_MAX: '2',
            RATE_LIMIT_WINDOW_MS: '60000'
        };

        jest.isolateModules(() => {
            ({ app } = require('../server'));
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('position endpoints are not throttled by global limiter', async () => {
        const first = await request(app)
            .put('/api/admin/chats/test-chat/position')
            .send({ x: 10, y: 20 });

        const second = await request(app)
            .put('/api/admin/chats/test-chat/position')
            .send({ x: 11, y: 21 });

        const third = await request(app)
            .put('/api/admin/chats/test-chat/position')
            .send({ x: 12, y: 22 });

        expect(first.status).not.toBe(429);
        expect(second.status).not.toBe(429);
        expect(third.status).not.toBe(429);
    });

    test('non-position endpoints still respect global limiter', async () => {
        const r1 = await request(app).get('/api/csrf-token');
        const r2 = await request(app).get('/api/csrf-token');
        const r3 = await request(app).get('/api/csrf-token');

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r3.status).toBe(429);
    });
});