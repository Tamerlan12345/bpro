
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const app = express();

const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey || !process.env.SESSION_SECRET) {
  console.error("Error: SUPABASE_URL, SUPABASE_SERVICE_KEY, and SESSION_SECRET must be set as environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS configuration must allow credentials
// The `origin` is set to `true` to reflect the request's origin (e.g., the URL in the browser).
// This is a flexible setting for deployments where the frontend URL isn't fixed.
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json()); 

// Session middleware
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

    const { data: user, error } = await supabase
        .from('users')
        .select('id, name, hashed_password')
        .eq('name', name)
        .single();

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.hashed_password);

    if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const role = user.name === 'admin' ? 'admin' : 'user';

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
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            // Handle error case
            return res.status(500).json({ error: 'Could not log out, please try again.' });
        }
        // Ensure the cookie is cleared
        res.clearCookie('connect.sid'); // Default name for express-session cookie
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
    const { data, error } = await supabase
        .from('chats')
        .select('id, name, chat_statuses!inner(status), departments(name)')
        .eq('chat_statuses.status', 'pending_review');

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Transform data to be consistent with other admin endpoints
    const transformedData = data.map(chat => ({
        chat_id: chat.id,
        status: chat.chat_statuses.status,
        chats: {
            name: chat.name
        },
        departments: {
            name: chat.departments ? chat.departments.name : 'No Department'
        }
    }));

    res.json(transformedData);
});

// Admin: Get pending chats (draft or needs_revision)
app.get('/api/admin/chats/pending', isAuthenticated, isAdmin, async (req, res) => {
    // Убираем зависимость от department_id для общего обзора администратора
    const { data, error } = await supabase
        .from('chats')
        .select('id, name, chat_statuses!inner(status), departments(name)') // Добавляем название департамента для контекста
        .or('status.eq.draft,status.eq.needs_revision', { referencedTable: 'chat_statuses' });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Transform data to be consistent with other admin endpoints
    const transformedData = data.map(chat => ({
        chat_id: chat.id,
        status: chat.chat_statuses.status,
        chats: {
            name: chat.name
        },
        departments: {
            name: chat.departments ? chat.departments.name : 'No Department'
        }
    }));

    res.json(transformedData);
});

// Get chat status
app.get('/api/chats/:id/status', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('chat_statuses')
        .select('status')
        .eq('chat_id', id)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: 'Status not found' });
    }
    res.json(data);
});

// Admin: Get all users (for assigning departments)
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name');
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});


