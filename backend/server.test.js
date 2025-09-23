// Set dummy environment variables before importing the server
process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');

// Mock external dependencies
jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

// Mock DNS lookup
jest.mock('dns', () => ({
    promises: {
        lookup: jest.fn().mockResolvedValue({ address: '127.0.0.1', family: 4 }),
    },
}));

// Mock the 'pg' module
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

// Import the startServer function from the server module
const { app, startServer } = require('./server');
let server; // To be assigned in beforeAll

// --- Test Suite Setup ---

beforeAll(async () => {
    // Mock the queries from ensureUsersExist
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'admin'").mockResolvedValue({ rows: [{ id: 'admin-uuid' }] });
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'user'").mockResolvedValue({ rows: [{ id: 'user-uuid' }] });
    when(mockQuery).calledWith(expect.stringMatching(/INSERT INTO users/)).mockResolvedValue({ rows: [] });

    // Start the server and get the instance
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

// Clear mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});

describe('API Security and Authorization', () => {
    describe('Admin-only routes', () => {
        const adminRoute = '/api/departments';
        const payload = { name: 'New Test Dept', password: 'password123', user_id: 'a-user-uuid' };

        it('should return 401 Unauthorized if the user is not logged in', async () => {
            const response = await request(app).post(adminRoute).send(payload);
            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Unauthorized');
        });

        it('should return 403 Forbidden if the user is logged in but not an admin', async () => {
            const agent = request.agent(app);
            const regularUser = { id: 'a-user-uuid', name: 'user', hashed_password: 'user_hash', role: 'user' };

            when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
            mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

            await agent
                .post('/api/auth/login')
                .send({ name: 'user', password: 'password' })
                .expect(200);

            const response = await agent.post(adminRoute).send(payload);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Forbidden');
        });

        it('should return 201 Created if the user is an admin', async () => {
            const agent = request.agent(app);
            const adminUser = { id: 'admin-uuid', name: 'admin', hashed_password: 'admin_hash', role: 'admin' };
            const newDept = { id: 99, ...payload };

            when(bcrypt.compare).calledWith('adminpass', adminUser.hashed_password).mockResolvedValue(true);
            mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

            await agent
                .post('/api/auth/login')
                .send({ name: 'admin', password: 'adminpass' })
                .expect(200);

            when(bcrypt.hash).mockResolvedValue('new_hashed_password');
            mockQuery.mockResolvedValueOnce({ rows: [newDept] });

            const response = await agent.post(adminRoute).send(payload);
            expect(response.status).toBe(201);
            expect(response.body.name).toBe(newDept.name);
        });
    });
});

describe('GET /api/admin/chats/pending', () => {
    let agent;

    beforeEach(async () => {
        agent = request.agent(app);
        const adminUser = { id: 'admin-uuid', name: 'admin', hashed_password: 'admin_hash', role: 'admin' };

        when(bcrypt.compare).calledWith('adminpass', adminUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

        await agent
            .post('/api/auth/login')
            .send({ name: 'admin', password: 'adminpass' })
            .expect(200);
    });

    it('should return pending chats for an admin user', async () => {
        const mockPendingChats = [
            { chat_id: 101, name: 'Chat 1', status: 'draft', department_name: 'Dept A' },
            { chat_id: 102, name: 'Chat 2', status: 'needs_revision', department_name: 'Dept B' }
        ];
        mockQuery.mockResolvedValueOnce({ rows: mockPendingChats });

        const response = await agent.get('/api/admin/chats/pending');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].chats.name).toBe('Chat 1');
        expect(response.body[0].departments.name).toBe('Dept A');
        expect(response.body[1].status).toBe('needs_revision');
    });
});

describe('/api/generate endpoint', () => {
    it('should return 401 Unauthorized if user is not authenticated', async () => {
        const response = await request(app)
            .post('/api/generate')
            .send({ prompt: 'test prompt' });
        expect(response.status).toBe(401);
    });
});
