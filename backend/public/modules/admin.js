/**
 * Admin Panel module
 */
import State from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

const getCreateChatFormElements = () => ({
    form: document.getElementById('create-chat-form'),
    header: document.getElementById('chat-list-header'),
    selectedName: document.getElementById('selected-department-name'),
    nameInput: document.getElementById('new-chat-name'),
    passwordInput: document.getElementById('new-chat-password')
});

const toggleCreateChatForm = (dept) => {
    const { form, header, selectedName } = getCreateChatFormElements();
    if (!form) return;

    if (!dept) {
        form.style.display = 'none';
        if (header) header.textContent = 'Чаты';
        if (selectedName) selectedName.textContent = '';
        return;
    }

    if (header) header.textContent = `Чаты в "${dept.name}"`;
    if (selectedName) selectedName.textContent = dept.name;
    form.style.display = 'flex';
};

export const loadDepartments = async () => {
    try {
        const depts = await api.getDepartments();
        ui.clearContainer('department-list');
        depts.forEach((dept) => {
            const card = createDepartmentCard(dept);
            const list = document.getElementById('department-list');
            if (list) list.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load departments:', err);
    }
};

const createDepartmentCard = (dept) => {
    const div = document.createElement('div');
    div.className = 'department-card';
    div.innerHTML = `
        <span class="dept-name">${dept.name}</span>
        <button class="button-secondary edit-dept-btn">Изменить</button>
    `;
    div.onclick = () => selectDepartment(dept);
    const editBtn = div.querySelector('.edit-dept-btn');
    if (editBtn) {
        editBtn.onclick = (e) => e.stopPropagation();
    }
    return div;
};

export const selectDepartment = async (dept, options = {}) => {
    State.selectedDepartment = dept;
    ui.showNotification(`Выбран департамент: ${dept.name}`);
    toggleCreateChatForm(options.admin ? dept : null);

    try {
        const chats = await api.getChats(dept.id);
        renderChatList(chats);
    } catch (err) {
        console.error('Failed to load chats:', err);
    }
};

export const loadChats = async (deptId, containerId = 'chat-list') => {
    try {
        const chats = await api.getChats(deptId);
        renderChatList(chats, containerId);
    } catch (err) {
        console.error('Failed to load chats:', err);
    }
};

const renderChatList = (chats, containerId = 'chat-list') => {
    ui.clearContainer(containerId);
    const container = document.getElementById(containerId);
    if (!container) return;

    chats.forEach((chat) => {
        const item = document.createElement('div');
        const isSelection = containerId === 'chat-selection-container';
        item.className = isSelection ? 'chat-card' : 'chat-item';

        if (isSelection) {
            item.dataset.chatId = chat.id;
            item.dataset.chatName = chat.name;
            item.innerHTML = `
                <span class="chat-icon">💬</span>
                <span class="chat-name">${chat.name}</span>
            `;
            item.onclick = () => {
                container.querySelectorAll('.chat-card').forEach((card) => card.classList.remove('selected'));
                item.classList.add('selected');
            };
        } else {
            item.innerHTML = `
                <span>${chat.name}</span>
                <button class="button-primary chat-open-btn">Открыть</button>
            `;
            const openBtn = item.querySelector('.chat-open-btn');
            if (openBtn) {
                openBtn.onclick = () => {
                    State.chatId = chat.id;
                    window.dispatchEvent(new CustomEvent('open-chat', { detail: { id: chat.id, name: chat.name } }));
                };
            }
        }

        container.appendChild(item);
    });
};

export const loadDepartmentsForSelection = async () => {
    const container = document.getElementById('department-selection-container');
    const errorEl = document.getElementById('department-selection-error');
    if (!container) return;

    try {
        const departments = await api.getDepartments();
        if (departments.length === 0) {
            container.innerHTML = '<p class="placeholder-text">Для вас не назначено ни одного департамента.</p>';
            return;
        }

        container.innerHTML = departments.map((dept) => `
            <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                <span class="dept-icon">🏢</span>
                <span class="dept-name">${dept.name}</span>
            </div>
        `).join('');

        container.querySelectorAll('.department-card').forEach((card) => {
            card.addEventListener('click', () => {
                State.selectedDepartment = {
                    id: card.dataset.deptId,
                    name: card.dataset.deptName
                };
                toggleCreateChatForm(null);
                ui.hide('department-selection');
                ui.show('chat-login');
                loadChats(State.selectedDepartment.id, 'chat-selection-container');
            });
        });
    } catch (error) {
        if (errorEl) errorEl.textContent = `Не удалось загрузить департаменты: ${error.message}`;
    }
};

export const loadAdminPanel = async () => {
    try {
        await Promise.all([
            loadAdminUsers(),
            loadAdminDepartments(),
            loadAdminReviews(),
            loadAdminPending(),
            loadAdminCompleted()
        ]);

        if (State.sessionUser?.role === 'admin' && State.selectedDepartment?.id) {
            toggleCreateChatForm(State.selectedDepartment);
        } else {
            toggleCreateChatForm(null);
        }
    } catch (error) {
        ui.showNotification(`Ошибка загрузки данных админ-панели: ${error.message}`, 'error');
    }
};

export const loadAdminUsers = async () => {
    const tableBody = document.getElementById('users-list-body');
    const newUserDeptSelect = document.getElementById('new-user-dept');
    const userForNewDeptSelect = document.getElementById('user-for-new-department');

    try {
        const users = await api.apiFetch('/api/admin/users');
        if (tableBody) {
            tableBody.innerHTML = users.map((user) => `
                <tr>
                    <td>${user.full_name || user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role === 'admin' ? 'Админ' : 'Пользователь'}</td>
                    <td>${user.department_name || '-'}</td>
                    <td>
                        <button class="button-small change-password-btn" data-user-id="${user.id}">Пароль</button>
                        <button class="button-small delete-user-btn" data-user-id="${user.id}">Удалить</button>
                    </td>
                </tr>
            `).join('');

            const options = users.map((user) => `
                <option value="${user.id}">${user.full_name || user.name} (${user.email})</option>
            `).join('');

            if (userForNewDeptSelect) {
                userForNewDeptSelect.innerHTML = `<option value="">Выберите владельца</option>` + options;
            }

            if (newUserDeptSelect) {
                const depts = await api.getDepartments();
                newUserDeptSelect.innerHTML = `<option value="">Без департамента</option>` +
                    depts.map((dept) => `<option value="${dept.id}">${dept.name}</option>`).join('');
            }

            tableBody.querySelectorAll('.delete-user-btn').forEach((btn) => {
                btn.onclick = () => handleDeleteUser(btn.dataset.userId);
            });
            tableBody.querySelectorAll('.change-password-btn').forEach((btn) => {
                btn.onclick = () => handleChangePassword(btn.dataset.userId);
            });
        }
    } catch (error) {
        ui.showNotification('Не удалось загрузить список пользователей', 'error');
    }
};

export const handleCreateUser = async () => {
    const full_name = document.getElementById('new-user-fullname').value;
    const email = document.getElementById('new-user-email').value;
    const department_id = document.getElementById('new-user-dept').value || null;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    if (!full_name || !email || !password) {
        ui.showNotification('ФИО, Email и Пароль обязательны', 'error');
        return;
    }

    ui.toggleLoading('create-user-btn', true, 'Создание...');
    try {
        await api.apiFetch('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ full_name, email, password, department_id, role })
        });
        ui.showNotification('Пользователь успешно создан', 'success');
        loadAdminUsers();
    } catch (error) {
        ui.showNotification(`Ошибка: ${error.message}`, 'error');
    } finally {
        ui.toggleLoading('create-user-btn', false);
    }
};

export const handleDeleteUser = async (userId) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
        await api.apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        ui.showNotification('Пользователь удален', 'success');
        loadAdminUsers();
    } catch (error) {
        ui.showNotification(`Ошибка удаления: ${error.message}`, 'error');
    }
};

