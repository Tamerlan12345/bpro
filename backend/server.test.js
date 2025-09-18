const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');

// Mock external dependencies
jest.mock('bcryptjs');

// A flexible mock for the Supabase client
const mockSupabase = {
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    single: jest.fn(),
};

// Default implementations that return `this` to allow chaining
mockSupabase.from.mockReturnThis();
mockSupabase.select.mockReturnThis();
mockSupabase.insert.mockReturnThis();
mockSupabase.eq.mockReturnThis();
mockSupabase.in.mockReturnThis();
mockSupabase.single.mockReturnThis();


jest.mock('@supabase/supabase-js', () => ({
    createClient: () => mockSupabase,
}));

// Import the app *after* mocks are set up
const { app, server } = require('./server');

describe('API Security and Authorization', () => {
    // Close the server after all tests to prevent Jest from hanging
    afterAll((done) => {
        server.close(done);
    });

    // Clear all mocks before each test to ensure isolation
    beforeEach(() => {
        jest.clearAllMocks();
        // Restore default chaining behavior for mocks
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.insert.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
    });

    describe('Admin-only routes', () => {
        const adminRoute = '/api/departments';
        const payload = { name: 'New Test Dept', password: 'password123' };

        it('should return 401 Unauthorized if the user is not logged in', async () => {
            const response = await request(app).post(adminRoute).send(payload);
            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Unauthorized');
        });

        it('should return 403 Forbidden if the user is logged in but not an admin', async () => {
            const agent = request.agent(app); // Agent to persist session cookie
            const userDept = { id: 2, name: 'user_dept', hashed_password: 'user_hash' };

            // Mock the login process for a non-admin user
            when(bcrypt.compare).calledWith('password', userDept.hashed_password).mockResolvedValue(true);
            mockSupabase.eq.mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: userDept, error: null })
            });

            // Log in as the non-admin user
            await agent
                .post('/api/auth/department')
                .send({ name: 'user_dept', password: 'password' })
                .expect(200);

            // Attempt to access the admin route
            const response = await agent.post(adminRoute).send(payload);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Forbidden');
        });

        it('should return 201 Created if the user is an admin', async () => {
            const agent = request.agent(app);
            const adminDept = { id: 1, name: 'admin', hashed_password: 'admin_hash' };
            const newDept = { id: 99, ...payload };

            // Mock the admin login process
            when(bcrypt.compare).calledWith('adminpass', adminDept.hashed_password).mockResolvedValue(true);
            mockSupabase.eq.mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: adminDept, error: null })
            });

            // Log in as admin
            await agent
                .post('/api/auth/department')
                .send({ name: 'admin', password: 'adminpass' })
                .expect(200);

            // Mock the department creation database call
            when(bcrypt.hash).mockResolvedValue('new_hashed_password');
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'departments') {
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockResolvedValue({ data: [newDept], error: null }),
                    };
                }
                return mockSupabase; // default mock
            });

            // Access the admin route
            const response = await agent.post(adminRoute).send(payload);
            expect(response.status).toBe(201);
            expect(response.body[0].name).toBe(newDept.name);
        });
    });
});
