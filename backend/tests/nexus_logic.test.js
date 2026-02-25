process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const ADMIN_ID = 1;

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
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'admin'").mockResolvedValue({ rows: [{ id: ADMIN_ID }] });
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

describe('Nexus Logic Fixes: Foreign Key Handling', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const adminUser = { id: ADMIN_ID, name: 'admin', hashed_password: 'admin_hash', role: 'admin' };
        when(bcrypt.compare).calledWith('adminpass', adminUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'admin', password: 'adminpass' })
            .expect(200);
    });

    it('POST /api/departments should return 400 when user_id does not exist (FK violation)', async () => {
        const payload = { name: 'New Dept', password: 'pass', user_id: '550e8400-e29b-41d4-a716-446655440000' };

        // Mock the FK error
        const error = new Error('Foreign key violation');
        error.code = '23503';
        when(mockQuery).calledWith(expect.stringMatching(/INSERT INTO departments/), expect.anything()).mockRejectedValue(error);
        when(bcrypt.hash).mockResolvedValue('hash');

        const response = await agent
            .post('/api/departments')
            .set('CSRF-Token', csrfToken)
            .send(payload);

        // Expect 400 now (Green state)
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('User not found');
    });

    it('POST /api/chats should return 400 when department_id does not exist (FK violation)', async () => {
        const payload = { department_id: '550e8400-e29b-41d4-a716-446655440000', name: 'New Chat', password: 'pass' };

        // Mock the FK error from RPC
        const error = new Error('Foreign key violation');
        error.code = '23503';
        when(mockQuery).calledWith(expect.stringMatching(/SELECT \* FROM create_chat_with_status/), expect.anything()).mockRejectedValue(error);
        when(bcrypt.hash).mockResolvedValue('hash');

        const response = await agent
            .post('/api/chats')
            .set('CSRF-Token', csrfToken)
            .send(payload);

        // Expect 400 now (Green state)
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Department not found');
    });
});
