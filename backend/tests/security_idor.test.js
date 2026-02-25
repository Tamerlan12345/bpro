process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 'user-uuid-123';
const OTHER_USER_ID = 'other-user-uuid-999';
const CHAT_ID = 'chat-uuid-456';
const DEPARTMENT_ID = 'dept-uuid-789';

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
    // Mock user creation/existence checks in startServer
    when(mockQuery).calledWith(expect.stringMatching(/SELECT id FROM users WHERE name =/)).mockResolvedValue({ rows: [{ id: USER_ID }] });
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

describe('IDOR Vulnerability Check', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);
    });

    test('POST /api/chats/:id/versions should fail with 403 if user does not own the chat', async () => {
        const payload = {
            process_text: 'Malicious update',
            mermaid_code: 'graph TD; A-->B;'
        };

        // Mock the ownership check query (which should be added in the fix) to return EMPTY
        // The query will look something like: SELECT 1 FROM chats c JOIN departments d ... WHERE c.id = $1 AND d.user_id = $2
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT 1 FROM chats c/),
                expect.arrayContaining([CHAT_ID, USER_ID])
            )
            .mockResolvedValue({ rows: [] }); // Simulate "Not Found" or "Not Owned"

        // Mock the INSERT query to succeed (if the check is bypassed)
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/INSERT INTO process_versions/),
                expect.anything()
            )
            .mockResolvedValue({ rows: [{ id: 'version-1', ...payload }] });

        const response = await agent
            .post(`/api/chats/${CHAT_ID}/versions`)
            .set('CSRF-Token', csrfToken)
            .send(payload);

        // Before fix: This will be 201 (Vulnerable)
        // After fix: This should be 403 (Secure)
        if (response.status === 201) {
            console.warn("⚠️  VULNERABILITY DETECTED: IDOR allowed creation of version on unowned chat!");
        }

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });

    test('GET /api/chats/:id/versions should fail with 403 if user does not own the chat', async () => {
        // Mock ownership check to fail
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT 1 FROM chats c/),
                expect.arrayContaining([CHAT_ID, USER_ID])
            )
            .mockResolvedValue({ rows: [] });

        // Mock the SELECT query to succeed (if check bypassed)
        when(mockQuery)
            .calledWith(
                expect.stringMatching(/SELECT \* FROM process_versions/),
                expect.anything()
            )
            .mockResolvedValue({ rows: [] });

        const response = await agent
            .get(`/api/chats/${CHAT_ID}/versions`)
            .set('CSRF-Token', csrfToken);

         if (response.status === 200) {
            console.warn("⚠️  VULNERABILITY DETECTED: IDOR allowed reading versions of unowned chat!");
        }

        expect(response.status).toBe(403);
    });
});
