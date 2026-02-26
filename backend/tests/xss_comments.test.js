
process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.SPEECHMATICS_API_KEY = 'dummy-key';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

// Mock dependencies
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

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

const { app, startServer } = require('../server');

describe('Stored XSS in Chat Comments', () => {
    let server;
    let agent;
    let csrfToken;

    beforeAll(async () => {
        // Mock user login and department lookup
        const regularUser = { id: 'uuid-1', name: 'user', hashed_password: 'user_hash', role: 'user' };
        mockQuery.mockResolvedValue({ rows: [regularUser] });
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);

        const serverInstance = await startServer();
        server = serverInstance.server;
    });

    afterAll((done) => {
        if (server) server.close(done);
        else done();
    });

    beforeEach(async () => {
        agent = request.agent(app);

        // Setup login mock
        const regularUser = { id: 'uuid-1', name: 'user', hashed_password: 'user_hash', role: 'user' };
        mockQuery.mockResolvedValue({ rows: [regularUser] });

        csrfToken = await getCsrfToken(agent);

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' });
    });

    it('should sanitize HTML tags in comments to prevent XSS', async () => {
        const xssPayload = '<script>alert("XSS")</script>';
        const expectedSanitized = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';

        // Mock checkChatAccess
        const chatId = 'uuid-chat-1';
        // Need to mock the query for checkChatAccess:
        // SELECT 1 FROM chats c JOIN departments d ...
        // And then the INSERT query.

        mockQuery.mockImplementation((query, values) => {
            if (query.includes('SELECT 1 FROM chats c')) {
                // checkChatAccess success
                return Promise.resolve({ rows: [{ '?column?': 1 }] });
            }
            if (query.includes('INSERT INTO comments')) {
                // Simulate INSERT returning the row
                // We return what was passed in (sanitized or not)
                return Promise.resolve({ rows: [{
                    id: 'uuid-comment-1',
                    chat_id: chatId,
                    author_role: 'user',
                    text: values[2], // The text passed to INSERT
                    created_at: new Date()
                }] });
            }
            if (query.includes('SELECT * FROM comments')) {
                // Not used in this test directly, but good to have
                return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
        });

        const response = await agent
            .post(`/api/chats/${chatId}/comments`)
            .set('CSRF-Token', csrfToken)
            .send({ text: xssPayload });

        expect(response.status).toBe(201);
        expect(response.body.text).toBe(expectedSanitized);
    });
});
