/**
 * Main Application Module
 */
import State from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as admin from './admin.js';
import * as diagram from './diagram.js';
import * as audio from './audio.js';
import * as map from './map.js';

document.addEventListener('DOMContentLoaded', async () => {

    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // 1. Initial Security Setup
    await api.fetchCsrfToken();

    // 2. DOM Selection (Partial - we will move more over)
    const loginContainer = document.getElementById('login-container');
    const authWrapper = document.querySelector('.auth-wrapper');
    const userLogin = document.getElementById('user-login');
    const departmentSelection = document.getElementById('department-selection');
    const chatLogin = document.getElementById('chat-login');
    const adminPanel = document.getElementById('admin-panel');
    const mainContainer = document.querySelector('.container');
    const logoutBtn = document.getElementById('logout-btn');

    // 3. Initialize App State & Session
    const checkSession = async () => {
        try {
            const data = await api.checkSession();
            if (data.user) {
                State.sessionUser = data.user;
                ui.show(logoutBtn);
                authWrapper.style.display = 'flex'; // This one is layout-critical, maybe keep or use flex class
                
                if (State.sessionUser.role === 'admin') {
                    ui.hide(loginContainer);
                    ui.show(adminPanel);
                    admin.loadAdminPanel();
                } else {
                    ui.hide(userLogin);
                    ui.show(departmentSelection);
                    admin.loadDepartmentsForSelection();
                }
            } else {
                authWrapper.style.display = 'flex';
                ui.show(loginContainer);
                ui.show(userLogin);
            }
        } catch (error) {
            // 401 is expected if not logged in - don't log as error to avoid user confusion
            if (!error.message.includes('401')) {
                console.error('Session check failed:', error);
            }
            authWrapper.style.display = 'flex';
            ui.show(loginContainer);
            ui.show(userLogin);
        }
    };

    const handleUserLogin = async () => {
        const emailInput = document.getElementById('user-email');
        const passwordInput = document.getElementById('user-password');
        const loginBtn = document.getElementById('user-login-btn');
        const errorEl = document.getElementById('user-error');
        
        if (!emailInput.value || !passwordInput.value) {
            if (errorEl) errorEl.textContent = 'Введите Email и пароль';
            return;
        }

        ui.toggleLoading('user-login-btn', true, 'Вход...');
        try {
            const user = await api.login(emailInput.value, passwordInput.value);
            State.sessionUser = user;
            if (errorEl) errorEl.textContent = '';
            ui.show(logoutBtn);

            if (State.sessionUser.role === 'admin') {
                ui.hide(loginContainer);
                ui.show(adminPanel);
                admin.loadAdminPanel();
            } else {
                ui.hide(userLogin);
                ui.show(departmentSelection);
                admin.loadDepartmentsForSelection();
            }
        } catch (error) {
            if (errorEl) errorEl.textContent = `Ошибка входа: ${error.message}`;
        } finally {
            ui.toggleLoading('user-login-btn', false);
        }
    };

    const handleChatLogin = async () => {
        const selectedCard = document.querySelector('.chat-card.selected');
        const passwordInput = document.getElementById('chat-password');
        const errorEl = document.getElementById('chat-error');

        if (!selectedCard) {
            if (errorEl) errorEl.textContent = 'Пожалуйста, выберите чат';
            return;
        }

        if (!passwordInput.value) {
            if (errorEl) errorEl.textContent = 'Пожалуйста, введите пароль';
            return;
        }

        ui.toggleLoading('chat-login-btn', true, 'Вход...');
        try {
            const response = await api.apiFetch('/api/auth/chat', {
                method: 'POST',
                body: JSON.stringify({
                    department_id: State.selectedDepartment.id,
                    name: selectedCard.dataset.chatName,
                    password: passwordInput.value
                })
            });
            State.chatId = response.id;
            if (errorEl) errorEl.textContent = '';
            showMainApp(selectedCard.dataset.chatName);
        } catch (error) {
            if (errorEl) errorEl.textContent = `Ошибка входа в чат: ${error.message}`;
        } finally {
            ui.toggleLoading('chat-login-btn', false);
        }
    };

    const escapeHtml = (str) => {
        if (!str) return str;
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const showMainApp = (chatName) => {
        ui.hide(authWrapper);
        ui.show(mainContainer);
        
        const chatNameHeader = document.getElementById('chat-name-header');
        const deptName = State.selectedDepartment ? State.selectedDepartment.name : 'Департамент';
        
        chatNameHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="universal-back-btn" class="button-secondary" style="padding: 6px 14px; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                    ⬅ Назад
                </button>
                <div style="font-size: 18px;">
                    <span id="breadcrumb-back" style="cursor:pointer; color: var(--primary-color);">
                        🏢 ${escapeHtml(deptName)}
                    </span> 
                    <span style="color: var(--text-muted-color); margin: 0 8px;">/</span> 
                    💬 ${escapeHtml(chatName)}
                </div>
            </div>
        `;

        const goBackHandler = () => {
            ui.hide(mainContainer);
            authWrapper.style.display = 'flex';
            if (State.sessionUser && State.sessionUser.role === 'admin') {
                ui.show(adminPanel);
            } else {
                ui.show(chatLogin);
            }
        };

        const backBtn = document.getElementById('universal-back-btn');
        const breadcrumb = document.getElementById('breadcrumb-back');
        if (backBtn) backBtn.addEventListener('click', goBackHandler);
        if (breadcrumb) breadcrumb.addEventListener('click', goBackHandler);

        loadChatData();
    };

    const loadChatData = async () => {
        const chatId = State.chatId;
        try {
            const [versions, comments, statusObj] = await Promise.all([
                api.apiFetch(`/api/chats/${chatId}/versions`),
                api.apiFetch(`/api/chats/${chatId}/comments`),
                api.apiFetch(`/api/chats/${chatId}/status`)
            ]);
            
            State.chatVersions = versions;
            // renderVersions(versions); // Still need to migrate rendering
            // renderComments(comments);
            
            if (versions.length > 0) {
                displayVersion(versions[0]);
            }
        } catch (error) {
            ui.showNotification(`Ошибка загрузки данных чата: ${error.message}`, 'error');
        }
    };

    const displayVersion = async (version) => {
        const processDescriptionInput = document.getElementById('process-description');
        const diagramContainer = document.getElementById('diagram-container');
        const placeholderContent = document.querySelector('.placeholder-content');

        if (!version) {
            processDescriptionInput.value = '';
            ui.show(placeholderContent);
            diagramContainer.innerHTML = '';
            return;
        }

        processDescriptionInput.value = version.process_text;
        if (version.mermaid_code) {
            ui.hide(placeholderContent);
            ui.show(diagramContainer);
            await diagram.renderBPMN(version.mermaid_code);
        } else {
            ui.show(placeholderContent);
            ui.hide(diagramContainer);
        }
    };

    const handleSaveVersion = async () => {
        const processDescriptionInput = document.getElementById('process-description');
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            ui.showNotification("Нельзя сохранить пустую версию.", "error");
            return;
        }

        ui.toggleLoading('save-version-btn', true, 'Сохранение с ИИ...');
        try {
            const result = await api.generateProcessArtifacts(process_text);
            const { standardDescription, mermaidCode } = result;

            if (!standardDescription || !mermaidCode) {
                throw new Error("Некорректный ответ от AI");
            }

            processDescriptionInput.value = standardDescription;
            await api.apiFetch(`/api/chats/${State.chatId}/versions`, {
                method: 'POST',
                body: JSON.stringify({ process_text: standardDescription, mermaid_code: mermaidCode })
            });
            
            ui.showNotification("Версия успешно сохранена.", "success");
            await loadChatData();
        } catch (error) {
            ui.showNotification(`Ошибка сохранения: ${error.message}`, "error");
        } finally {
            ui.toggleLoading('save-version-btn', false);
        }
    };

    const handleRenderDiagram = async () => {
        const processDescriptionInput = document.getElementById('process-description');
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            ui.showNotification("Описание процесса пустое.", "error");
            return;
        }

        ui.toggleLoading('render-diagram-btn', true, 'Создание схемы...');
        try {
            const mermaidCode = await api.generateDiagramFromText(process_text);
            if (mermaidCode) {
                ui.hide(document.querySelector('.placeholder-content'));
                ui.show('diagram-container');
                await diagram.renderBPMN(mermaidCode);
            }
        } catch (error) {
            ui.showNotification(`Ошибка создания схемы: ${error.message}`, "error");
        } finally {
            ui.toggleLoading('render-diagram-btn', false);
        }
    };

    await checkSession();
    
    // 4. Global Event Listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await api.logout();
            State.sessionUser = null;
            State.selectedDepartment = null;
            State.resetChatState();
            window.location.reload();
        });
    }

    // Admin & Map Controls
    bind('global-audit-btn', 'click', () => {
        ui.show('global-audit-modal');
    });
    bind('close-global-audit-modal', 'click', () => {
        ui.hide('global-audit-modal');
    });
    bind('run-global-audit-btn', 'click', admin.handleRunGlobalAudit);
    bind('create-user-btn', 'click', admin.handleCreateUser);
    bind('create-department-btn', 'click', admin.handleCreateDepartment);
    bind('create-chat-btn', 'click', admin.handleCreateChat);
    bind('refresh-map-btn', 'click', () => map.initProcessMap('cy'));

    bind('user-login-btn', 'click', handleUserLogin);
    bind('chat-login-btn', 'click', handleChatLogin);
    bind('save-version-btn', 'click', handleSaveVersion);
    bind('render-diagram-btn', 'click', handleRenderDiagram);

    // 5. Setup Admin Tabs
    ui.setupTabs([
        { btnId: 'admin-tab-users', contentId: 'admin-view-users' },
        { btnId: 'admin-tab-map', contentId: 'admin-view-map' }
    ], (btnId) => {
        if (btnId === 'admin-tab-map') {
            map.initProcessMap('cy');
        }
    });

    // 6. Navigation Event Listeners
    window.addEventListener('open-chat', async (e) => {
        const { id, name } = e.detail;
        State.chatId = id;
        showMainApp(name);
    });

    ui.setupTabs([
        { btnId: 'in-review-tab', contentId: 'in-review' },
        { btnId: 'pending-tab', contentId: 'pending' },
        { btnId: 'completed-tab', contentId: 'completed' }
    ]);

    // Audio Controls
    bind('start-record-btn', 'click', () => {
        audio.startRecording();
        ui.hide('start-record-btn');
        ui.show('stop-record-btn');
    });

    bind('stop-record-btn', 'click', () => {
        audio.stopRecording();
        ui.hide('stop-record-btn');
        ui.show('start-record-btn');
    });

    bind('process-btn', 'click', audio.processAudio);
});
