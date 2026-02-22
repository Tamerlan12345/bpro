const request = require('supertest');
const express = require('express');
const signature = require('cookie-signature');

// Mock specific implementation details
const mockGet = jest.fn((sid, cb) => cb(null, {}));

// Mock connect-pg-simple
jest.mock('connect-pg-simple', () => {
    return (session) => {
        return class MockPgStore extends session.Store {
            constructor(options) {
                super(options);
            }
            get(sid, cb) {
                mockGet(sid, cb);
            }
            set(sid, session, cb) { cb(null); }
            destroy(sid, cb) { cb(null); }
            touch(sid, session, cb) { cb(null); }
        };
    };
});

// Mock pg
jest.mock('pg', () => {
    return {
        Pool: jest.fn(() => ({
            query: jest.fn(),
            connect: jest.fn(),
            on: jest.fn()
        })),
    };
});

describe('Static File Performance', () => {
    let app;
    const originalEnv = process.env;

    beforeAll(() => {
        process.env = { ...originalEnv };
        process.env.NODE_ENV = 'development';
        process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
        process.env.SESSION_SECRET = 'secret';
        process.env.FRONTEND_URL = 'http://localhost:3000';

        jest.isolateModules(() => {
            const server = require('../server');
            app = server.app;
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('Static file request DOES NOT trigger session DB lookup for authenticated users', async () => {
        // Create a signed cookie
        // express-session defaults: name='connect.sid', secret='secret' (from env)
        // prefix 's:' is added by express-session for signed cookies
        const sessionID = 'test-session-id';
        const secret = 'secret';
        const signed = 's:' + signature.sign(sessionID, secret);

        await request(app)
            .get('/style.css')
            .set('Cookie', [`connect.sid=${signed}`]);

        // This confirms the optimization: session store is NOT accessed for static file
        expect(mockGet).not.toHaveBeenCalled();
    });
});
