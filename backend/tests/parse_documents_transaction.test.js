process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = 'dummy-key';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

jest.mock('../services/aiParserService', () => ({
    parseDocumentsWithAI: jest.fn()
}));

const { parseDocumentsWithAI } = require('../services/aiParserService');

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

describe('POST /api/admin/parse-documents transaction safety', () => {
    test('rolls back transaction when process insertion fails', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);

        const adminUser = {
            id: 'admin-1',
            name: 'admin',
            full_name: 'Admin',
            role: 'admin',
            hashed_password: 'hash'
        };

        when(bcrypt.compare).calledWith('password', 'hash').mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: 'admin@bizpro.ai', password: 'password' })
            .expect(200);

        parseDocumentsWithAI.mockResolvedValueOnce({
            departments: ['Dept A'],
            processes: [
                { name: 'Process A', owner: 'Owner', department: 'Dept A', description: 'desc', connections: [] }
            ]
        });

        mockQuery.mockImplementation((queryText) => {
            if (typeof queryText !== 'string') return Promise.resolve({ rows: [] });
            if (queryText === 'BEGIN') return Promise.resolve({ rows: [] });
            if (queryText.includes('INSERT INTO departments')) {
                return Promise.resolve({ rows: [{ id: 'dept-1' }] });
            }
            if (queryText.includes('INSERT INTO business_processes')) {
                return Promise.reject(new Error('insert process failed'));
            }
            if (queryText === 'ROLLBACK') return Promise.resolve({ rows: [] });
            return Promise.resolve({ rows: [] });
        });

        const response = await agent
            .post('/api/admin/parse-documents')
            .set('CSRF-Token', csrfToken)
            .attach('documents', Buffer.from('example'), 'sample.txt');

        expect(response.status).toBe(500);
        expect(mockQuery).toHaveBeenCalledWith('BEGIN');
        expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });
});
