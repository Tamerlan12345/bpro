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

const { app } = require('../server');

describe('chat approval migration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('persists latest approved chat version text into business_processes description', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);

        const adminUser = {
            id: 'admin-1',
            name: 'admin',
            full_name: 'Admin',
            role: 'admin',
            hashed_password: 'hash'
        };

        bcrypt.compare.mockResolvedValueOnce(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: 'admin@bizpro.ai', password: 'password' })
            .expect(200);

        mockQuery.mockImplementation((queryText) => {
            if (typeof queryText !== 'string') return Promise.resolve({ rows: [] });
            if (queryText.includes('UPDATE chat_statuses SET status = $1 WHERE chat_id = $2')) {
                return Promise.resolve({ rows: [{ chat_id: 'chat-1', status: 'approved' }] });
            }
            if (queryText.includes('SELECT department_id, name FROM chats WHERE id = $1')) {
                return Promise.resolve({ rows: [{ department_id: 'dept-1', name: 'Payroll Intake' }] });
            }
            if (queryText.includes('SELECT process_text FROM process_versions WHERE chat_id = $1')) {
                return Promise.resolve({ rows: [{ process_text: 'Latest approved process text' }] });
            }
            if (queryText.includes('INSERT INTO business_processes')) {
                return Promise.resolve({ rows: [{ id: 'bp-1' }] });
            }
            return Promise.resolve({ rows: [] });
        });

        const response = await agent
            .put('/api/chats/chat-1/status')
            .set('CSRF-Token', csrfToken)
            .send({ status: 'approved' });

        expect(response.status).toBe(200);

        const insertCall = mockQuery.mock.calls.find(
            ([queryText]) => typeof queryText === 'string' && queryText.includes('INSERT INTO business_processes')
        );

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT process_text FROM process_versions WHERE chat_id = $1'),
            ['chat-1']
        );
        expect(insertCall).toBeDefined();
        expect(insertCall[1]).toEqual(['dept-1', 'chat-1', 'Payroll Intake', 'Latest approved process text']);
    });
});
