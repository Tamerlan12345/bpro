process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 'u1';
const DEPT_ID_USER = 'd1';
const DEPT_ID_OTHER = 'd2';
const CHAT_ID = 'c1';
const CHAT_NAME = 'Secret Chat';
const CHAT_PASSWORD = 'password';

// Mocks
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
    // Basic mocks for startup
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'admin'").mockResolvedValue({ rows: [] });
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'user'").mockResolvedValue({ rows: [] });
    when(mockQuery).calledWith(expect.stringMatching(/INSERT INTO users/)).mockResolvedValue({ rows: [] });

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

describe('POST /api/auth/chat - Department Access Logic', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const user = { id: USER_ID, name: 'user', hashed_password: 'hash', role: 'user' };

        // Mock Login
        when(bcrypt.compare).calledWith('password', 'hash').mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [user] }); // For login query

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);
    });

    it('should allow login if user owns the department', async () => {
        const chat = { id: CHAT_ID, name: CHAT_NAME, hashed_password: 'chat_hash' };

        // Mock Department Check (This will be the first query after we add the fix)
        // Since we haven't added the fix yet, this mock might be unused initially,
        // OR if we add the fix, it will be used.
        // BUT wait, pg mocks are usually strict in order if not using `when`.
        // `when` handles out of order calls based on arguments.

        // Mock Chat Lookup
        when(mockQuery)
            .calledWith(expect.stringMatching(/SELECT id, name, hashed_password FROM chats/), [DEPT_ID_USER, CHAT_NAME])
            .mockResolvedValue({ rows: [chat] });

        // Mock Password Check
        when(bcrypt.compare).calledWith(CHAT_PASSWORD, 'chat_hash').mockResolvedValue(true);

        // Mock Department Access Check (Future Fix)
        when(mockQuery)
            .calledWith(expect.stringMatching(/SELECT 1 FROM departments/), [DEPT_ID_USER, USER_ID])
            .mockResolvedValue({ rows: [{ '?column?': 1 }] });

        const response = await agent
            .post('/api/auth/chat')
            .set('CSRF-Token', csrfToken)
            .send({ department_id: DEPT_ID_USER, name: CHAT_NAME, password: CHAT_PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(CHAT_ID);
    });

    it('should FORBID login if user does NOT own the department', async () => {
        const chat = { id: CHAT_ID, name: CHAT_NAME, hashed_password: 'chat_hash' };

        // Mock Department Access Check (returns empty rows -> Forbidden)
        when(mockQuery)
            .calledWith(expect.stringMatching(/SELECT 1 FROM departments/), [DEPT_ID_OTHER, USER_ID])
            .mockResolvedValue({ rows: [] });

        // Mock Chat Lookup (Should effectively not be reached if we fail early, but mocking just in case)
        when(mockQuery)
            .calledWith(expect.stringMatching(/SELECT id, name, hashed_password FROM chats/), [DEPT_ID_OTHER, CHAT_NAME])
            .mockResolvedValue({ rows: [chat] });

        // Mock Password Check
        when(bcrypt.compare).calledWith(CHAT_PASSWORD, 'chat_hash').mockResolvedValue(true);

        const response = await agent
            .post('/api/auth/chat')
            .set('CSRF-Token', csrfToken)
            .send({ department_id: DEPT_ID_OTHER, name: CHAT_NAME, password: CHAT_PASSWORD });

        // CURRENT BEHAVIOR: 200 (Logic Flaw)
        // EXPECTED BEHAVIOR (After Fix): 403
        expect(response.status).toBe(403);
    });
});
