const mockQuery = jest.fn();
const mockPool = { query: mockQuery };

// Mock dependencies before requiring server.js to avoid side effects
jest.mock('pg', () => ({
    Pool: jest.fn(() => mockPool)
}));
jest.mock('pino', () => jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
})));
jest.mock('pino-http', () => jest.fn(() => (req, res, next) => next()));
jest.mock('connect-pg-simple', () => () => class MockStore { });
// Mock bcryptjs
jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    genSalt: jest.fn(),
    compare: jest.fn()
}));


const { ensureUsersExist } = require('../server');
const bcrypt = require('bcryptjs');

describe('ensureUsersExist', () => {
    let originalEnv;

    beforeAll(() => {
        originalEnv = { ...process.env };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
    });

    it('should not create users if env vars are missing', async () => {
        delete process.env.ADMIN_INITIAL_PASSWORD;
        delete process.env.USER_INITIAL_PASSWORD;

        // Mock users not existing
        mockQuery.mockResolvedValueOnce({ rows: [] }); // Admin check
        mockQuery.mockResolvedValueOnce({ rows: [] }); // User check

        await ensureUsersExist(mockPool);

        // Verify SELECT calls
        expect(mockQuery).toHaveBeenCalledWith("SELECT id FROM users WHERE name = 'admin'");
        expect(mockQuery).toHaveBeenCalledWith("SELECT id FROM users WHERE name = 'user'");

        // Verify NO INSERT calls
        const insertCalls = mockQuery.mock.calls.filter(call => call[0].includes('INSERT'));
        expect(insertCalls.length).toBe(0);
    });

    it('should create users if env vars are present', async () => {
        process.env.ADMIN_INITIAL_PASSWORD = 'envAdminPassword';
        process.env.USER_INITIAL_PASSWORD = 'envUserPassword';

        // Mock users not existing
        mockQuery.mockResolvedValueOnce({ rows: [] }); // Admin check
        // Mock insert admin
        mockQuery.mockResolvedValueOnce({ rows: [] });

        mockQuery.mockResolvedValueOnce({ rows: [] }); // User check
        // Mock insert user
        mockQuery.mockResolvedValueOnce({ rows: [] });

        // Mock bcrypt hash
        bcrypt.hash.mockResolvedValue('hashed_password');

        await ensureUsersExist(mockPool);

        // Verify INSERT calls
        expect(mockQuery).toHaveBeenCalledWith(
            "INSERT INTO users (name, hashed_password) VALUES ('admin', $1)",
            ['hashed_password']
        );
        expect(mockQuery).toHaveBeenCalledWith(
            "INSERT INTO users (name, hashed_password) VALUES ('user', $1)",
            ['hashed_password']
        );

        expect(bcrypt.hash).toHaveBeenCalledWith('envAdminPassword', 10);
        expect(bcrypt.hash).toHaveBeenCalledWith('envUserPassword', 10);
    });

    it('should not create users if they already exist', async () => {
        process.env.ADMIN_INITIAL_PASSWORD = 'envAdminPassword';
        process.env.USER_INITIAL_PASSWORD = 'envUserPassword';

        // Mock users existing
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Admin found
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // User found

        await ensureUsersExist(mockPool);

        // Verify NO INSERT calls
        const insertCalls = mockQuery.mock.calls.filter(call => call[0].includes('INSERT'));
        expect(insertCalls.length).toBe(0);
    });
});
