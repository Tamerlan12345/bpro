if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { Pool } = require('pg'); // Changed from supabase
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const app = express();

const PORT = process.env.PORT || 3000;

// Changed from supabase to standard postgres env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});


// Validate environment variables
if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.FRONTEND_URL) {
  console.error("Error: DATABASE_URL, SESSION_SECRET, and FRONTEND_URL must be set as environment variables.");
  process.exit(1);
}


app.use(express.json());

// CORS configuration must be placed before session middleware and routes.
// It must explicitly trust the frontend origin to allow cookies to be sent.
app.use(cors({
    origin: process.env.FRONTEND_URL, // Use the specific frontend URL
    credentials: true
}));

// Session middleware must be configured after CORS to ensure cookies are handled correctly.
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions')
    }),
    // The secret is stored in an environment variable for security.
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Only save sessions when data is added
    cookie: {
        httpOnly: true, // Prevent client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site cookies in prod
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.static('public'));


// --- Authorization Middleware ---

// Checks if a user is authenticated (logged in)
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized: You must be logged in.' });
};

// Checks if a user is an administrator
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
};


// --- User Authentication ---

// New User Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { name, password } = req.body;
    console.log(`Login attempt for user: ${name}`); // Added logging

    try {
        const result = await pool.query('SELECT id, name, hashed_password FROM users WHERE name = $1', [name]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Login failed for user: ${name}. User not found.`); // Added logging
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const passwordMatches = await bcrypt.compare(password, user.hashed_password);

        if (!passwordMatches) {
            console.log(`Login failed for user: ${name}. Invalid password.`); // Added logging
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const role = user.name === 'admin' ? 'admin' : 'user';
        console.log(`Login successful for user: ${name}, role: ${role}`); // Added logging

        // Store user information in the session
        req.session.user = {
            id: user.id,
            name: user.name,
            role: role,
        };

        // Return user info, including the role
        res.json({
            id: user.id,
            name: user.name,
            role: role
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.name : 'Unknown user';
    req.session.destroy(err => {
        if (err) {
            // Handle error case
            console.error(`Logout error for user: ${userName}`, err);
            return res.status(500).json({ error: 'Could not log out, please try again.' });
        }
        // Ensure the cookie is cleared
        res.clearCookie('connect.sid'); // Default name for express-session cookie
        console.log(`User ${userName} logged out successfully.`);
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// Get current session status
app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ user: null });
    }
});

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
            chats: {
                name: chat.name
            },
            departments: {
                name: chat.department_name || 'No Department'
            }
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
            chats: {
                name: chat.name
            },
            departments: {
                name: chat.department_name || 'No Department'
            }
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
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Status not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching chat status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get all users (for assigning departments)
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
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'This department name already exists for the selected user.' });
        }
        console.error('Error creating department:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get departments: for admin gets all, for user gets their own
app.get('/api/departments', isAuthenticated, async (req, res) => {
    const { user } = req.session;
    try {
        let query;
        const params = [];
        if (user.role === 'admin') {
            query = 'SELECT id, name, user_id FROM departments';
        } else {
            query = 'SELECT id, name, user_id FROM departments WHERE user_id = $1';
            params.push(user.id);
        }
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

    if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
    }

    try {
        const updates = [];
        const params = [id];
        let paramIndex = 2;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push(`hashed_password = $${paramIndex++}`);
            params.push(hashedPassword);
        }

        const query = `UPDATE departments SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const { rows } = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
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
            chats: {
                name: chat.name
            },
            departments: {
                name: chat.department_name || 'No Department'
            }
        }));
        res.json(transformedData);
    } catch (error) {
        console.error('Error fetching completed chats:', error);
        res.status(500).json({ error: error.message });
    }
});


