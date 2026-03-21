const path = require('path');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
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
const { BatchClient } = require('@speechmatics/batch-client');
const multer = require('multer');
const { z } = require('zod');
const csrf = require('csurf');
const { parseDocumentsWithAI } = require('./services/aiParserService');

const app = express();
const logger = pino();

// Security Middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], // <-- Разрешаем CDN JS
                "style-src": ["'self'", "'unsafe-inline'"], // <-- Разрешаем инлайн стили (нужно для Cytoscape)
                "img-src": ["'self'", "data:", "blob:"], // <-- Разрешаем картинки-схемы (Mermaid)
                "connect-src": ["'self'", "https://api.github.com", "https://cdn.jsdelivr.net"],
            },
        },
    })
);

// Logging Middleware
app.use(pinoHttp({
    logger,
    autoLogging: {
        ignore: (req) => {
            // Skip logging for health checks and static assets to reduce noise and I/O overhead
            const isStatic = /\.(js|css|ico|png|jpg|jpeg|svg|woff|woff2)(\?|$)/.test(req.url);
            const isHealth = req.url === '/health';
            return isStatic || isHealth;
        }
    }
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: "Too many login attempts, please try again later." }
});

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})
const allowedMimes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/x-pn-wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/flac'
];

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

const uploadAudio = (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

if (process.env.NODE_ENV === 'test') {
    logger.info('Using MemoryStore for sessions');
}

// --- Static Asset Caching ---
// Cache static assets (JS, CSS, Images) for 1 day in production to reduce load times.
// HTML files are never cached to ensure users get the latest version (with new script hashes).
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (process.env.NODE_ENV === 'production') {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));
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

const csrfProtection = csrf();
app.use(csrfProtection);

app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

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

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

const userCreateSchema = z.object({
    full_name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    department_id: z.string().uuid().nullable().optional(),
    role: z.enum(['user', 'admin']).default('user')
});

const passwordUpdateSchema = z.object({
    password: z.string().min(8)
});

const generateSchema = z.object({
    prompt: z.string().min(1).max(10000)
});

const versionSchema = z.object({
    process_text: z.string().optional(),
    mermaid_code: z.string().optional()
});

const commentSchema = z.object({
    text: z.string().min(1).max(5000)
});

const statusSchema = z.object({
    status: z.enum(['draft', 'pending_review', 'needs_revision', 'completed', 'archived', 'in_progress', 'review', 'approved'])
});

const positionSchema = z.object({
    x: z.number(),
    y: z.number()
});

