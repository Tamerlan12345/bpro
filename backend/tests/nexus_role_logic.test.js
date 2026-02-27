
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_secret';
process.env.DATABASE_URL = 'postgres://dummy:dummy@localhost:5432/dummy';
process.env.SPEECHMATICS_API_KEY = 'dummy';
process.env.GOOGLE_API_KEY = 'dummy';
process.env.FRONTEND_URL = 'http://localhost:3000';

const request = require('supertest');
const bcrypt = require('bcryptjs');

// 1. Mock 'pg' BEFORE requiring server.js
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

mockConnect.mockResolvedValue({
    release: mockRelease
});

// Default behavior: return empty rows
mockQuery.mockResolvedValue({ rows: [] });

jest.mock('pg', () => {
    return {
        Pool: jest.fn(() => ({
            query: mockQuery,
            connect: mockConnect,
            on: jest.fn(),
            end: jest.fn(),
        })),
    };
});

// 2. Mock 'csurf' to bypass CSRF protection for tests
jest.mock('csurf', () => () => (req, res, next) => {
    req.csrfToken = () => 'mock_token';
    next();
});

// 3. Now require the app
const { app } = require('../server');

describe('Nexus Role Logic - Authentication Check', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default query behavior
        mockQuery.mockResolvedValue({ rows: [] });
    });

    test('Fix Verification: Role is derived from DB', async () => {
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Define behavior for the login query
        mockQuery.mockImplementation(async (text, params) => {
            // Updated query should include 'role'
            if (text && text.includes('SELECT id, name, hashed_password, role FROM users WHERE name = $1')) {
                const username = params[0];

                if (username === 'admin_test') {
                    return {
                        rows: [{
                            id: 'uuid-1',
                            name: 'admin_test',
                            hashed_password: hashedPassword,
                            role: 'admin'
                        }]
                    };
                } else if (username === 'admin') {
                    // Scenario: 'admin' user is downgraded in DB
                    return {
                        rows: [{
                            id: 'uuid-2',
                            name: 'admin',
                            hashed_password: hashedPassword,
                            role: 'user'
                        }]
                    };
                }
            }
            // Default
            return { rows: [] };
        });

        // Test 1: Login as 'admin_test'
        // Should now be 'admin' because DB says so, and we removed the hardcoded override
        const resTestAdmin = await request(app)
            .post('/api/auth/login')
            .send({ name: 'admin_test', password: password });

        expect(resTestAdmin.status).toBe(200);
        expect(resTestAdmin.body.role).toBe('admin');


        // Test 2: Login as 'admin'
        // Should now be 'user' because DB says so, and we removed the hardcoded override
        const resAdmin = await request(app)
            .post('/api/auth/login')
            .send({ name: 'admin', password: password });

        expect(resAdmin.status).toBe(200);
        expect(resAdmin.body.role).toBe('user');
    });
});
