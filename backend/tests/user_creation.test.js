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

        mockQuery.mockResolvedValueOnce({ rows: [] }); // Admin check

        await ensureUsersExist(mockPool);

        expect(mockQuery).toHaveBeenCalledWith("SELECT id FROM users WHERE role = 'admin' OR name = 'admin' OR email = 'admin@bizpro.ai'");

        const insertCalls = mockQuery.mock.calls.filter(call => call[0].includes('INSERT'));
        expect(insertCalls.length).toBe(0);
    });

    it('should create admin user if env var is present', async () => {
        process.env.ADMIN_INITIAL_PASSWORD = 'envAdminPassword';

        mockQuery.mockResolvedValueOnce({ rows: [] }); // Admin check
        mockQuery.mockResolvedValueOnce({ rows: [] });

        bcrypt.hash.mockResolvedValue('hashed_password');

        await ensureUsersExist(mockPool);

        expect(mockQuery).toHaveBeenCalledWith(
            "INSERT INTO users (name, full_name, email, hashed_password, role) VALUES ('admin', 'Главный Администратор', 'admin@bizpro.ai', $1, 'admin')",
            ['hashed_password']
        );

        expect(bcrypt.hash).toHaveBeenCalledWith('envAdminPassword', 10);
    });

    it('should not create admin user if it already exists', async () => {
        process.env.ADMIN_INITIAL_PASSWORD = 'envAdminPassword';

        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Admin found

        await ensureUsersExist(mockPool);

        const insertCalls = mockQuery.mock.calls.filter(call => call[0].includes('INSERT'));
        expect(insertCalls.length).toBe(0);
    });
});
