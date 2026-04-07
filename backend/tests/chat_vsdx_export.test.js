process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const { getCsrfToken } = require('./test_utils');

const USER_ID = 'user-uuid-123';
const CHAT_ID = 'chat-uuid-456';
const USER_EMAIL = 'user@example.com';

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

jest.mock('../services/visioExportService', () => ({
    createVsdxFromBpmnXml: jest.fn().mockResolvedValue(Buffer.from('vsdx-buffer'))
}));

const { createVsdxFromBpmnXml } = require('../services/visioExportService');
const { app, startServer } = require('../server');

let server;

beforeAll(async () => {
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

describe('POST /api/chats/:id/exports/vsdx', () => {
    let agent;
    let csrfToken;

    beforeEach(async () => {
        agent = request.agent(app);
        csrfToken = await getCsrfToken(agent);

        const regularUser = { id: USER_ID, name: 'user', email: USER_EMAIL, hashed_password: 'user_hash', role: 'user' };
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ email: USER_EMAIL, password: 'password' })
            .expect(200);
    });

    test('returns a downloadable vsdx attachment for authorized users', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Проверка договора' }] });

        const response = await agent
            .post(`/api/chats/${CHAT_ID}/exports/vsdx`)
            .set('CSRF-Token', csrfToken)
            .send({ bpmn_xml: '<definitions />' });

        expect(response.status).toBe(200);
        expect(createVsdxFromBpmnXml).toHaveBeenCalledWith('<definitions />');
        expect(response.headers['content-type']).toContain('application/vnd.ms-visio.drawing');
        expect(response.headers['content-disposition']).toContain('.vsdx');
    });

    test('requires authentication', async () => {
        const unauthAgent = request.agent(app);
        const token = await getCsrfToken(unauthAgent);

        const response = await unauthAgent
            .post(`/api/chats/${CHAT_ID}/exports/vsdx`)
            .set('CSRF-Token', token)
            .send({ bpmn_xml: '<definitions />' });

        expect(response.status).toBe(401);
    });
});
