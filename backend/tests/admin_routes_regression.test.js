process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

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

const loginAsAdmin = async (agent) => {
    const csrfToken = await getCsrfToken(agent);
    bcrypt.compare.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({
        rows: [{
            id: 'admin-1',
            name: 'admin',
            full_name: 'Admin',
            email: 'admin@bizpro.ai',
            role: 'admin',
            hashed_password: 'hash'
        }]
    });

    await agent
        .post('/api/auth/login')
        .set('CSRF-Token', csrfToken)
        .send({ email: 'admin@bizpro.ai', password: 'password' })
        .expect(200);

    return csrfToken;
};

beforeAll(async () => {
    const serverInstance = await startServer();
    server = serverInstance.server;
});

afterAll((done) => {
    if (server && server.listening) {
        server.close((error) => {
            if (error && error.message !== 'Server is not running.') {
                done(error);
                return;
            }
            done();
        });
    } else {
        done();
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('admin routes regression coverage', () => {
    test('rejects invalid department position payload before touching the database', async () => {
        const agent = request.agent(app);
        const csrfToken = await loginAsAdmin(agent);

        const response = await agent
            .put('/api/admin/departments/dept-1/position')
            .set('CSRF-Token', csrfToken)
            .send({ x: '10', y: 20 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation Error');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('rejects department position payload with unknown fields', async () => {
        const agent = request.agent(app);
        const csrfToken = await loginAsAdmin(agent);

        const response = await agent
            .put('/api/admin/departments/dept-1/position')
            .set('CSRF-Token', csrfToken)
            .send({ x: 10, y: 20, unexpected: true });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation Error');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid relation payload before insert', async () => {
        const agent = request.agent(app);
        const csrfToken = await loginAsAdmin(agent);

        const response = await agent
            .post('/api/admin/relations')
            .set('CSRF-Token', csrfToken)
            .send({
                source_process_id: 'proc-1',
                target_process_id: 'proc-2',
                relation_type: { unexpected: true }
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation Error');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('returns 404 when deleting a missing process', async () => {
        const agent = request.agent(app);
        const csrfToken = await loginAsAdmin(agent);
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });

        const response = await agent
            .delete('/api/admin/processes/missing-proc')
            .set('CSRF-Token', csrfToken);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Process not found');
    });
});
