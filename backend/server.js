const path = require('path');
const fs = require('fs');
const pino = require('pino');
const pinoHttp = require('pino-http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const WebSocket = require('ws');
const { BatchClient } = require('@speechmatics/batch-client');
const multer = require('multer');
const { z } = require('zod');

const app = express();
const logger = pino();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"], // <-- Разрешаем CDN
        "img-src": ["'self'", "data:", "blob:"], // <-- Разрешаем картинки-схемы (Mermaid)
        "connect-src": ["'self'"],
      },
    },
  })
);

// Logging Middleware
app.use(pinoHttp({ logger }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    logger.info(`Created uploads directory at: ${uploadsDir}`);
}

app.set('trust proxy', 1); // Trust the first proxy
const PORT = process.env.PORT || 3000;

let pool;
if (process.env.DATABASE_URL) {
    const config = parse(process.env.DATABASE_URL);
    pool = new Pool({
        ...config,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
}

app.get('/health', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ status: 'error', database: 'not_initialized' });
    }
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(200).json({ status: 'ok', database: 'disconnected', error: error.message });
    }
});

// --- Multer Setup for audio upload ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'))
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})
const upload = multer({ storage: storage });


app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

if (process.env.NODE_ENV === 'test') {
    logger.info('Using MemoryStore for sessions');
}

app.use(session({
    store: process.env.NODE_ENV === 'test'
        ? new session.MemoryStore()
        : new pgSession({
            pool: pool,
            tableName: 'session'
        }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : undefined,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized: You must be logged in.' });
};
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
};

// --- Zod Schemas ---
const departmentSchema = z.object({
    name: z.string().min(1),
    password: z.string().min(1),
    user_id: z.string().uuid().or(z.string()), // Accept UUID or string
});

const chatSchema = z.object({
    department_id: z.string().uuid().or(z.string()), // Accept UUID or string
    name: z.string().min(1),
    password: z.string().min(1),
});

const validateBody = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
             return res.status(400).json({ error: 'Validation Error', details: error.errors });
        }
        res.status(400).json({ error: 'Invalid Request' });
    }
};

