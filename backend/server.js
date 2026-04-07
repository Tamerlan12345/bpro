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
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { BatchClient } = require('@speechmatics/batch-client');
const multer = require('multer');
const { z } = require('zod');
const csrf = require('csurf');
const { parseDocumentsWithAI } = require('./services/aiParserService');
const { createVsdxFromBpmnXml } = require('./services/visioExportService');
const { fetchWithRetry } = require('./utils/resilientFetch');
const { composeGeneratePrompt } = require('./utils/promptComposer');
const { createDatabaseConfig } = require('./utils/databaseConfig');

const app = express();
const logger = pino();
const sessionSecret = process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me';

if (!process.env.SESSION_SECRET && process.env.NODE_ENV !== 'test') {
    logger.warn('SESSION_SECRET is not set. Using development fallback secret.');
}

// Security Middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "'unsafe-eval'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
                "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
                "media-src": ["'self'", "blob:"], // <-- Р Р°Р·СЂРµС€Р°РµРј РїР»РµРµСЂСѓ РІРѕСЃРїСЂРѕРёР·РІРѕРґРёС‚СЊ Р·Р°РїРёСЃР°РЅРЅРѕРµ Р°СѓРґРёРѕ
                "img-src": ["'self'", "data:", "blob:"], // <-- Р Р°Р·СЂРµС€Р°РµРј РєР°СЂС‚РёРЅРєРё-СЃС…РµРјС‹ (Mermaid)
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
const limiterWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10);
const limiterMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '', 10);
const isStaticAssetRequest = (req) => /\.(css|js|ico|png|jpg|jpeg|svg|woff|woff2|map)(\?|$)/i.test(req.path);
const isPositionPersistenceRequest = (req) => (
    req.method === 'PUT'
    && /^\/api\/admin\/(processes|departments|chats)\/[^/]+\/position$/.test(req.path)
);

const limiter = rateLimit({
    windowMs: Number.isFinite(limiterWindowMs) && limiterWindowMs > 0 ? limiterWindowMs : 15 * 60 * 1000,
    max: Number.isFinite(limiterMax) && limiterMax > 0 ? limiterMax : 100,
    skip: (req) => isPositionPersistenceRequest(req) || isStaticAssetRequest(req),
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
    const config = createDatabaseConfig(process.env.DATABASE_URL, process.env.NODE_ENV, {
        databaseSsl: process.env.DATABASE_SSL,
        databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
        pgssl: process.env.PGSSL,
        pgsslRejectUnauthorized: process.env.PGSSLREJECTUNAUTHORIZED
    });
    pool = new Pool(config);
}

app.get('/health', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ status: 'error', database: 'not_initialized' });
    }
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: error.message });
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
    origin: (origin, callback) => {
        const allowedOrigin = process.env.FRONTEND_URL;
        if (!origin || allowedOrigin === '*' || origin === allowedOrigin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
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
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (process.env.NODE_ENV === 'production') {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};

app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];

    next();
});
app.use(session({
    store: process.env.NODE_ENV === 'test'
        ? new session.MemoryStore()
        : new pgSession({
            pool: pool,
            tableName: 'session'
        }),
    secret: sessionSecret,
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
    logger.warn({ url: req.url, ip: req.ip }, 'Unauthenticated access attempt');
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
    prompt: z.string().min(1).max(100000),
    chat_id: z.string().uuid().or(z.string()).optional()
});

const versionSchema = z.object({
    process_text: z.string().optional(),
    mermaid_code: z.string().optional()
});

const vsdxExportSchema = z.object({
    bpmn_xml: z.string().min(1)
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

const bulkPositionSchema = z.object({
    departments: z.array(z.object({ id: z.string(), x: z.number(), y: z.number() })).optional(),
    processes: z.array(z.object({ id: z.string(), x: z.number(), y: z.number() })).optional(),
    chats: z.array(z.object({ id: z.string(), x: z.number(), y: z.number() })).optional()
});

const departmentPositionSchema = z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    color: z.string().trim().min(1).max(50).optional()
}).strict().refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    { message: 'At least one field is required' }
);

const aiLayoutItemSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['department', 'process', 'chat', 'root']),
    x: z.number().finite(),
    y: z.number().finite()
});

