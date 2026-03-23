/**
 * UI Manipulation & Notifications module
 */
import State from './state.js';

export const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Icon based on type
    const icon = type === 'success' ? '✅' : '❌';
    notification.innerHTML = `<span class="notification-icon">${icon}</span> <span class="notification-message">${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fading-out'); // Optional: CSS transition trigger
        setTimeout(() => notification.remove(), 500);
    }, 4500);
};

export const updateTimer = (seconds) => {
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

export const toggleLoading = (buttonId, isLoading, loadingText = 'Загрузка...') => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || 'Успешно';
    }
};

export const clearContainer = (id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
};

export const show = (idOrEl) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.classList.remove('hidden');
};

export const hide = (idOrEl) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.classList.add('hidden');
};