app.post('/api/transcribe', isAuthenticated, upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    try {
        if (!process.env.SPEECHMATICS_API_KEY) {
            return res.status(500).json({ error: 'Transcription service is not configured.' });
        }

        const client = new BatchClient({ apiKey: process.env.SPEECHMATICS_API_KEY });
        const fileStream = fs.createReadStream(req.file.path);

        const response = await client.transcribe(
            fileStream,
            {
                transcription_config: {
                    language: 'ru',
                },
            },
            'json-v2',
        );

        const fullTranscript = response.results.map((r) => r.alternatives?.[0].content).join(' ');

        res.json({ transcript: fullTranscript });

    } catch (error) {
        logger.error(error, 'Speechmatics transcription error');
        res.status(500).json({ error: 'Failed to transcribe audio.' });
    } finally {
        fs.unlink(req.file.path, (err) => {
            if (err) logger.error(err, 'Error deleting file');
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { name, password } = req.body;
    logger.info(`Login attempt for user: ${name}`);
    try {
        const result = await pool.query('SELECT id, name, hashed_password FROM users WHERE name = $1', [name]);
        const user = result.rows[0];
        if (!user) {
            logger.info(`Login failed for user: ${name}. User not found.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const passwordMatches = await bcrypt.compare(password, user.hashed_password);
        if (!passwordMatches) {
            logger.info(`Login failed for user: ${name}. Invalid password.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const role = user.name === 'admin' ? 'admin' : 'user';
        logger.info(`Login successful for user: ${name}, role: ${role}`);
        req.session.user = { id: user.id, name: user.name, role: role };
        res.json({ id: user.id, name: user.name, role: role });
    } catch (error) {
        logger.error(error, 'Error during login');
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.name : 'Unknown user';
    req.session.destroy(err => {
        if (err) {
            logger.error(err, `Logout error for user: ${userName}`);
            return res.status(500).json({ error: 'Could not log out, please try again.' });
        }
        res.clearCookie('connect.sid');
        logger.info(`User ${userName} logged out successfully.`);
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ user: null });
    }
});

app.get('/api/admin/chats/in_review', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT c.id AS chat_id, c.name, cs.status, d.name AS department_name
            FROM chats c
            JOIN chat_statuses cs ON c.id = cs.chat_id
            LEFT JOIN departments d ON c.department_id = d.id
            WHERE cs.status = 'pending_review'
        `;
        const { rows } = await pool.query(query);
        const transformedData = rows.map(chat => ({
            chat_id: chat.chat_id,
            status: chat.status,
            chats: { name: chat.name },
            departments: { name: chat.department_name || 'No Department' }
        }));
        res.json(transformedData);
    } catch (error) {
        logger.error(error, 'Error fetching chats in review');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/chats/pending', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT c.id AS chat_id, c.name, cs.status, d.name AS department_name
            FROM chats c
            JOIN chat_statuses cs ON c.id = cs.chat_id
            LEFT JOIN departments d ON c.department_id = d.id
            WHERE cs.status = 'draft' OR cs.status = 'needs_revision'
        `;
        const { rows } = await pool.query(query);
        const transformedData = rows.map(chat => ({
            chat_id: chat.chat_id,
            status: chat.status,
            chats: { name: chat.name },
            departments: { name: chat.department_name || 'No Department' }
        }));
        res.json(transformedData);
    } catch (error) {
        logger.error(error, 'Error fetching pending chats');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chats/:id/status', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT status FROM chat_statuses WHERE chat_id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Status not found' });
        res.json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error fetching chat status');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name FROM users');
        res.json(rows);
    } catch (error) {
        logger.error(error, 'Error fetching users');
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/departments', isAuthenticated, isAdmin, validateBody(departmentSchema), async (req, res) => {
    const { name, password, user_id } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const { rows } = await pool.query(
            'INSERT INTO departments (name, hashed_password, user_id) VALUES ($1, $2, $3) RETURNING *',
            [name, hashedPassword, user_id]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'This department name already exists for the selected user.' });
        }
        logger.error(error, 'Error creating department');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments', isAuthenticated, async (req, res) => {
    const { user } = req.session;
    try {
        const query = user.role === 'admin'
            ? 'SELECT id, name, user_id FROM departments'
            : 'SELECT id, name, user_id FROM departments WHERE user_id = $1';
        const params = user.role === 'admin' ? [] : [user.id];
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        logger.error(error, 'Error fetching departments');
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/departments/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, password } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    try {
        const updates = ['name = $2'];
        const params = [id, name];
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push('hashed_password = $3');
            params.push(hashedPassword);
        }
        const query = `UPDATE departments SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const { rows } = await pool.query(query, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Department not found' });
        res.json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error updating department');
        return res.status(500).json({ error: error.message });
    }
});

app.delete('/api/departments/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM departments WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        logger.error(error, 'Error deleting department');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/chats/completed', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT c.id AS chat_id, c.name, cs.status, d.name AS department_name
            FROM chats c
            JOIN chat_statuses cs ON c.id = cs.chat_id
            LEFT JOIN departments d ON c.department_id = d.id
            WHERE cs.status IN ('completed', 'archived')
        `;
        const { rows } = await pool.query(query);
        const transformedData = rows.map(chat => ({
            chat_id: chat.chat_id,
            status: chat.status,
            chats: { name: chat.name },
            departments: { name: chat.department_name || 'No Department' }
        }));
        res.json(transformedData);
    } catch (error) {
        logger.error(error, 'Error fetching completed chats');
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/chat', isAuthenticated, async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT id, name, hashed_password FROM chats WHERE department_id = $1 AND name = $2',
            [department_id, name]
        );
        const chat = rows[0];
        if (!chat) return res.status(401).json({ error: 'Invalid chat or password' });
        const passwordMatches = await bcrypt.compare(password, chat.hashed_password);
        if (!passwordMatches) return res.status(401).json({ error: 'Invalid chat or password' });
        res.json({ id: chat.id, name: chat.name });
    } catch (error) {
        logger.error(error, 'Error during chat authentication');
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/chats', isAuthenticated, async (req, res) => {
    const { department_id } = req.query;
    const { user } = req.session;
    if (!department_id) return res.status(400).json({ error: 'department_id query parameter is required.' });
    try {
        if (user.role !== 'admin') {
            const { rows } = await pool.query('SELECT id FROM departments WHERE id = $1 AND user_id = $2', [department_id, user.id]);
            if (rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
        }
        const query = `SELECT c.id, c.name, cs.status FROM chats c LEFT JOIN chat_statuses cs ON c.id = cs.chat_id WHERE c.department_id = $1`;
        const { rows } = await pool.query(query, [department_id]);
        res.json(rows);
    } catch (error) {
        logger.error(error, 'Error fetching chats for department');
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chats', isAuthenticated, isAdmin, validateBody(chatSchema), async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const { rows } = await pool.query("SELECT * FROM create_chat_with_status($1, $2, $3)", [department_id, name, hashedPassword]);
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error creating chat with RPC');
        return res.status(500).json({ error: error.message });
    }
});

