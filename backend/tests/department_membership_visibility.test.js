process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 'user-uuid-123';
const DEPARTMENT_ID = 'dept-uuid-789';
const CHAT_ID = 'chat-uuid-456';
const USER_EMAIL = 'user@example.com';

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

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
    if (server) {
        server.close(done);
    } else {
        done();
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Department membership visibility', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const regularUser = {
            id: USER_ID,
            name: 'user',
            email: USER_EMAIL,
            hashed_password: 'user_hash',
            role: 'user',
            department_id: DEPARTMENT_ID
        };

        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: USER_EMAIL, password: 'password' })
            .expect(200);
    });

    test('GET /api/departments returns departments assigned through users.department_id', async () => {
        mockQuery.mockImplementation(async (queryText, params) => {
            if (queryText.includes('FROM departments d') && queryText.includes('JOIN users u')) {
                expect(params).toEqual([USER_ID]);
                return {
                    rows: [{ id: DEPARTMENT_ID, name: 'HR', user_id: null }]
                };
            }

            return { rows: [] };
        });

        const response = await agent
            .get('/api/departments')
            .set('CSRF-Token', csrfToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: DEPARTMENT_ID, name: 'HR', user_id: null }]);
    });

    test('GET /api/chats allows access when user belongs to the department via users.department_id', async () => {
        mockQuery.mockImplementation(async (queryText, params) => {
            if (queryText.includes('FROM departments d') && queryText.includes('JOIN users u')) {
                expect(params).toEqual([DEPARTMENT_ID, USER_ID]);
                return { rows: [{ id: DEPARTMENT_ID }] };
            }

            if (queryText.includes('FROM chats c') && queryText.includes('WHERE c.department_id = $1')) {
                expect(params).toEqual([DEPARTMENT_ID]);
                return {
                    rows: [{ id: CHAT_ID, name: 'Onboarding Chat', status: 'draft' }]
                };
            }

            return { rows: [] };
        });

        const response = await agent
            .get(`/api/chats?department_id=${DEPARTMENT_ID}`)
            .set('CSRF-Token', csrfToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: CHAT_ID, name: 'Onboarding Chat', status: 'draft' }]);
    });
});