// Chat authentication - This is for a specific chat password, separate from department login
app.post('/api/auth/chat', isAuthenticated, async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT id, name, hashed_password FROM chats WHERE department_id = $1 AND name = $2',
            [department_id, name]
        );
        const chat = rows[0];

        if (!chat) {
            return res.status(401).json({ error: 'Invalid chat or password' });
        }

        const passwordMatches = await bcrypt.compare(password, chat.hashed_password);

        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid chat or password' });
        }

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

    if (!department_id) {
        return res.status(400).json({ error: 'department_id query parameter is required.' });
    }

    try {
        // Security check:
        if (user.role !== 'admin') {
            const { rows } = await pool.query(
                'SELECT id FROM departments WHERE id = $1 AND user_id = $2',
                [department_id, user.id]
            );
            if (rows.length === 0) {
                return res.status(403).json({ error: 'Forbidden: You do not have access to this department\'s chats.' });
            }
        }

        // If the check passes, fetch the chats.
        const query = `
            SELECT c.id, c.name, cs.status
            FROM chats c
            LEFT JOIN chat_statuses cs ON c.id = cs.chat_id
            WHERE c.department_id = $1
        `;
        const { rows } = await pool.query(query, [department_id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching chats for department:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new chat (must be admin to create a chat for a department)
app.post('/api/chats', isAuthenticated, isAdmin, async (req, res) => {
    const { department_id, name, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Call the RPC function to create the chat and its status in one transaction
        const { rows } = await pool.query(
            "SELECT * FROM create_chat_with_status($1, $2, $3)",
            [department_id, name, hashedPassword]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating chat with RPC:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Middleware to check if a user has permission to edit a chat
const checkChatPermission = async (req, res, next) => {
    const { id: chatId } = req.params;
    const userRole = req.session.user.role;

    try {
        const { rows } = await pool.query('SELECT status FROM chat_statuses WHERE chat_id = $1', [chatId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        const { status } = rows[0];

        let canEdit = false;
        if (userRole === 'user') {
            canEdit = (status === 'draft' || status === 'needs_revision');
        } else if (userRole === 'admin') {
            canEdit = (status !== 'completed' && status !== 'archived');
        }

        if (!canEdit) {
            return res.status(403).json({ error: 'You do not have permission to edit this chat in its current state.' });
        }

        next();
    } catch (error) {
        console.error('Error checking chat permission:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all versions for a chat
app.get('/api/chats/:id/versions', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM process_versions WHERE chat_id = $1 ORDER BY created_at DESC',
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching process versions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new version for a chat
app.post('/api/chats/:id/versions', isAuthenticated, checkChatPermission, async (req, res) => {
    const { id } = req.params;
    const { process_text, mermaid_code } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO process_versions (chat_id, process_text, mermaid_code) VALUES ($1, $2, $3) RETURNING *',
            [id, process_text, mermaid_code]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating process version:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all comments for a chat
app.get('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM comments WHERE chat_id = $1 ORDER BY created_at ASC',
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new comment for a chat
app.post('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const author_role = req.session.user.role;

    try {
        const { rows } = await pool.query(
            'INSERT INTO comments (chat_id, author_role, text) VALUES ($1, $2, $3) RETURNING *',
            [id, author_role, text]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: error.message });
    }
});

const checkStatusChangePermission = async (req, res, next) => {
    const { id: chatId } = req.params;
    const { status: newStatus } = req.body;
    const userRole = req.session.user.role;

    if (!newStatus) {
        return res.status(400).json({ error: 'New status is required.' });
    }

    try {
        const { rows } = await pool.query('SELECT status FROM chat_statuses WHERE chat_id = $1', [chatId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        const { status: currentStatus } = rows[0];

        let canChange = false;
        if (userRole === 'user') {
            if ((currentStatus === 'draft' || currentStatus === 'needs_revision') && newStatus === 'pending_review') {
                canChange = true;
            }
        } else if (userRole === 'admin') {
            if (currentStatus === 'pending_review' && (newStatus === 'needs_revision' || newStatus === 'completed')) {
                canChange = true;
            }
            if (currentStatus === 'completed' && newStatus === 'archived') {
                canChange = true;
            }
        }

        if (!canChange) {
            return res.status(403).json({ error: `User role '${userRole}' cannot change status from '${currentStatus}' to '${newStatus}'` });
        }

        next();
    } catch (error) {
        console.error('Error checking status change permission:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update chat status
app.put('/api/chats/:id/status', isAuthenticated, checkStatusChangePermission, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const { rows } = await pool.query(
            'UPDATE chat_statuses SET status = $1 WHERE chat_id = $2 RETURNING *',
            [status, id]
        );
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating chat status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate', isAuthenticated, async (req, res) => {
  const { prompt } = req.body;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;


  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY is not set!');
    return res.status(500).json({ error: 'API key is not configured on the server' });
  }

  try {
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('Google API Error:', errorData);
      return res.status(apiResponse.status).json({ error: 'Failed to fetch from Google API', details: errorData });
    }

    const data = await apiResponse.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


const BCRYPT_SALT_ROUNDS = 10;

// Function to seed the database with initial users if they don't exist
async function ensureUsersExist() {
    try {
        // Check for admin user
        let { rows: adminRows } = await pool.query("SELECT id FROM users WHERE name = 'admin'");

        if (adminRows.length === 0) {
            console.log('Admin user not found, creating it...');
            const hashedPassword = await bcrypt.hash('adminpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('admin', $1)", [hashedPassword]);
            console.log('Admin user created.');
        }

        // Check for regular user
        let { rows: userRows } = await pool.query("SELECT id FROM users WHERE name = 'user'");

        if (userRows.length === 0) {
            console.log('Regular user not found, creating it...');
            const hashedPassword = await bcrypt.hash('userpassword', BCRYPT_SALT_ROUNDS);
            await pool.query("INSERT INTO users (name, hashed_password) VALUES ('user', $1)", [hashedPassword]);
            console.log('Regular user created.');
        }

    } catch (error) {
        console.error('Fatal error during initial user setup:', error);
        process.exit(1); // Exit if we can't set up users
    }
}

const server = app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Ensure the initial users exist in the database on server startup
    if (process.env.NODE_ENV !== 'test') {
        await ensureUsersExist();
    }
});

module.exports = { app, server };
