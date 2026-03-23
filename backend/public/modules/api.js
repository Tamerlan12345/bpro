/**
 * API Communication module
 */
import State from './state.js';
import { showNotification } from './ui.js';

const apiFetch = async (url, options = {}) => {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': State.csrfToken
    };

    const finalOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        },
        credentials: 'include'
    };

    try {
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `API Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        showNotification(error.message, 'error');
        throw error;
    }
};

export const fetchCsrfToken = async () => {
    try {
        const response = await fetch('/api/csrf-token');
        if (response.ok) {
            const data = await response.json();
            State.csrfToken = data.csrfToken;
            return data.csrfToken;
        }
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
    return null;
};

export const checkSession = () => apiFetch('/api/auth/session');

export const login = (email, password) => apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
});

export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' });

export const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': State.csrfToken
        },
        body: formData
    });
    
    if (!response.ok) throw new Error('Transcription failed');
    return await response.json();
};

export const generateProcessArtifacts = async (processDescription) => {
    const prompt = `Ты — элитный бизнес-аналитик и эксперт по BPMN. Твоя задача — взять сырое описание процесса от пользователя и превратить его в два артефакта:
1.  Структурированное описание шагов бизнес-процесса в формате Markdown.
2.  Код диаграммы в строгом стандарте BPMN 2.0 XML.

ФОРМАТ ОТВЕТА (JSON):
{
"standardDescription": "...", 
"mermaidCode": "..." 
}

ИСХОДНЫЙ ПРОЦЕСС:
"${processDescription}"`;

    const data = await apiFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt })
    });

    const responseText = data.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Не удалось получить JSON от AI");
    return JSON.parse(jsonMatch[0]);
};

export const generateDiagramFromText = async (processDescription) => {
    const prompt = `Ты — элитный бизнес-аналитик. Создай код BPMN 2.0 XML для процесса:
"${processDescription}"
Верни ТОЛЬКО XML код.`;

    const data = await apiFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt })
    });

    const code = data.candidates[0].content.parts[0].text;
    return code.replace(/```xml/g, '').replace(/```/g, '').trim();
};

export const getDepartments = () => apiFetch('/api/departments');
export const getChats = (deptId) => apiFetch(`/api/chats?department_id=${deptId}`);
export const getComments = (chatId) => apiFetch(`/api/chats/${chatId}/comments`);
export const postComment = (chatId, content) => apiFetch(`/api/chats/${chatId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content })
});

// ... more API methods as needed