export const handleChangePassword = async (userId) => {
    const newPassword = prompt('Введите новый пароль (минимум 8 символов):');
    if (!newPassword || newPassword.length < 8) return;

    try {
        await api.apiFetch(`/api/admin/users/${userId}/password`, {
            method: 'PATCH',
            body: JSON.stringify({ password: newPassword })
        });
        ui.showNotification('Пароль изменен', 'success');
    } catch (error) {
        ui.showNotification(`Ошибка изменения пароля: ${error.message}`, 'error');
    }
};

export const loadAdminDepartments = async () => {
    const list = document.getElementById('department-list');
    try {
        const departments = await api.getDepartments();
        if (list) {
            list.innerHTML = departments.map((dept) => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span>${dept.name}</span>
                    <button class="button-danger delete-dept-btn" data-dept-id="${dept.id}">Удалить</button>
                </div>`).join('');

            list.querySelectorAll('.department-card').forEach((card) => {
                card.onclick = () => {
                    const dept = {
                        id: card.dataset.deptId,
                        name: card.dataset.deptName
                    };
                    selectDepartment(dept, { admin: true });
                };
            });

            list.querySelectorAll('.delete-dept-btn').forEach((btn) => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    handleDeleteDepartment(btn.dataset.deptId);
                };
            });
        }
    } catch (error) {
        ui.showNotification('Не удалось загрузить департаменты', 'error');
    }
};

export const handleDeleteDepartment = async (deptId) => {
    if (!confirm('Вы уверены, что хотите удалить этот департамент?')) return;
    try {
        await api.apiFetch(`/api/departments/${deptId}`, { method: 'DELETE' });
        ui.showNotification('Департамент удален', 'success');
        if (State.selectedDepartment && String(State.selectedDepartment.id) === String(deptId)) {
            State.selectedDepartment = null;
            toggleCreateChatForm(null);
            renderChatList([]);
        }
        loadAdminDepartments();
    } catch (error) {
        ui.showNotification(`Ошибка удаления: ${error.message}`, 'error');
    }
};

export const handleCreateDepartment = async () => {
    const name = document.getElementById('new-department-name').value;
    const password = document.getElementById('new-department-password').value;
    const userId = document.getElementById('user-for-new-department').value;

    if (!name || !password || !userId) {
        ui.showNotification('Все поля должны быть заполнены!', 'error');
        return;
    }

    ui.toggleLoading('create-department-btn', true, 'Создание...');
    try {
        await api.apiFetch('/api/departments', {
            method: 'POST',
            body: JSON.stringify({ name, password, user_id: userId })
        });
        ui.showNotification('Департамент создан!', 'success');
        loadAdminDepartments();
    } catch (error) {
        ui.showNotification(`Не удалось создать департамент: ${error.message}`, 'error');
    } finally {
        ui.toggleLoading('create-department-btn', false);
    }
};

export const handleCreateChat = async () => {
    const dept = State.selectedDepartment;
    const { nameInput, passwordInput } = getCreateChatFormElements();
    const chatName = nameInput?.value.trim();
    const chatPassword = passwordInput?.value;

    if (!dept || !dept.id) {
        ui.showNotification('Сначала выберите департамент.', 'error');
        return;
    }

    if (!chatName || !chatPassword) {
        ui.showNotification('Заполните название и пароль чата.', 'error');
        return;
    }

    ui.toggleLoading('create-chat-btn', true, 'Создание...');
    try {
        await api.apiFetch('/api/chats', {
            method: 'POST',
            body: JSON.stringify({
                department_id: dept.id,
                name: chatName,
                password: chatPassword
            })
        });

        if (nameInput) nameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        ui.showNotification('Чат успешно создан.', 'success');

        const chats = await api.getChats(dept.id);
        renderChatList(chats);
        toggleCreateChatForm(dept);
    } catch (error) {
        ui.showNotification(`Не удалось создать чат: ${error.message}`, 'error');
    } finally {
        ui.toggleLoading('create-chat-btn', false);
    }
};

export const handleRunGlobalAudit = async () => {
    const promptEl = document.getElementById('audit-prompt');
    const resultArea = document.getElementById('global-audit-result-area');
    const resultText = document.getElementById('global-audit-text');

    const prompt = promptEl?.value.trim();
    if (!prompt) {
        ui.showNotification('Введите запрос для анализа', 'error');
        return;
    }

    ui.toggleLoading('run-global-audit-btn', true, 'Обработка...');
    if (resultArea) ui.hide(resultArea);

    try {
        const data = await api.apiFetch('/api/admin/audit', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });

        if (resultText) {
            resultText.innerText = data.result;
            ui.show(resultArea);
        }
        ui.showNotification('Анализ успешно завершен', 'success');
    } catch (err) {
        ui.showNotification(err.message || 'Ошибка аудита', 'error');
    } finally {
        ui.toggleLoading('run-global-audit-btn', false);
    }
};

const renderAdminChatList = (chats, containerId) => {
    const list = document.getElementById(containerId);
    if (!list) return;

    if (chats.length === 0) {
        list.innerHTML = '<li class="placeholder-text">Нет чатов в этом статусе</li>';
        return;
    }

    list.innerHTML = chats.map((item) => `
        <li>
            <a href="javascript:void(0)" class="admin-chat-link" data-chat-id="${item.chat_id}" data-chat-name="${item.chats.name}">
                <span><strong>${item.chats.name}</strong> (${item.departments.name})</span>
                <span class="status-badge">${item.status}</span>
            </a>
        </li>
    `).join('');

    list.querySelectorAll('.admin-chat-link').forEach((link) => {
        link.onclick = (e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('open-chat', {
                detail: {
                    id: link.dataset.chatId,
                    name: link.dataset.chatName
                }
            }));
        };
    });
};

export const loadAdminReviews = async () => {
    try {
        const chats = await api.apiFetch('/api/admin/chats/in_review');
        renderAdminChatList(chats, 'in-review-list');
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
};

export const loadAdminPending = async () => {
    try {
        const chats = await api.apiFetch('/api/admin/chats/pending');
        renderAdminChatList(chats, 'pending-list');
    } catch (err) {
        console.error('Failed to load pending:', err);
    }
};

export const loadAdminCompleted = async () => {
    try {
        const chats = await api.apiFetch('/api/admin/chats/completed');
        renderAdminChatList(chats, 'completed-list');
    } catch (err) {
        console.error('Failed to load completed:', err);
    }
};
