const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const dns = require('dns').promises;
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const WebSocket = require('ws');
const revai = require('revai-node-sdk');
const multer = require('multer');
const { Readable } = require('stream');

const app = express();
app.set('trust proxy', 1); // Trust the first proxy
const PORT = process.env.PORT || 3000;

let pool;

// --- Multer Setup for audio upload ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// --- Middleware ---
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(session({
    store: new FileStore({ path: path.join(__dirname, 'sessions') }),
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

// --- Authorization Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized: You must be logged in.' });
};
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
};

// --- Transcription Endpoint ---
app.post('/api/transcribe', isAuthenticated, upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    if (!process.env.REV_AI_API_KEY) {
        return res.status(500).json({ error: 'Transcription service is not configured.' });
    }

    try {
        const revaiClient = new revai.RevAiApiClient({ token: process.env.REV_AI_API_KEY });
        const audioStream = Readable.from(req.file.buffer);

        // Submit the job
        const job = await revaiClient.submitJob(audioStream, {
            metadata: `Transcription for user ${req.session.user.id}`,
            delete_after_seconds: 3600, // Delete job after 1 hour
            language: 'ru' // Set language to Russian
        });

        console.log(`Submitted Rev.ai job: ${job.id}`);

        // Wait for the job to be transcribed
        const transcript = await revaiClient.getTranscriptObject(job.id);

        // Combine the transcript into a single string
        const fullTranscript = transcript.monologues
            .map(m => m.elements.map(e => e.value).join(''))
            .join(' ');

        res.json({ transcript: fullTranscript });

    } catch (error) {
        console.error('Rev.ai transcription error:', error);
        res.status(500).json({ error: 'Failed to transcribe audio.' });
    }
});

// --- Route Definitions ---
// (These handlers are defined now, but will only be called after the server starts and `pool` is initialized)
app.post('/api/auth/login', async (req, res) => {
    const { name, password } = req.body;
    console.log(`Login attempt for user: ${name}`);
    try {
        const result = await pool.query('SELECT id, name, hashed_password FROM users WHERE name = $1', [name]);
        const user = result.rows[0];
        if (!user) {
            console.log(`Login failed for user: ${name}. User not found.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const passwordMatches = await bcrypt.compare(password, user.hashed_password);
        if (!passwordMatches) {
            console.log(`Login failed for user: ${name}. Invalid password.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const role = user.name === 'admin' ? 'admin' : 'user';
        console.log(`Login successful for user: ${name}, role: ${role}`);
        req.session.user = { id: user.id, name: user.name, role: role };
        res.json({ id: user.id, name: user.name, role: role });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.name : 'Unknown user';
    req.session.destroy(err => {
        if (err) {
            console.error(`Logout error for user: ${userName}`, err);
            return res.status(500).json({ error: 'Could not log out, please try again.' });
        }
        res.clearCookie('connect.sid');
        console.log(`User ${userName} logged out successfully.`);
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

// ... (All other routes follow the same pattern)
// Admin: Get chats in review
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
        console.error('Error fetching chats in review:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get pending chats (draft or needs_revision)
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
        console.error('Error fetching pending chats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get chat status
app.get('/api/chats/:id/status', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT status FROM chat_statuses WHERE chat_id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Status not found' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching chat status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get all users
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name FROM users');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Create a new department
app.post('/api/departments', isAuthenticated, isAdmin, async (req, res) => {
    const { name, password, user_id } = req.body;
    if (!name || !password || !user_id) {
        return res.status(400).json({ error: 'Name, password, and user_id are required.' });
    }
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
        console.error('Error creating department:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get departments
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
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update a department
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
        console.error('Error updating department:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Admin: Get completed chats
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
        console.error('Error fetching completed chats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat authentication
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
        console.error('Error during chat authentication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all chats for a department
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
        console.error('Error fetching chats for department:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new chat
app.post('/api/chats', isAuthenticated, isAdmin, async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const { rows } = await pool.query("SELECT * FROM create_chat_with_status($1, $2, $3)", [department_id, name, hashedPassword]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating chat with RPC:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Get all versions for a chat
app.get('/api/chats/:id/versions', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC', [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new version for a chat
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

// Create a new comment for a chat
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

// Get transcription data for a chat
app.get('/api/chats/:id/transcription', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM transcription_data WHERE chat_id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transcription data not found for this chat.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(`Error fetching transcription data for chat ${id}:`, error);
        res.status(500).json({ error: 'Failed to retrieve transcription data.' });
    }
});

// Create or update transcription data for a chat
app.post('/api/chats/:id/transcription', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { transcribed_text, final_text, status } = req.body;

    // Basic validation
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
        console.error(`Error creating/updating transcription data for chat ${id}:`, error);
        res.status(500).json({ error: 'Failed to save transcription data.' });
    }
});

// Update chat status
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

// --- Helper Functions ---
const BCRYPT_SALT_ROUNDS = 10;
async function ensureUsersExist() {
    try {
        let { rows: adminRows } = await pool.query("SELECT id FROM users WHERE name = 'admin'");
        if (adminRows.length === 0) {
            console.log('Admin user not found, creating it...');
            const hashedPassword = await bcrypt.hash('adminpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('admin', $1)", [hashedPassword]);
            console.log('Admin user created.');
        }
        let { rows: userRows } = await pool.query("SELECT id FROM users WHERE name = 'user'");
        if (userRows.length === 0) {
            console.log('Regular user not found, creating it...');
            const hashedPassword = await bcrypt.hash('userpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('user', $1)", [hashedPassword]);
            console.log('Regular user created.');
        }
    } catch (error) {
        console.error('Fatal error during initial user setup:', error);
        process.exit(1);
    }
}

// --- Server Startup Function ---
const startServer = async () => {
    try {
        if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.FRONTEND_URL) {
            throw new Error("DATABASE_URL, SESSION_SECRET, and FRONTEND_URL must be set.");
        }

        console.log('Initializing database connection...');
        const dbUrl = process.env.DATABASE_URL;
        const config = parse(dbUrl);

        console.log(`Looking up IPv4 address for host: ${config.host}`);
        const { address } = await dns.lookup(config.host, { family: 4 });
        console.log(`Resolved ${config.host} to ${address}`);

        pool = new Pool({
            ...config,
            host: address,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        const client = await pool.connect();
        console.log('Database connection successful.');
        client.release();

        const server = app.listen(PORT, async () => {
            console.log(`Server v2 is running on port ${PORT}`);
            if (process.env.NODE_ENV !== 'test') {
                await ensureUsersExist();
            }
        });

        return { app, server, pool };

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

module.exports = { app, startServer };
