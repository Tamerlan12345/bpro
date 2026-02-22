process.env.DATABASE_URL = 'postgresql://test:test@dummy-host:5432/test';
process.env.SESSION_SECRET = 'dummy-secret';
process.env.FRONTEND_URL = 'http://localhost:8080';

const request = require('supertest');
const { when } = require('jest-when');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { getCsrfToken } = require('./test_utils');

const ADMIN_ID = '1';
const USER_ID = '2';

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
    when(mockQuery).calledWith("SELECT id FROM users WHERE name = 'user'").mockResolvedValue({ rows: [{ id: USER_ID }] });
    when(mockQuery).calledWith(expect.stringMatching(/INSERT INTO users/)).mockResolvedValue({ rows: [] });

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

describe('POST /api/transcribe', () => {
    it('should attempt to delete the uploaded file using fs.promises.unlink in finally block', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);
        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };

        // Authenticate
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);

        // Spy on fs.promises.unlink
        const unlinkPromiseSpy = jest.spyOn(fs.promises, 'unlink');

        // Create a dummy file for upload
        const dummyFilePath = path.join(__dirname, 'test_audio.mp3');
        fs.writeFileSync(dummyFilePath, 'dummy audio content');

        try {
             // Perform request
             const response = await agent
                 .post('/api/transcribe')
                 .set('CSRF-Token', csrfToken)
                 .attach('audio', dummyFilePath);

             // Expect 500 because SPEECHMATICS_API_KEY is missing
             expect(response.status).toBe(500);
             expect(response.body.error).toBe('Transcription service is not configured.');

             // Verify fs.promises.unlink was called
             expect(unlinkPromiseSpy).toHaveBeenCalled();

        } finally {
            // Cleanup dummy file
            if (fs.existsSync(dummyFilePath)) {
                fs.unlinkSync(dummyFilePath);
            }
        }
    });

    it('should reject non-audio files', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);
        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };

        // Authenticate
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);

        // Create a dummy text file
        const dummyFilePath = path.join(__dirname, 'test.txt');
        fs.writeFileSync(dummyFilePath, 'dummy text content');

        try {
             const response = await agent
                 .post('/api/transcribe')
                 .set('CSRF-Token', csrfToken)
                 .attach('audio', dummyFilePath);

             expect(response.status).toBe(400);
             expect(response.body.error).toBe('Invalid file type. Only audio files are allowed.');

        } finally {
            if (fs.existsSync(dummyFilePath)) {
                fs.unlinkSync(dummyFilePath);
            }
        }
    });

    it('should accept valid audio files', async () => {
        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);
        const regularUser = { id: USER_ID, name: 'user', hashed_password: 'user_hash', role: 'user' };

        // Authenticate
        when(bcrypt.compare).calledWith('password', regularUser.hashed_password).mockResolvedValue(true);
        mockQuery.mockResolvedValueOnce({ rows: [regularUser] });

        await agent
            .post('/api/auth/login')
            .set('CSRF-Token', csrfToken)
            .send({ name: 'user', password: 'password' })
            .expect(200);

        // Create a dummy audio file
        const dummyFilePath = path.join(__dirname, 'test.wav');
        fs.writeFileSync(dummyFilePath, 'RIFF....WAVE');

        try {
             // We expect 500 because of missing API key, but NOT 400 (bad request)
             // This confirms the file filter passed
             const response = await agent
                 .post('/api/transcribe')
                 .set('CSRF-Token', csrfToken)
                 .attach('audio', dummyFilePath);

             expect(response.status).toBe(500);
             expect(response.body.error).toBe('Transcription service is not configured.');

        } finally {
            if (fs.existsSync(dummyFilePath)) {
                fs.unlinkSync(dummyFilePath);
            }
        }
    });
});