const aiLayoutResponseSchema = z.object({
    layout: z.array(aiLayoutItemSchema).min(1)
}).strict();

const relationSchema = z.object({
    source_process_id: z.string().min(1),
    target_process_id: z.string().min(1),
    relation_type: z.string().min(1).optional()
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

const buildDepartmentAccessQuery = (selectClause = 'SELECT d.id, d.name, d.user_id') => `
    ${selectClause}
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id
    WHERE d.user_id = $1 OR u.id = $1
`;

const hasDepartmentAccess = async (departmentId, userId) => {
    const { rows } = await pool.query(
        `
            SELECT d.id
            FROM departments d
            LEFT JOIN users u ON u.department_id = d.id
            WHERE d.id = $1 AND (d.user_id = $2 OR u.id = $2)
            LIMIT 1
        `,
        [departmentId, userId]
    );

    return rows.length > 0;
};

const checkChatAccess = async (chatId, user, res) => {
    if (user.role === 'admin') return true;
    try {
        const { rows } = await pool.query(
            `SELECT 1 FROM chats c
             JOIN departments d ON c.department_id = d.id
             LEFT JOIN users u ON u.department_id = d.id
             WHERE c.id = $1 AND (d.user_id = $2 OR u.id = $2)`,
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

        // Added appId: 'bizpro-backend' to satisfy SDK requirement
        const client = new BatchClient({ 
            apiKey: process.env.SPEECHMATICS_API_KEY,
            appId: 'bizpro-backend'
        });
        
        // SDK expects File/Blob, not a ReadStream — read file into a Blob
        const fileBuffer = await fs.promises.readFile(req.file.path);
        const audioBlob = new Blob([fileBuffer], { type: req.file.mimetype || 'audio/webm' });

        logger.info(`Starting transcription for file: ${req.file.originalname}, size: ${fileBuffer.length} bytes`);
        
        const response = await client.transcribe(
            { data: audioBlob, fileName: req.file.originalname || 'recording.webm' },
            {
                transcription_config: {
                    language: 'ru',
                },
            },
            'json-v2',
        );

        if (!response || !response.results) {
            logger.error({ response }, 'Speechmatics returned empty or invalid response');
            throw new Error('Invalid response from transcription service');
        }

        const fullTranscript = response.results.map((r) => r.alternatives?.[0].content).join(' ');

        logger.info(`Transcription successful. Length: ${fullTranscript.length}`);
        res.json({ transcript: fullTranscript });

    } catch (error) {
        logger.error({ 
            error: error.message, 
            stack: error.stack,
            details: error.response || error.cause || error 
        }, 'Speechmatics transcription error');
        
        res.status(500).json({ 
            error: 'Failed to transcribe audio.', 
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
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
        res.json({ user: null });
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
            : buildDepartmentAccessQuery();
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
            const hasAccess = await hasDepartmentAccess(department_id, req.session.user.id);
            if (!hasAccess) {
                logger.warn(`User ${req.session.user.id} attempted to access chat in unauthorized department ${department_id}`);
                return res.status(403).json({ error: 'Forbidden: You do not have access to this department.' });
            }
        }

        const { rows } = await pool.query(
            'SELECT id, name, hashed_password FROM chats WHERE department_id = $1 AND name = $2',
            [department_id, name]
        );
        const chat = rows[0];
        if (!chat) {
            logger.warn({ chatName: name, departmentId: department_id }, 'Chat login failed: Chat not found');
            return res.status(401).json({ error: 'Invalid chat or password' });
        }

        const passwordMatches = await bcrypt.compare(password, chat.hashed_password);
        if (!passwordMatches) {
            logger.warn({ chatId: chat.id, chatName: name }, 'Chat login failed: Incorrect password');
            return res.status(401).json({ error: 'Invalid chat or password' });
        }
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
            const hasAccess = await hasDepartmentAccess(department_id, user.id);
            if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
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

app.post('/api/chats/:id/exports/vsdx', isAuthenticated, validateBody(vsdxExportSchema), async (req, res) => {
    const { id } = req.params;
    if (!(await checkChatAccess(id, req.session.user, res))) return;

    try {
        const fileBuffer = await createVsdxFromBpmnXml(req.body.bpmn_xml);
        const { rows } = await pool.query('SELECT name FROM chats WHERE id = $1 LIMIT 1', [id]);
        const chatName = rows[0]?.name || 'business-process';
        const safeAsciiFileName = chatName
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'business-process';
        const encodedFileName = encodeURIComponent(`${chatName}.vsdx`);

        res.setHeader('Content-Type', 'application/vnd.ms-visio.drawing');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${safeAsciiFileName}.vsdx"; filename*=UTF-8''${encodedFileName}`
        );
        res.send(fileBuffer);
    } catch (error) {
        logger.error(error, 'Error exporting VSDX');
        res.status(500).json({ error: error.message || 'Failed to export VSDX' });
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
            return res.status(200).json(null);
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
        let latestApprovedProcessText = null;
        if (status === 'approved') {
            const latestVersionRes = await pool.query(
                'SELECT process_text FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
                [id]
            );
            const latestVersionTextRaw = latestVersionRes.rows[0]?.process_text || '';
            if (!latestVersionTextRaw.trim()) {
                return res.status(400).json({ error: '\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u043f\u0443\u0441\u0442\u043e\u0439 \u043f\u0440\u043e\u0446\u0435\u0441\u0441' });
            }
            latestApprovedProcessText = latestVersionTextRaw;
        }

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
                            department_id, chat_id, name, description, status, is_ai_generated
                        ) VALUES ($1, $2, $3, $4, 'approved', false)
                        ON CONFLICT (chat_id) DO UPDATE SET 
                            status = 'approved',
                            department_id = EXCLUDED.department_id,
                            name = EXCLUDED.name,
                            description = COALESCE(EXCLUDED.description, business_processes.description)
                    `, [chat.department_id, id, chat.name, latestApprovedProcessText]);
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
            return res.status(200).json(null);
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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

        const strictPrompt = `РўС‹ вЂ” СЌРєСЃРїРµСЂС‚ РїРѕ СЂР°СЃРєР»Р°РґРєРµ Р±РёР·РЅРµСЃ-РєР°СЂС‚.
Р Р°СЃСЃС‡РёС‚Р°Р№ layout СЃС‚СЂРѕРіРѕ РїРѕ СЃРµС‚РєРµ Miro-style Рё РІРµСЂРЅРё С‚РѕР»СЊРєРѕ РІР°Р»РёРґРЅС‹Р№ JSON.

РџСЂР°РІРёР»Р° СЂР°СЃРєР»Р°РґРєРё:
1. Р”РµРїР°СЂС‚Р°РјРµРЅС‚С‹ СЂР°СЃРїРѕР»Р°РіР°Р№ РїРѕ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё СЃ С€Р°РіРѕРј 300 РїРёРєСЃРµР»РµР№.
2. РЈ РІСЃРµС… РїСЂРѕС†РµСЃСЃРѕРІ РѕРґРЅРѕРіРѕ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р° РћР‘РЇР—РђРќРђ Р±С‹С‚СЊ РёРґРµРЅС‚РёС‡РЅР°СЏ РєРѕРѕСЂРґРёРЅР°С‚Р° X, СЂР°РІРЅР°СЏ X РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°.
3. РљРѕРѕСЂРґРёРЅР°С‚Р° Y РїСЂРѕС†РµСЃСЃРѕРІ: РЅР°С‡РёРЅР°РµС‚СЃСЏ РѕС‚ Y_dept + 100 Рё СѓРІРµР»РёС‡РёРІР°РµС‚СЃСЏ СЃ С€Р°РіРѕРј 120 (80 РІС‹СЃРѕС‚Р° + 40 РѕС‚СЃС‚СѓРї).
4. Р§Р°С‚С‹ (РµСЃР»Рё РµСЃС‚СЊ) СЂР°Р·РјРµС‰Р°Р№ РІ С‚РѕР№ Р¶Рµ РєРѕР»РѕРЅРєРµ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°, С‚Р°РєР¶Рµ РїРѕ С€Р°РіСѓ 120.
5. РќРµ СЃРѕР·РґР°РІР°Р№ РїРµСЂРµСЃРµС‡РµРЅРёР№ СѓР·Р»РѕРІ Рё РЅРµ РґРѕР±Р°РІР»СЏР№ РЅРѕРІС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё.

Р’С…РѕРґРЅС‹Рµ РґР°РЅРЅС‹Рµ:
${JSON.stringify(mapContext, null, 2)}

РћС‚РІРµС‚ СЃС‚СЂРѕРіРѕ РІ С„РѕСЂРјР°С‚Рµ:
{
  "layout": [
    { "id": "uuid", "type": "department", "x": 0, "y": 120 },
    { "id": "uuid", "type": "process", "x": 0, "y": 220 },
    { "id": "uuid", "type": "chat", "x": 0, "y": 340 }
  ]
}

РќРёРєР°РєРѕРіРѕ markdown, РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ РёР»Рё РїРѕСЏСЃРЅРµРЅРёР№. РўРѕР»СЊРєРѕ JSON.`;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: strictPrompt }] }] })
        }, {
            fetchImpl: fetch,
            retries: 2,
            timeoutMs: 15000,
            retryDelayMs: 300
        });

        const data = await apiResponse.json();
        let aiResult = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : null;

        if (!aiResult) throw new Error('Empty AI response');

        const aiPayload = aiResult.trim();
        let parsedLayout;
        try {
            const jsonMatch = aiPayload.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AI returned non-JSON layout payload');
            parsedLayout = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            throw new Error('Failed to parse AI layout: ' + parseError.message);
        }

        const validatedLayout = aiLayoutResponseSchema.parse(parsedLayout);
        return res.json(validatedLayout);
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

// --- DASHBOARD ENDPOINTS (ADMIN ONLY) ---
app.get('/api/dash/map', isAuthenticated, isAdmin, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const departmentsRes = await pool.query('SELECT id, name, x, y FROM departments');
        const processesRes = await pool.query('SELECT id, name, status, department_id, description, x, y FROM business_processes');
        const relationsRes = await pool.query('SELECT id, source_process_id, target_process_id, relation_type FROM process_relations');
        const chatsRes = await pool.query(`
            SELECT c.id, c.name, c.department_id, c.x, c.y, cs.status,
                   (SELECT process_text FROM process_versions pv WHERE pv.chat_id = c.id ORDER BY created_at DESC LIMIT 1) as description
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
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }

    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Дашборд процессов</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body { margin: 0; font-family: "Manrope", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; background: #f8fafc; overflow: hidden; color: #1e293b; }
        #cy {
            width: 100vw;
            height: 100vh;
            display: block;
            z-index: 1;
            background-image: radial-gradient(#cbd5e1 1.5px, transparent 1.5px);
            background-size: 30px 30px;
        }
        .overlay-layer {
            position: absolute;
            inset: 0;
            z-index: 100;
            pointer-events: none;
        }
        .overlay-layer .overlay-interactive {
            pointer-events: auto;
        }
        .overlay-panel {
            position: absolute;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
            color: #334155;
        }
        .overlay-header {
            top: 20px;
            left: 20px;
            padding: 15px 25px;
        }
        .overlay-header h1 { margin: 0; font-size: 18px; color: #0f172a; font-weight: 700; }
        .overlay-header p { margin: 5px 0 0; font-size: 13px; color: #64748b; }
        .btn-controls {
            top: 20px;
            right: 20px;
            padding: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .legend {
            bottom: 20px;
            right: 20px;
            padding: 15px;
            font-size: 13px;
            max-height: 30vh;
            overflow-y: auto;
        }
        .legend h4 { margin: 0 0 12px 0; font-size: 14px; color: #1e293b; }
        .legend-item { display: flex; align-items: center; margin-bottom: 8px; }
        .legend-item:last-child { margin-bottom: 0; }
        .legend-swatch { display: inline-block; width: 16px; height: 16px; margin-right: 10px; border-radius: 4px; border: 2px solid transparent; }
        .legend-swatch.status-approved { background-color: #ecfdf5; border-color: #10b981; }
        .legend-swatch.status-draft { background-color: #fffbeb; border-color: #f59e0b; }
        .legend-swatch.status-needs_revision { background-color: #fef2f2; border-color: #ef4444; }
        .legend-swatch.status-chat { background-color: #f0f9ff; border: 2px dashed #0ea5e9; }
        .legend-divider { margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        button {
            padding: 8px 16px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
            font-weight: 600;
            color: #475569;
            transition: all 0.2s;
        }
        button:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08); color: #0f172a; }
        button:active { transform: scale(0.98); }
        #dash-search { padding: 8px 14px; border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 8px; outline: none; font-family: inherit; font-size: 14px; width: 220px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); }
        #dash-search:focus { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
        .side-panel {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 380px;
            max-height: calc(100vh - 40px);
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
            z-index: 100;
            border: 1px solid rgba(226, 232, 240, 0.8);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.25s ease, opacity 0.25s ease;
        }
        .side-panel.is-hidden {
            transform: translateX(120%);
            opacity: 0;
            pointer-events: none;
        }
        .side-panel-header { padding: 15px 20px; border-bottom: 1px solid rgba(226, 232, 240, 0.8); display: flex; justify-content: space-between; align-items: center; background: transparent; font-weight: bold; color: #0f172a; font-size: 16px; }
        .side-panel-content { padding: 20px; overflow-y: auto; font-size: 14px; color: #334155; line-height: 1.5; }
        .side-panel-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 0; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; }
        .side-panel-close:hover { color: #0f172a; background: #e2e8f0; }
        .markdown-body { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px; font-family: "Manrope", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; font-size: 13px; }
        .markdown-body p { margin-top: 0; }
        .process-detail-item { margin-bottom: 12px; }
        .process-detail-item label { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .process-detail-item .value { font-size: 14px; color: #1e293b; font-weight: 600; }
    </style>
</head>
<body>
    <div id="cy"></div>
    <div class="overlay-layer">
        <div class="overlay-panel overlay-header">
            <h1>Карта бизнес-процессов</h1>
            <p>Режим чтения</p>
        </div>
        <div class="overlay-panel btn-controls overlay-interactive">
            <input type="text" id="dash-search" placeholder="Поиск процессов...">
            <button id="btn-toggle-collapse">Свернуть все</button>
            <button id="btn-fit">По размеру экрана</button>
            <button id="btn-zoom-in">+</button>
            <button id="btn-zoom-out">-</button>
        </div>
        <div class="overlay-panel legend">
            <h4>Легенда статусов</h4>
            <div class="legend-item"><span class="legend-swatch status-approved"></span> Утвержден</div>
            <div class="legend-item"><span class="legend-swatch status-draft"></span> Черновик</div>
            <div class="legend-item"><span class="legend-swatch status-needs_revision"></span> Нужны правки</div>
            <div class="legend-item legend-divider"><span class="legend-swatch status-chat"></span> Чат</div>
        </div>
    </div>
    <div id="dash-side-panel" class="side-panel is-hidden">
        <div class="side-panel-header">
            <span id="dash-panel-title">Информация</span>
            <button id="dash-panel-close" class="side-panel-close">✕</button>
        </div>
        <div id="dash-panel-content" class="side-panel-content"></div>
    </div>
    <script src="/dash.js?v=6"></script>
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

app.put('/api/admin/departments/:id/position', isAuthenticated, isAdmin, validateBody(departmentPositionSchema), async (req, res) => {
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

app.put('/api/admin/map/positions/bulk', isAuthenticated, isAdmin, validateBody(bulkPositionSchema), async (req, res) => {
    const { departments = [], processes = [], chats = [] } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        for (const dept of departments) {
            await client.query('UPDATE departments SET x = $1, y = $2 WHERE id = $3', [dept.x, dept.y, dept.id]);
        }
        for (const proc of processes) {
            await client.query('UPDATE business_processes SET x = $1, y = $2 WHERE id = $3', [proc.x, proc.y, proc.id]);
        }
        for (const chat of chats) {
            await client.query('UPDATE chats SET x = $1, y = $2 WHERE id = $3', [chat.x, chat.y, chat.id]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(error, 'Error during bulk position update');
        res.status(500).json({ error: 'Failed to update positions in bulk.' });
    } finally {
        client.release();
    }
});

app.post('/api/admin/relations', isAuthenticated, isAdmin, validateBody(relationSchema), async (req, res) => {
    const { source_process_id, target_process_id, relation_type } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO process_relations (source_process_id, target_process_id, relation_type, is_manual) VALUES ($1, $2, $3, $4) RETURNING *',
            [source_process_id, target_process_id, relation_type || 'Р СѓС‡РЅР°СЏ СЃРІСЏР·СЊ', true]
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
        const { rowCount } = await pool.query('DELETE FROM business_processes WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Process not found' });
        }
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
        const { rowCount } = await pool.query('DELETE FROM departments WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
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
    let inTransaction = false;
    try {
        await pool.query('BEGIN');
        inTransaction = true;
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
                                [procMap[proc.name], targetId, 'РЎРІСЏР·Р°РЅРѕ РР']
                            );
                        }
                    }
                }
            }
        }
        await pool.query('COMMIT');
        inTransaction = false;

        res.json({ message: 'Parsed and integrated successfully', parsed: resultJSON });
    } catch (error) {
        if (inTransaction) {
            try {
                await pool.query('ROLLBACK');
            } catch (rollbackError) {
                logger.error(rollbackError, 'Rollback failed after document parse error');
            }
        }
        logger.error(error, 'Document parse error');
        res.status(500).json({ error: error.message });
    } finally {
        await Promise.all((req.files || []).map(async (file) => {
            try {
                await fs.promises.unlink(file.path);
            } catch (unlinkError) {
                logger.error(unlinkError, `Failed to remove temporary upload ${file.path}`);
            }
        }));
    }
});

app.post('/api/admin/audit', isAuthenticated, isAdmin, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const bpRes = await pool.query("SELECT name, department_id, description FROM business_processes WHERE status = 'approved'");
        const globalContext = bpRes.rows.map(r => `РџСЂРѕС†РµСЃСЃ: ${r.name} (Dept: ${r.department_id})\nРћРїРёСЃР°РЅРёРµ: ${r.description || 'РќРµС‚'}`).join('\n\n');

        const fullPrompt = `РўС‹ вЂ” СЌР»РёС‚РЅС‹Р№ Р±РёР·РЅРµСЃ-Р°СЂС…РёС‚РµРєС‚РѕСЂ Рё РР Р°СѓРґРёС‚РѕСЂ. РўРІРѕСЏ Р·Р°РґР°С‡Р°: РїСЂРѕРІРµСЃС‚Рё Р°РЅР°Р»РёР· РїСЂРµРґРѕСЃС‚Р°РІР»РµРЅРЅРѕР№ Р±Р°Р·С‹ СѓС‚РІРµСЂР¶РґРµРЅРЅС‹С… РїСЂРѕС†РµСЃСЃРѕРІ СЃРѕРіР»Р°СЃРЅРѕ РїСЂРѕРјРїС‚Сѓ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.
Р‘РђР—Рђ РџР РћР¦Р•РЎРЎРћР’:
${globalContext}

РџР РћРњРџРў РђР”РњРРќРРЎРўР РђРўРћР Рђ:
${prompt}

РћС‚РІРµС‚СЊ СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅРѕ, СѓРєР°Р·С‹РІР°СЏ РЅР°Р№РґРµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹ РёР»Рё СЂРµР·СѓР»СЊС‚Р°С‚С‹ СЃРѕРіР»Р°СЃРЅРѕ Р·Р°РїСЂРѕСЃСѓ.`;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        }, {
            fetchImpl: fetch,
            retries: 2,
            timeoutMs: 15000,
            retryDelayMs: 300
        });

        const data = await apiResponse.json();
        const report = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : 'РћС€РёР±РєР° Р°СѓРґРёС‚Р°';

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

app.post('/api/generate', isAuthenticated, validateBody(generateSchema), async (req, res) => {
    const { prompt, chat_id } = req.body;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'API key is not configured' });

    try {
        let approvedProcesses = [];
        let initialTemplate = '';
        let latestVersion = '';

        if (chat_id) {
            if (!(await checkChatAccess(chat_id, req.session.user, res))) return;
            const chatRes = await pool.query('SELECT department_id FROM chats WHERE id = $1', [chat_id]);
            if (chatRes.rows.length > 0) {
                const dId = chatRes.rows[0].department_id;
                const bpRes = await pool.query(
                    "SELECT name, description FROM business_processes WHERE department_id = $1 AND status = 'approved'",
                    [dId]
                );
                approvedProcesses = bpRes.rows;
            }

            const initialRes = await pool.query(
                'SELECT content FROM initial_business_processes WHERE chat_id = $1',
                [chat_id]
            );
            initialTemplate = initialRes.rows[0]?.content || '';

            const latestVersionRes = await pool.query(
                'SELECT process_text FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
                [chat_id]
            );
            latestVersion = latestVersionRes.rows[0]?.process_text || '';
        }

        const finalPrompt = composeGeneratePrompt({
            userPrompt: prompt,
            approvedProcesses,
            initialTemplate,
            latestVersion
        });

        const apiResponse = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
        }, {
            fetchImpl: fetch,
            retries: 2,
            timeoutMs: 120000,
            retryDelayMs: 1000
        });
        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({}));
            logger.error({ 
                status: apiResponse.status, 
                errorData,
                prompt: finalPrompt.substring(0, 200) + '...' 
            }, 'Google API error in /api/generate');
            return res.status(apiResponse.status).json({ 
                error: 'Failed to fetch from Google API', 
                details: errorData 
            });
        }
        const data = await apiResponse.json();
        res.status(200).json(data);
    } catch (error) {
        logger.error({ 
            error: error.message, 
            stack: error.stack,
            chat_id 
        }, 'Internal error in /api/generate');
        res.status(500).json({ 
            error: 'An internal server error occurred.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
});
app.post('/api/chats/:id/validate', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { process_text } = req.body;
    if (!process_text) return res.status(400).json({ error: 'Process text required' });
    if (!(await checkChatAccess(id, req.session.user, res))) return;

    try {
        const bpRes = await pool.query("SELECT name, department_id FROM business_processes WHERE status = 'approved'");
        const globalContext = bpRes.rows.map(r => `${r.name} (Dept: ${r.department_id})`).join(', ');

        const prompt = `
РўС‹ РёРЅС‚РµР»Р»РµРєС‚СѓР°Р»СЊРЅС‹Р№ Copilot. РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ СЌС‚РѕС‚ Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃ РЅР° РїСЂРµРґРјРµС‚ Р»РѕРіРёС‡РµСЃРєРёС… РЅРµСЃС‚С‹РєРѕРІРѕРє Рё РЅР°СЂСѓС€РµРЅРёР№, СЃСЂР°РІРЅРёРІР°СЏ РµРіРѕ СЃ РіР»РѕР±Р°Р»СЊРЅРѕР№ РєР°СЂС‚РѕР№ СѓС‚РІРµСЂР¶РґРµРЅРЅС‹С… РїСЂРѕС†РµСЃСЃРѕРІ РєРѕРјРїР°РЅРёРё.
Р“Р›РћР‘РђР›Р¬РќРђРЇ РљРђР РўРђ: ${globalContext}

РўР•РљРЈР©РР™ РџР РћР¦Р•РЎРЎ РќРђ РџР РћР’Р•Р РљР•:
${process_text}

РћС‚РІРµС‚СЊ РєСЂР°С‚РєРѕ, РµСЃС‚СЊ Р»Рё РѕС€РёР±РєРё Р»РѕРіРёРєРё (РЅР°РїСЂРёРјРµСЂ, РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ С„СѓРЅРєС†РёР№ РёР»Рё РєРѕРЅС„Р»РёРєС‚ РїРѕР»РЅРѕРјРѕС‡РёР№). Р•СЃР»Рё РІСЃРµ РѕРє, РЅР°РїРёС€Рё 'РћС€РёР±РѕРє РЅРµ РЅР°Р№РґРµРЅРѕ'.
        `;

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const apiResponse = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }, {
            fetchImpl: fetch,
            retries: 2,
            timeoutMs: 15000,
            retryDelayMs: 300
        });

        const data = await apiResponse.json();
        const analysis = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : 'РћС€РёР±РѕРє РЅРµ РЅР°Р№РґРµРЅРѕ';

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
                    "INSERT INTO users (name, full_name, email, hashed_password, role) VALUES ('admin', 'Р“Р»Р°РІРЅС‹Р№ РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ', 'admin@bizpro.ai', $1, 'admin')",
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
            const config = createDatabaseConfig(process.env.DATABASE_URL, process.env.NODE_ENV, {
                databaseSsl: process.env.DATABASE_SSL,
                databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
                pgssl: process.env.PGSSL,
                pgsslRejectUnauthorized: process.env.PGSSLREJECTUNAUTHORIZED
            });
            pool = new Pool(config);
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