app.delete('/api/chats/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM chats WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        logger.error(error, 'Error deleting chat');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chats/:id/versions', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC', [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chats/:id/versions', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { process_text, mermaid_code } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO process_versions (chat_id, process_text, mermaid_code) VALUES ($1, $2, $3) RETURNING *', [id, process_text, mermaid_code]);
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all comments for a chat
app.get('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM comments WHERE chat_id = $1 ORDER BY created_at ASC', [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const author_role = req.session.user.role;
    try {
        const { rows } = await pool.query('INSERT INTO comments (chat_id, author_role, text) VALUES ($1, $2, $3) RETURNING *', [id, author_role, text]);
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chats/:id/transcription', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM transcription_data WHERE chat_id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transcription data not found for this chat.' });
        }
        res.json(rows[0]);
    } catch (error) {
        logger.error(error, `Error fetching transcription data for chat ${id}`);
        res.status(500).json({ error: 'Failed to retrieve transcription data.' });
    }
});

app.post('/api/chats/:id/transcription', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { transcribed_text, final_text, status } = req.body;

    if (!transcribed_text && !final_text && !status) {
        return res.status(400).json({ error: 'At least one field (transcribed_text, final_text, status) is required.' });
    }

    try {
        const query = `
            INSERT INTO transcription_data (chat_id, transcribed_text, final_text, status, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (chat_id)
            DO UPDATE SET
                transcribed_text = COALESCE($2, transcription_data.transcribed_text),
                final_text = COALESCE($3, transcription_data.final_text),
                status = COALESCE($4, transcription_data.status),
                updated_at = NOW()
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [id, transcribed_text, final_text, status]);
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, `Error creating/updating transcription data for chat ${id}`);
        res.status(500).json({ error: 'Failed to save transcription data.' });
    }
});

app.put('/api/chats/:id/status', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const { rows } = await pool.query('UPDATE chat_statuses SET status = $1 WHERE chat_id = $2 RETURNING *', [status, id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate', isAuthenticated, async (req, res) => {
  const { prompt } = req.body;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'API key is not configured' });
  try {
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      return res.status(apiResponse.status).json({ error: 'Failed to fetch from Google API', details: errorData });
    }
    const data = await apiResponse.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

const BCRYPT_SALT_ROUNDS = 10;
async function ensureUsersExist() {
    try {
        let { rows: adminRows } = await pool.query("SELECT id FROM users WHERE name = 'admin'");
        if (adminRows.length === 0) {
            logger.info('Admin user not found, creating it...');
            const hashedPassword = await bcrypt.hash('adminpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('admin', $1)", [hashedPassword]);
            logger.info('Admin user created.');
        }
        let { rows: userRows } = await pool.query("SELECT id FROM users WHERE name = 'user'");
        if (userRows.length === 0) {
            logger.info('Regular user not found, creating it...');
            const hashedPassword = await bcrypt.hash('userpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('user', $1)", [hashedPassword]);
            logger.info('Regular user created.');
        }
    } catch (error) {
        logger.error(error, 'Error during initial user setup');
    }
}

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message;

    res.status(statusCode).json({ error: message });
});

const startServer = async () => {
    try {
        if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.FRONTEND_URL) {
            throw new Error("DATABASE_URL, SESSION_SECRET, and FRONTEND_URL must be set.");
        }

        logger.info('Initializing database connection...');
        if (!pool) {
             const config = parse(process.env.DATABASE_URL);
             pool = new Pool({
                ...config,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            });
        }

        const server = app.listen(PORT, async () => {
            logger.info(`Server v2 is running on port ${PORT}`);

            try {
                const client = await pool.connect();
                logger.info('Database connection successful.');
                client.release();

                if (process.env.NODE_ENV !== 'test') {
                    await ensureUsersExist();
                }
            } catch (err) {
                logger.error(err, 'Database connection failed');
            }
        });

        return { app, server, pool };

    } catch (err) {
        logger.error(err, 'Failed to start server');
        process.exit(1);
    }
};

module.exports = { app, startServer, departmentSchema, chatSchema };
