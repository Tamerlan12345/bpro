// Set dummy environment variables before importing the server
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');

// Mock external dependencies
jest.mock('bcryptjs');

// Mock the 'pg' module
const mockQuery = jest.fn();
jest.mock('pg', () => {
    const mockPool = {
        query: mockQuery,
    };
    return { Pool: jest.fn(() => mockPool) };
});

// Import the app *after* mocks are set up
const { app, server } = require('./server');

// Close the server after all tests to prevent Jest from hanging
afterAll((done) => {
    server.close(done);
});

// Clear all mocks before each test to ensure isolation
beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockClear();
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

            // Mock the login process for a non-admin user
            when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
            mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

            // Log in as the non-admin user using the new endpoint
            await agent
                .post('/api/auth/login')
                .send({ name: 'user', password: 'password' })
                .expect(200);

            // Attempt to access the admin route
            const response = await agent.post(adminRoute).send(payload);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Forbidden');
        });

        it('should return 201 Created if the user is an admin', async () => {
            const agent = request.agent(app);
            const adminUser = { id: 'admin-uuid', name: 'admin', hashed_password: 'admin_hash', role: 'admin' };
            const newDept = { id: 99, ...payload };

            // Mock the admin login process
            when(bcrypt.compare).calledWith('adminpass', adminUser.hashed_password).mockResolvedValue(true);
            mockQuery.mockResolvedValueOnce({ rows: [adminUser] });


            // Log in as admin
            await agent
                .post('/api/auth/login')
                .send({ name: 'admin', password: 'adminpass' })
                .expect(200);

            // Mock the department creation database call
            when(bcrypt.hash).mockResolvedValue('new_hashed_password');
            mockQuery.mockResolvedValueOnce({ rows: [newDept] });


            // Access the admin route
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

        // Mock the admin login process
        when(bcrypt.compare).calledWith('adminpass', adminUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] });


        // Log in as admin
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

        // Mock the specific DB call for pending chats
        mockQuery.mockResolvedValueOnce({ rows: mockPendingChats });

        const response = await agent.get('/api/admin/chats/pending');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        // Test the transformed API response structure
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