const authChatSchema = z.object({
    department_id: z.string().uuid().or(z.string()),
    name: z.string().min(1),
    password: z.string().min(1)
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

const checkChatAccess = async (chatId, user, res) => {
    if (user.role === 'admin') return true;
    try {
        const { rows } = await pool.query(
            `SELECT 1 FROM chats c
             JOIN departments d ON c.department_id = d.id
             WHERE c.id = $1 AND d.user_id = $2`,
            [chatId, user.id]
        );
        if (rows.length === 0) {
            res.status(403).json({ error: 'Forbidden' });
            return false;
        }
        return true;
    } catch (error) {
        logger.error(error, `Error checking chat access for user ${user.id} and chat ${chatId}`);
        res.status(500).json({ error: 'Internal server error' });
        return false;
    }
};

app.post('/api/transcribe', isAuthenticated, uploadAudio, async (req, res) => {
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
        try {
            await fs.promises.unlink(req.file.path);
        } catch (err) {
            logger.error(err, 'Error deleting file');
        }
    }
});

app.post('/api/auth/login', authLimiter, validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    logger.info(`Login attempt initiated for email: ${email}`);
    try {
        const result = await pool.query('SELECT id, name, full_name, role, hashed_password FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        const user = result.rows[0];
        if (!user) {
            logger.info(`Login failed: User with email ${email} not found.`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const passwordMatches = await bcrypt.compare(password, user.hashed_password);
        if (!passwordMatches) {
            logger.info(`Login failed for email: ${email}. Invalid password.`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        logger.info(`Login successful for user: ${user.name}, role: ${user.role}`);
        req.session.user = { id: user.id, name: user.name, full_name: user.full_name, role: user.role };
        res.json({ id: user.id, name: user.name, full_name: user.full_name, role: user.role });
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
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    try {
        const { rows } = await pool.query('SELECT status FROM chat_statuses WHERE chat_id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Status not found' });
        res.json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error fetching chat status');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.name, u.full_name, u.email, u.role, d.name as department_name 
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        logger.error(error, 'Error fetching users');
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users', isAuthenticated, isAdmin, validateBody(userCreateSchema), async (req, res) => {
    const { full_name, email, password, department_id, role } = req.body;
    try {
        const name = email.split('@')[0]; // Simple fallback for name
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { rows } = await pool.query(
            `INSERT INTO users (name, full_name, email, hashed_password, role, department_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, full_name, email, role`,
            [name, full_name, email, hashedPassword, role, department_id]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }
        logger.error(error, 'Error creating user');
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/admin/users/:id/password', isAuthenticated, isAdmin, validateBody(passwordUpdateSchema), async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = await pool.query('UPDATE users SET hashed_password = $1 WHERE id = $2', [hashedPassword, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error(error, 'Error updating user password');
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;

    // Check if user is trying to delete themselves
    if (id === req.session.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error(error, 'Error deleting user');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name, full_name FROM users');
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
        } else if (error.code === '23503') {
            logger.warn(`Failed to create department: Invalid user_id ${user_id}`);
            return res.status(400).json({ error: 'User not found' });
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

app.post('/api/auth/chat', isAuthenticated, authLimiter, validateBody(authChatSchema), async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        if (req.session.user.role !== 'admin') {
            const { rows: deptRows } = await pool.query('SELECT 1 FROM departments WHERE id = $1 AND user_id = $2', [department_id, req.session.user.id]);
            if (deptRows.length === 0) {
                logger.warn(`User ${req.session.user.id} attempted to access chat in unauthorized department ${department_id}`);
                return res.status(403).json({ error: 'Forbidden: You do not have access to this department.' });
            }
        }

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
        if (error.code === '23503') {
            logger.warn(`Failed to create chat: Invalid department_id ${department_id}`);
            return res.status(400).json({ error: 'Department not found' });
        }
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
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    try {
        const { rows } = await pool.query('SELECT * FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC', [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chats/:id/versions', isAuthenticated, validateBody(versionSchema), async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
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
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    try {
        const { rows } = await pool.query('SELECT * FROM comments WHERE chat_id = $1 ORDER BY created_at ASC', [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chats/:id/comments', isAuthenticated, validateBody(commentSchema), async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    const { text } = req.body;
    const author_role = req.session.user.role;
    try {
        const sanitizedText = escapeHtml(text);
        const { rows } = await pool.query('INSERT INTO comments (chat_id, author_role, text) VALUES ($1, $2, $3) RETURNING *', [id, author_role, sanitizedText]);
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chats/:id/transcription', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
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
    if (!(await checkChatAccess(id, req.session.user, res))) return;
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
        const { rows } = await pool.query(query, [id, transcribed_text ?? null, final_text ?? null, status ?? null]);
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, `Error creating/updating transcription data for chat ${id}`);
        res.status(500).json({ error: 'Failed to save transcription data.' });
    }
});

app.put('/api/chats/:id/status', isAuthenticated, validateBody(statusSchema), async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    const { status } = req.body;
    try {
        const { rows } = await pool.query('UPDATE chat_statuses SET status = $1 WHERE chat_id = $2 RETURNING *', [status, id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Status not found' });

        // --- NEW LOGIC FOR GLOBAL ARCHITECTURE ---
        if (status === 'approved') {
            try {
                // Transfer data to business_processes
                const chatQuery = 'SELECT department_id, name FROM chats WHERE id = $1';
                const chatRes = await pool.query(chatQuery, [id]);
                if (chatRes.rows.length > 0) {
                    const chat = chatRes.rows[0];
                    await pool.query(`
                        INSERT INTO business_processes (
                            department_id, chat_id, name, status, is_ai_generated
                        ) VALUES ($1, $2, $3, 'approved', false)
                        ON CONFLICT (chat_id) DO UPDATE SET 
                            status = 'approved',
                            department_id = EXCLUDED.department_id,
                            name = EXCLUDED.name
                    `, [chat.department_id, id, chat.name]);
                }
            } catch (err) {
                logger.error(err, 'Error moving chat to business_processes');
                // Continue, do not fail status update entirely
            }
        }
        // -----------------------------------------

        res.json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error updating chat status');
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chats/:id/initial-process', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    try {
        const { rows } = await pool.query('SELECT * FROM initial_business_processes WHERE chat_id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Initial process not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        logger.error(error, `Error fetching initial process for chat ${id}`);
        res.status(500).json({ error: 'Failed to retrieve initial process.' });
    }
});

app.post('/api/chats/:id/initial-process', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content is required.' });
    }

    try {
        // Enforce immutability: check if it already exists
        const { rows: existing } = await pool.query('SELECT 1 FROM initial_business_processes WHERE chat_id = $1', [id]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Initial process already exists and cannot be changed.' });
        }

        const { rows } = await pool.query(
            'INSERT INTO initial_business_processes (chat_id, content) VALUES ($1, $2) RETURNING *',
            [id, content]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, `Error saving initial process for chat ${id}`);
        res.status(500).json({ error: 'Failed to save initial process.' });
    }
});

app.get('/api/admin/map', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const departmentsRes = await pool.query('SELECT id, name, x, y, width, height, color FROM departments');
        const processesRes = await pool.query('SELECT * FROM business_processes');
        const relationsRes = await pool.query('SELECT * FROM process_relations');

        // Also fetch chats that are not yet processes to show them in the map
        const chatsRes = await pool.query(`
            SELECT c.id, c.name, c.department_id, c.x, c.y, cs.status 
            FROM chats c 
            JOIN chat_statuses cs ON c.id = cs.chat_id 
            WHERE c.id NOT IN (SELECT chat_id FROM business_processes WHERE chat_id IS NOT NULL)
        `);

        res.json({
            departments: departmentsRes.rows,
            processes: processesRes.rows,
            relations: relationsRes.rows,
            active_chats: chatsRes.rows
        });
    } catch (error) {
        logger.error(error, 'Error fetching map data');
        res.status(500).json({ error: 'Failed to retrieve map data.' });
    }
});

app.post('/api/admin/map/ai-layout', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const departmentsRes = await pool.query('SELECT id, name FROM departments');
        const processesRes = await pool.query('SELECT id, name, department_id FROM business_processes');
        const relationsRes = await pool.query('SELECT source_process_id, target_process_id FROM process_relations');

        if (processesRes.rows.length === 0) {
            return res.status(400).json({ error: 'No processes to layout' });
        }

        const mapContext = {
            departments: departmentsRes.rows,
            processes: processesRes.rows,
            relations: relationsRes.rows
        };

        const prompt = `Ты — эксперт по визуализации графов. Твоя задача рассчитать красивые координаты (x, y) для узлов карты процессов.
Правила идеального макета:
1. Департаменты располагаются в горизонтальный ряд в верхней части (y = 200). Координата X для каждого департамента должна рассчитываться с отступом в 400-500 пикселей (например: x=500, x=1000, x=1500).
2. Процессы каждого департамента располагаются СТРОГО ВЕРТИКАЛЬНО ВНИЗ (в столбик) под своим департаментом.
   - Например, для Департамента 1 (x=500, y=200), его процессы должны идти так:
     - Процесс 1: x=500, y=400
     - Процесс 2: x=500, y=600
     - Процесс 3: x=500, y=800
3. Чаты (если есть) также располагаются в столбик под процессами своего департамента (y=1000 и т.д.).
4. Никакие узлы не должны накладываться друг на друга.
        
Данные карты:
${JSON.stringify(mapContext, null, 2)}

Верни результат строго в формате JSON:
{
  "layout": [
    { "id": "uuid", "type": "process", "x": число, "y": число },
    { "id": "uuid", "type": "department", "x": число, "y": число }
  ]
}
Обязательно верни только валидный JSON без маркдаун-оберток.`;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await apiResponse.json();
        let aiResult = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : null;

        if (!aiResult) throw new Error("Empty AI response");

        aiResult = aiResult.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(aiResult);

        // Optional: Save coordinates back to DB directly or let Frontend do it via animation -> Frontend dragfree does it, or we just return it and let Frontend save it.
        // The user spec said "Затем фронтенд применяет эти координаты с анимацией", so we return it.

        res.json(parsed);
    } catch (error) {
        logger.error(error, 'Error in AI layout');
        res.status(500).json({ error: 'AI Layout failed' });
    }
});

app.post('/api/admin/processes', isAuthenticated, isAdmin, async (req, res) => {
    const { name, department_id } = req.body;
    if (!name || !department_id) return res.status(400).json({ error: 'Name and Department ID are required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO business_processes (name, department_id, status) VALUES ($1, $2, $3) RETURNING *',
            [name, department_id, 'draft']
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error creating draft process');
        res.status(500).json({ error: 'Failed to create draft process.' });
    }
});

// --- PUBLIC DASHBOARD ENDPOINTS ---
app.get('/api/dash/map', async (req, res) => {
    try {
        const departmentsRes = await pool.query('SELECT id, name, x, y FROM departments');
        const processesRes = await pool.query('SELECT id, name, status, department_id, x, y FROM business_processes');
        const relationsRes = await pool.query('SELECT id, source_process_id, target_process_id, relation_type FROM process_relations');
        const chatsRes = await pool.query(`
            SELECT c.id, c.name, c.department_id, c.x, c.y, cs.status 
            FROM chats c JOIN chat_statuses cs ON c.id = cs.chat_id 
            WHERE c.id NOT IN (SELECT chat_id FROM business_processes WHERE chat_id IS NOT NULL)
        `);
        res.json({
            departments: departmentsRes.rows,
            processes: processesRes.rows,
            relations: relationsRes.rows,
            active_chats: chatsRes.rows
        });
    } catch (error) {
        logger.error(error, 'Error fetching public map');
        res.status(500).json({ error: 'Failed to fetch map.' });
    }
});

app.get('/dash', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Дашборд Процессов</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
    <style>
        body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; overflow: hidden; }
        #cy { 
            width: 100vw; height: 100vh; display: block; 
            background-image: radial-gradient(#cbd5e1 1.5px, transparent 1.5px);
            background-size: 30px 30px;
        }
        .overlay { position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 15px 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); z-index: 10; border: 1px solid #e2e8f0; backdrop-filter: blur(10px); }
        .overlay h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: 700; }
        .legend { position: absolute; bottom: 20px; right: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); z-index: 10; font-size: 13px; border: 1px solid #e2e8f0; color: #334155; pointer-events: none;}
        .btn-controls { position: absolute; top: 20px; right: 20px; z-index: 10; display: flex; gap: 10px; align-items: center;}
        button { padding: 8px 16px; border: none; background: #fff; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; font-weight: 600; color: #475569; transition: all 0.2s; }
        button:hover { background: #f1f5f9; transform: translateY(-1px); }
        #dash-search { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-family: inherit; font-size: 14px; width: 220px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    </style>
</head>
<body>
    <div class="overlay"><h1>Карта Бизнес-Процессов</h1><p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">Режим чтения</p></div>
    <div class="btn-controls">
        <input type="text" id="dash-search" placeholder="🔍 Поиск процессов...">
        <button id="btn-fit">По размеру экрана</button>
        <button id="btn-zoom-in">+</button>
        <button id="btn-zoom-out">-</button>
    </div>
    <div id="cy"></div>
    <div class="legend">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b;">Легенда статусов</h4>
        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #ecfdf5; border: 2px solid #10b981; margin-right: 10px; border-radius: 4px;"></span> Утвержден</div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #fffbeb; border: 2px solid #f59e0b; margin-right: 10px; border-radius: 4px;"></span> Черновик</div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #fef2f2; border: 2px solid #ef4444; margin-right: 10px; border-radius: 4px;"></span> Нужны правки</div>
        <div style="display: flex; align-items: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #f0f9ff; border: 2px dashed #0ea5e9; margin-right: 10px; border-radius: 4px;"></span> Чат</div>
    </div>
    <script src="/dash.js"></script>
</body>
</html>
    `);
});

app.put('/api/admin/processes/:id/position', isAuthenticated, isAdmin, validateBody(positionSchema), async (req, res) => {
    const { id } = req.params;
    const { x, y } = req.body;
    try {
        const { rowCount } = await pool.query(
            'UPDATE business_processes SET x = $1, y = $2 WHERE id = $3',
            [x, y, id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Process not found' });
        res.json({ success: true });
    } catch (error) {
        logger.error(error, `Error updating position for process ${id}`);
        res.status(500).json({ error: 'Failed to update position.' });
    }
});

app.put('/api/admin/departments/:id/position', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { x, y, width, height, color } = req.body;
    try {
        const updates = [];
        const params = [id];
        let pidx = 2;
        if (x !== undefined) { updates.push(`x = $${pidx++}`); params.push(x); }
        if (y !== undefined) { updates.push(`y = $${pidx++}`); params.push(y); }
        if (width !== undefined) { updates.push(`width = $${pidx++}`); params.push(width); }
        if (height !== undefined) { updates.push(`height = $${pidx++}`); params.push(height); }
        if (color !== undefined) { updates.push(`color = $${pidx++}`); params.push(color); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        const query = `UPDATE departments SET ${updates.join(', ')} WHERE id = $1`;
        const { rowCount } = await pool.query(query, params);
        if (rowCount === 0) return res.status(404).json({ error: 'Department not found' });
        res.json({ success: true });
    } catch (error) {
        logger.error(error, `Error updating position for department ${id}`);
        res.status(500).json({ error: 'Failed to update department position.' });
    }
});

app.put('/api/admin/chats/:id/position', isAuthenticated, isAdmin, validateBody(positionSchema), async (req, res) => {
    const { id } = req.params;
    const { x, y } = req.body;
    try {
        const { rowCount } = await pool.query(
            'UPDATE chats SET x = $1, y = $2 WHERE id = $3',
            [x, y, id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Chat not found' });
        res.json({ success: true });
    } catch (error) {
        logger.error(error, `Error updating position for chat ${id}`);
        res.status(500).json({ error: 'Failed to update position.' });
    }
});

app.post('/api/admin/relations', isAuthenticated, isAdmin, async (req, res) => {
    const { source_process_id, target_process_id, relation_type } = req.body;
    if (!source_process_id || !target_process_id) return res.status(400).json({ error: 'Source and target process IDs are required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO process_relations (source_process_id, target_process_id, relation_type, is_manual) VALUES ($1, $2, $3, $4) RETURNING *',
            [source_process_id, target_process_id, relation_type || 'Ручная связь', true]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error(error, 'Error creating manual relation');
        res.status(500).json({ error: 'Failed to create relation.' });
    }
});

app.delete('/api/admin/processes/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM business_processes WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        logger.error(error, `Error deleting process ${id}`);
        res.status(500).json({ error: 'Failed to delete process.' });
    }
});

app.delete('/api/admin/departments/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Find if there are processes tied to this department. 
        // business_processes has ON DELETE SET NULL, but we might want to check or just let it happen.
        await pool.query('DELETE FROM departments WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        logger.error(error, `Error deleting department ${id}`);
        res.status(500).json({ error: 'Failed to delete department.' });
    }
});

const uploadDocs = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
}).array('documents', 50);

app.post('/api/admin/parse-documents', isAuthenticated, isAdmin, (req, res, next) => {
    uploadDocs(req, res, function (err) {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    try {
        const resultJSON = await parseDocumentsWithAI(req.files, process.env.GOOGLE_API_KEY);

        const deptMap = {};
        if (resultJSON.departments) {
            for (const dName of resultJSON.departments) {
                const { rows } = await pool.query(
                    'INSERT INTO departments (name, hashed_password, user_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                    [dName, 'dummy_hash', req.session.user.id]
                );
                deptMap[dName] = rows[0].id;
            }
        }

        const procMap = {};
        if (resultJSON.processes) {
            for (const proc of resultJSON.processes) {
                const deptId = deptMap[proc.department] || null;
                const { rows } = await pool.query(
                    'INSERT INTO business_processes (name, owner_name, department_id, description, status, is_ai_generated) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [proc.name, proc.owner, deptId, proc.description || '', 'approved', true]
                );
                procMap[proc.name] = rows[0].id;
            }

            for (const proc of resultJSON.processes) {
                if (proc.connections && Array.isArray(proc.connections)) {
                    for (const targetName of proc.connections) {
                        const targetId = procMap[targetName];
                        if (targetId && procMap[proc.name]) {
                            await pool.query(
                                'INSERT INTO process_relations (source_process_id, target_process_id, relation_type) VALUES ($1, $2, $3)',
                                [procMap[proc.name], targetId, 'Связано ИИ']
                            );
                        }
                    }
                }
            }
        }

        for (const file of req.files) {
            fs.unlinkSync(file.path);
        }

        res.json({ message: 'Parsed and integrated successfully', parsed: resultJSON });
    } catch (error) {
        logger.error(error, 'Document parse error');
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/audit', isAuthenticated, isAdmin, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const bpRes = await pool.query("SELECT name, department_id, description FROM business_processes WHERE status = 'approved'");
        const globalContext = bpRes.rows.map(r => `Процесс: ${r.name} (Dept: ${r.department_id})\nОписание: ${r.description || 'Нет'}`).join('\n\n');

        const fullPrompt = `Ты — элитный бизнес-архитектор и ИИ аудитор. Твоя задача: провести анализ предоставленной базы утвержденных процессов согласно промпту администратора.
БАЗА ПРОЦЕССОВ:
${globalContext}

ПРОМПТ АДМИНИСТРАТОРА:
${prompt}

Ответь структурированно, указывая найденные проблемы или результаты согласно запросу.`;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });

        const data = await apiResponse.json();
        const report = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : 'Ошибка аудита';

        // Save report to db
        await pool.query(
            'INSERT INTO ai_audit_reports (prompt_used, report_text) VALUES ($1, $2)',
            [prompt, report]
        );

        res.json({ result: report });
    } catch (error) {
        logger.error(error, 'Global Audit Error');
        res.status(500).json({ error: 'Audit failed' });
    }
});

app.post('/api/generate', isAuthenticated, async (req, res) => {
    const { prompt, chat_id } = req.body;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'API key is not configured' });

    try {
        let contextStr = '';
        if (chat_id) {
            const chatRes = await pool.query('SELECT department_id FROM chats WHERE id = $1', [chat_id]);
            if (chatRes.rows.length > 0) {
                const dId = chatRes.rows[0].department_id;
                const bpRes = await pool.query("SELECT name FROM business_processes WHERE department_id = $1 AND status = 'approved'", [dId]);
                if (bpRes.rows.length > 0) {
                    contextStr = 'КОНТЕКСТ УТВЕРЖДЕННЫХ ПРОЦЕССОВ ВАШЕГО ДЕПАРТАМЕНТА:\n' + bpRes.rows.map(r => `- ${r.name}`).join('\n') + '\nСТРОГО УЧИТЫВАЙ ЭТИ ПРОЦЕССЫ ПРИ ГЕНЕРАЦИИ.\n\n';
                }
            }
        }
        const finalPrompt = contextStr + prompt;

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
        });
        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            return res.status(apiResponse.status).json({ error: 'Failed to fetch from Google API', details: errorData });
        }
        const data = await apiResponse.json();
        res.status(200).json(data);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/chats/:id/validate', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { process_text } = req.body;
    if (!process_text) return res.status(400).json({ error: 'Process text required' });

    try {
        const bpRes = await pool.query("SELECT name, department_id FROM business_processes WHERE status = 'approved'");
        const globalContext = bpRes.rows.map(r => `${r.name} (Dept: ${r.department_id})`).join(', ');

        const prompt = `
Ты интеллектуальный Copilot. Проанализируй этот бизнес-процесс на предмет логических нестыковок и нарушений, сравнивая его с глобальной картой утвержденных процессов компании.
ГЛОБАЛЬНАЯ КАРТА: ${globalContext}

ТЕКУЩИЙ ПРОЦЕСС НА ПРОВЕРКЕ:
${process_text}

Ответь кратко, есть ли ошибки логики (например, дублирование функций или конфликт полномочий). Если все ок, напиши 'Ошибок не найдено'.
        `;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await apiResponse.json();
        const analysis = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : 'Ошибок не найдено';

        res.json({ analysis });
    } catch (error) {
        logger.error(error, 'Error during copilot validation');
        res.status(500).json({ error: 'Validation failed' });
    }
});

const BCRYPT_SALT_ROUNDS = 10;
async function ensureUsersExist(pool) {
    try {
        // Find by role or name to transition
        let { rows: adminRows } = await pool.query("SELECT id FROM users WHERE role = 'admin' OR name = 'admin' OR email = 'admin@bizpro.ai'");
        if (adminRows.length === 0) {
            if (process.env.ADMIN_INITIAL_PASSWORD) {
                logger.info('Admin user not found, creating it...');
                const hashedPassword = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD, BCRYPT_SALT_ROUNDS);
                await pool.query(
                    "INSERT INTO users (name, full_name, email, hashed_password, role) VALUES ('admin', 'Главный Администратор', 'admin@bizpro.ai', $1, 'admin')",
                    [hashedPassword]
                );
                logger.info('Admin user created.');
            } else {
                logger.warn('ADMIN_INITIAL_PASSWORD not set. Skipping admin user creation.');
            }
        }
    } catch (error) {
        logger.error(error, 'Error during initial user setup');
    }
}

// Global Error Handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        logger.error(err, 'CSRF Token Validation Failed');
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }

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
                    await ensureUsersExist(pool);
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

module.exports = { app, startServer, departmentSchema, chatSchema, loginSchema, ensureUsersExist };
