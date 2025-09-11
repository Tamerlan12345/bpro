
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const app = express();

const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json()); 
app.use(express.static('public'));



// Department authentication
app.post('/api/auth/department', async (req, res) => {
    const { name, password } = req.body;

    const { data: department, error } = await supabase
        .from('departments')
        .select('id, name, hashed_password')
        .eq('name', name)
        .single();

    if (error || !department) {
        return res.status(401).json({ error: 'Invalid department or password' });
    }

    const passwordMatches = await bcrypt.compare(password, department.hashed_password);

    if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid department or password' });
    }

    res.json({ id: department.id, name: department.name });
});

// Admin: Get chats in review
app.get('/api/admin/chats/in_review', async (req, res) => {
    const { data, error } = await supabase
        .from('chat_statuses')
        .select('*, chats(*)')
        .eq('status', 'in_review');

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Admin: Create a new department
// TODO: Add a middleware to check if the user is an admin
app.post('/api/departments', async (req, res) => {
    const { name, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
        .from('departments')
        .insert([{ name, hashed_password: hashedPassword }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

// Admin: Get all departments
app.get('/api/departments', async (req, res) => {
    const { data, error } = await supabase
        .from('departments')
        .select('id, name');

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Admin: Get completed chats
app.get('/api/admin/chats/completed', async (req, res) => {
    const { data, error } = await supabase
        .from('chat_statuses')
        .select('*, chats(*)')
        .eq('status', 'completed');

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Chat authentication
app.post('/api/auth/chat', async (req, res) => {
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
app.get('/api/chats', async (req, res) => {
    const { department_id } = req.query;
    const { data, error } = await supabase
        .from('chats')
        .select('id, name')
        .eq('department_id', department_id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Create a new chat
app.post('/api/chats', async (req, res) => {
    const { department_id, name, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert([{ department_id, name, hashed_password: hashedPassword }])
        .select()
        .single();

    if (chatError) {
        return res.status(500).json({ error: chatError.message });
    }

    const { error: statusError } = await supabase
        .from('chat_statuses')
        .insert([{ chat_id: chatData.id, status: 'draft' }]);

    if (statusError) {
        // Here you might want to delete the chat that was just created
        return res.status(500).json({ error: statusError.message });
    }

    res.status(201).json(chatData);
});

// Get all versions for a chat
app.get('/api/chats/:id/versions', async (req, res) => {
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
app.post('/api/chats/:id/versions', async (req, res) => {
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
app.get('/api/chats/:id/comments', async (req, res) => {
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
app.post('/api/chats/:id/comments', async (req, res) => {
    const { id } = req.params;
    const { author_role, text } = req.body;
    const { data, error } = await supabase
        .from('comments')
        .insert([{ chat_id: id, author_role, text }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

// Update chat status
app.put('/api/chats/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, user_seen, admin_seen } = req.body;
    const { data, error } = await supabase
        .from('chat_statuses')
        .upsert({ chat_id: id, status, user_seen, admin_seen })
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.post('/api/generate', async (req, res) => {
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


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