// Admin: Create a new department
app.post('/api/departments', isAuthenticated, isAdmin, async (req, res) => {
    const { name, password, user_id } = req.body;
    if (!name || !password || !user_id) {
        return res.status(400).json({ error: 'Name, password, and user_id are required.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
        .from('departments')
        .insert([{ name, hashed_password: hashedPassword, user_id: user_id }])
        .select();

    if (error) {
        // Check for unique constraint violation on (user_id, name)
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'This department name already exists for the selected user.' });
        }
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

// Get departments: for admin gets all, for user gets their own
app.get('/api/departments', isAuthenticated, async (req, res) => {
    const { user } = req.session;
    let query = supabase.from('departments').select('id, name, user_id');

    if (user.role !== 'admin') {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Admin: Update a department
app.put('/api/departments/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, password } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
    }

    const updateData = { name };

    if (password) {
        const salt = await bcrypt.genSalt(10);
        updateData.hashed_password = await bcrypt.hash(password, salt);
    }

    const { data, error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating department:', error);
        return res.status(500).json({ error: error.message });
    }

    res.json(data);
});

// Admin: Get completed chats
app.get('/api/admin/chats/completed', isAuthenticated, isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('chats')
        .select('id, name, chat_statuses!inner(status), departments(name)')
        .in('chat_statuses.status', ['completed', 'archived']);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Transform data to be consistent with other admin endpoints
    const transformedData = data.map(chat => ({
        chat_id: chat.id,
        status: chat.chat_statuses.status,
        chats: {
            name: chat.name
        },
        departments: {
            name: chat.departments ? chat.departments.name : 'No Department'
        }
    }));
    res.json(transformedData);
});

// Chat authentication - This is for a specific chat password, separate from department login
app.post('/api/auth/chat', isAuthenticated, async (req, res) => {
    const { department_id, name, password } = req.body;
    const { data: chat, error } = await supabase
        .from('chats')
        .select('id, name, hashed_password')
        .eq('department_id', department_id)
        .eq('name', name)
        .single();

    if (error || !chat) {
        return res.status(401).json({ error: 'Invalid chat or password' });
    }

    const passwordMatches = await bcrypt.compare(password, chat.hashed_password);

    if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid chat or password' });
    }

    res.json({ id: chat.id, name: chat.name });
});

// Get all chats for a department
app.get('/api/chats', isAuthenticated, async (req, res) => {
    const { department_id } = req.query;
    const { user } = req.session;

    if (!department_id) {
        return res.status(400).json({ error: 'department_id query parameter is required.' });
    }

    // Security check:
    // 1. Admins can see chats for any department.
    // 2. Regular users can only see chats from departments they own.
    if (user.role !== 'admin') {
        const { data: department, error: deptError } = await supabase
            .from('departments')
            .select('id')
            .eq('id', department_id)
            .eq('user_id', user.id)
            .single();

        if (deptError || !department) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this department\'s chats.' });
        }
    }

    // If the check passes, fetch the chats.
    const { data, error } = await supabase
        .from('chats')
        .select('id, name, chat_statuses(status)')
        .eq('department_id', department_id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Create a new chat (must be admin to create a chat for a department)
app.post('/api/chats', isAuthenticated, isAdmin, async (req, res) => {
    const { department_id, name, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Call the RPC function to create the chat and its status in one transaction
    const { data: chatData, error } = await supabase.rpc('create_chat_with_status', {
        department_id_arg: department_id,
        name_arg: name,
        hashed_password_arg: hashedPassword
    }).single();

    if (error) {
        console.error('Error creating chat with RPC:', error);
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json(chatData);
});

// Middleware to check if a user has permission to edit a chat
const checkChatPermission = async (req, res, next) => {
    const { id: chatId } = req.params;
    const userRole = req.session.user.role;

    const { data: statusData, error } = await supabase
        .from('chat_statuses')
        .select('status')
        .eq('chat_id', chatId)
        .single();

    if (error || !statusData) {
        return res.status(404).json({ error: 'Chat not found' });
    }

    const { status } = statusData;

    let canEdit = false;
    if (userRole === 'user') {
        // Users can edit drafts or chats needing revision
        canEdit = (status === 'draft' || status === 'needs_revision');
    } else if (userRole === 'admin') {
        // Admins can edit any chat unless it is completed or archived
        canEdit = (status !== 'completed' && status !== 'archived');
    }

    if (!canEdit) {
        return res.status(403).json({ error: 'You do not have permission to edit this chat in its current state.' });
    }

    next();
};

// Get all versions for a chat
app.get('/api/chats/:id/versions', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('process_versions')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Create a new version for a chat
app.post('/api/chats/:id/versions', isAuthenticated, checkChatPermission, async (req, res) => {
    const { id } = req.params;
    const { process_text, mermaid_code } = req.body;
    const { data, error } = await supabase
        .from('process_versions')
        .insert([{ chat_id: id, process_text, mermaid_code }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

// Get all comments for a chat
app.get('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Create a new comment for a chat
app.post('/api/chats/:id/comments', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    // The author's role is now determined by the session, not the request body
    const author_role = req.session.user.role;

    const { data, error } = await supabase
        .from('comments')
        .insert([{ chat_id: id, author_role, text }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

const checkStatusChangePermission = async (req, res, next) => {
    const { id: chatId } = req.params;
    const { status: newStatus } = req.body;
    const userRole = req.session.user.role;

    if (!newStatus) {
        return res.status(400).json({ error: 'New status is required.' });
    }

    const { data: statusData, error } = await supabase
        .from('chat_statuses')
        .select('status')
        .eq('chat_id', chatId)
        .single();

    if (error || !statusData) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    const { status: currentStatus } = statusData;

    let canChange = false;
    if (userRole === 'user') {
        // User can submit a draft or revision for review
        if ((currentStatus === 'draft' || currentStatus === 'needs_revision') && newStatus === 'pending_review') {
            canChange = true;
        }
    } else if (userRole === 'admin') {
        // Admin can approve or reject a submission
        if (currentStatus === 'pending_review' && (newStatus === 'needs_revision' || newStatus === 'completed')) {
            canChange = true;
        }
        // Admin can only archive a completed chat
        if (currentStatus === 'completed' && newStatus === 'archived') {
            canChange = true;
        }
    }

    if (!canChange) {
        return res.status(403).json({ error: `User role '${userRole}' cannot change status from '${currentStatus}' to '${newStatus}'` });
    }

    next();
};

// Update chat status
app.put('/api/chats/:id/status', isAuthenticated, checkStatusChangePermission, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { data, error } = await supabase
        .from('chat_statuses')
        .update({ status: status })
        .eq('chat_id', id)
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
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
        let { data: adminUser, error: adminError } = await supabase
            .from('users').select('id').eq('name', 'admin').single();

        if (adminError && adminError.code === 'PGRST116') { // Not found
            console.log('Admin user not found, creating it...');
            const hashedPassword = await bcrypt.hash('adminpassword', BCRYPT_SALT_ROUNDS);
            const { error: insertAdminError } = await supabase.from('users').insert({ name: 'admin', hashed_password: hashedPassword });
            if (insertAdminError) throw insertAdminError;
            console.log('Admin user created.');
        } else if (adminError) throw adminError;

        // Check for regular user
        let { data: regularUser, error: userError } = await supabase
            .from('users').select('id').eq('name', 'user').single();

        if (userError && userError.code === 'PGRST116') { // Not found
            console.log('Regular user not found, creating it...');
            const hashedPassword = await bcrypt.hash('userpassword', BCRYPT_SALT_ROUNDS);
            const { error: insertUserError } = await supabase.from('users').insert({ name: 'user', hashed_password: hashedPassword });
            if (insertUserError) throw insertUserError;
            console.log('Regular user created.');
        } else if (userError) throw userError;

    } catch (error) {
        console.error('Fatal error during initial user setup:', error);
        process.exit(1); // Exit if we can't set up users
    }
}

const server = app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Ensure the initial users exist in the database on server startup
    await ensureUsersExist();
});

module.exports = { app, server };
