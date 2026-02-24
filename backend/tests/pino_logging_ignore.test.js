const request = require('supertest');

// Mock pino-http
// We return a middleware function so express doesn't crash
const mockPinoHttp = jest.fn((options) => (req, res, next) => next());
jest.mock('pino-http', () => mockPinoHttp);

// Mock other dependencies
jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
        on: jest.fn(),
    })),
}));

jest.mock('connect-pg-simple', () => (session) => {
    return class MockStore extends session.Store {
        constructor() { super(); }
        get(sid, cb) { cb(null, {}); }
        set(sid, sess, cb) { cb(null); }
        destroy(sid, cb) { cb(null); }
    };
});

describe('Pino Logging Configuration', () => {
    let ignoreFunction;

    beforeAll(() => {
        jest.isolateModules(() => {
            require('../server');
        });

        // Inspect the calls to pino-http
        // pinoHttp({ logger, autoLogging: { ignore: ... } })
        const calls = mockPinoHttp.mock.calls;
        const configCall = calls.find(args => args[0] && args[0].autoLogging);
        if (configCall) {
            ignoreFunction = configCall[0].autoLogging.ignore;
        }
    });

    test('should have configured autoLogging.ignore', () => {
        // This fails if autoLogging is not configured
        expect(ignoreFunction).toBeDefined();
        expect(typeof ignoreFunction).toBe('function');
    });

    test('ignore function should return true for /health', () => {
        if (!ignoreFunction) throw new Error('ignoreFunction is undefined');
        expect(ignoreFunction({ url: '/health' })).toBe(true);
    });

    test('ignore function should return true for static assets', () => {
        if (!ignoreFunction) throw new Error('ignoreFunction is undefined');
        expect(ignoreFunction({ url: '/style.css' })).toBe(true);
        expect(ignoreFunction({ url: '/script.js' })).toBe(true);
        expect(ignoreFunction({ url: '/image.png' })).toBe(true);
        expect(ignoreFunction({ url: '/favicon.ico' })).toBe(true);
    });

    test('ignore function should return true for static assets with query strings', () => {
        if (!ignoreFunction) throw new Error('ignoreFunction is undefined');
        expect(ignoreFunction({ url: '/style.css?v=1.2' })).toBe(true);
        expect(ignoreFunction({ url: '/script.js?v=2' })).toBe(true);
    });

    test('ignore function should return false for API endpoints', () => {
        if (!ignoreFunction) throw new Error('ignoreFunction is undefined');
        expect(ignoreFunction({ url: '/api/users' })).toBe(false);
        expect(ignoreFunction({ url: '/api/generate' })).toBe(false);
    });
});
