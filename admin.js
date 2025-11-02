document.addEventListener("DOMContentLoaded", () => {
    
    // --- FIREBASE ---
    const auth = firebase.auth();
    const db = firebase.database();
    const secondaryApp = firebase.app("secondaryAdminApp");
    const secondaryAuth = secondaryApp.auth();

    let currentUser = null; 
    let allTemplates = {};
    let allUsers = {};

    // --- СЕЛЕКТОРЫ СТРУКТУРЫ ---
    const pageTitle = document.getElementById("page-title");
    const adminUserEmail = document.getElementById("admin-user-email");
    const adminLogoutBtn = document.getElementById("admin-logout");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.getElementById("app-sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const navLinks = document.querySelectorAll(".nav-link");
    const pageSections = document.querySelectorAll(".page-section");
    const themeSwitcher = document.getElementById("theme-switcher");
    const themeIcon = themeSwitcher.querySelector('i');

    // --- Селекторы "Операторы" ---
    const operatorSkeletonLoader = document.getElementById("operator-skeleton-loader");
    const operatorListContainer = document.getElementById("operator-list");
    const addOperatorForm = document.getElementById("add-operator-form");
    
    // --- Селекторы "Шаблоны" ---
    const templateSkeletonLoader = document.getElementById("template-skeleton-loader");
    const adminTemplateList = document.getElementById("admin-template-list");
    const adminOpenAddModalBtn = document.getElementById("admin-open-add-modal-btn");
    
    // --- Модалка Шаблонов ---
    const templateModal = document.getElementById("template-modal");
    const templateModalTitle = document.getElementById("modal-title");
    const closeTemplateModalBtn = document.getElementById("close-template-modal-btn");
    const adminTemplateForm = document.getElementById("admin-template-form");
    const adminTemplateIdInput = document.getElementById("admin-template-id");
    
    // --- Модалка Операторов (Редакт.) ---
    const operatorEditModal = document.getElementById("operator-edit-modal");
    const operatorModalTitle = document.getElementById("operator-modal-title");
    const closeOperatorModalBtn = document.getElementById("close-operator-modal-btn");
    const operatorEditForm = document.getElementById("operator-edit-form");
    const operatorEditUidInput = document.getElementById("operator-edit-uid");
    const operatorEditNameInput = document.getElementById("operator-edit-name");
    const operatorEditEmailInput = document.getElementById("operator-edit-email");
    const operatorPasswordResetBtn = document.getElementById("operator-password-reset-btn");
    
    // --- НОВАЯ Модалка (Отклонение) ---
    const rejectionModal = document.getElementById("rejection-modal");
    const closeRejectionModalBtn = document.getElementById("close-rejection-modal-btn");
    const rejectionForm = document.getElementById("rejection-form");
    const rejectionUidInput = document.getElementById("rejection-uid");
    const rejectionReasonInput = document.getElementById("rejection-reason");

    // --- ЛОГИКА TOAST-УВЕДОМЛЕНИЙ ---
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById("toast-container");
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toastContainer.removeChild(toast), 500);
        }, 3000);
    }
    
    // --- ЛОГИКА ТЕМЫ (Светлая/Темная) ---
    function setTeam(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeIcon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
        feather.replace();
    }
    themeSwitcher.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        setTeam(currentTheme === 'dark' ? 'light' : 'dark');
    });
    setTeam(localStorage.getItem('theme') || 'light');

    
    // --- АВТОРИЗАЦИЯ ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.ref('/users/' + user.uid).once('value').then(snapshot => {
                if (snapshot.exists() && snapshot.val().isAdmin) {
                    currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                    initAdminPanel();
                } else {
                    showToast("Доступ запрещен. Вы не администратор.", "error");
                    setTimeout(() => {
                        auth.signOut();
                        window.location.href = "login.html";
                    }, 1000);
                }
            });
        } else {
            window.location.href = "login.html";
        }
    });

    // --- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ ---
    function initAdminPanel() {
        adminUserEmail.textContent = currentUser.email;
        adminLogoutBtn.addEventListener("click", handleLogout);
        
        setupNavigation();
        listenForOperators();
        listenForTemplates();

        // Слушатели форм
        addOperatorForm.addEventListener("submit", handleAddOperator);
        adminTemplateForm.addEventListener("submit", handleAdminTemplateFormSubmit);
        operatorEditForm.addEventListener("submit", handleOperatorEditFormSubmit);
        rejectionForm.addEventListener("submit", handleRejectionFormSubmit); // Новая форма

        // Слушатели кликов по спискам
        operatorListContainer.addEventListener("click", handleOperatorListClick);
        adminTemplateList.addEventListener("click", handleAdminTemplateListClick);
        
        // Слушатели модальных окон
        adminOpenAddModalBtn.addEventListener("click", () => openTemplateModal('add'));
        closeTemplateModalBtn.addEventListener("click", closeTemplateModal);
        templateModal.addEventListener("click", (e) => {
            if (e.target === templateModal) closeTemplateModal();
        });
        
        closeOperatorModalBtn.addEventListener("click", closeOperatorEditModal);
        operatorEditModal.addEventListener("click", (e) => {
            if (e.target === operatorEditModal) closeOperatorEditModal();
        });
        
        closeRejectionModalBtn.addEventListener("click", closeRejectionModal); // Новая модалка
        rejectionModal.addEventListener("click", (e) => { // Новая модалка
            if (e.target === rejectionModal) closeRejectionModal();
        });
        
        operatorPasswordResetBtn.addEventListener("click", handlePasswordReset);
        
        feather.replace();
    }

    // --- НАВИГАЦИЯ (Гамбургер и Разделы) ---
    function setupNavigation() {
        // Порядок меню изменен в HTML, JS подхватит
        hamburgerBtn.addEventListener("click", () => {
            sidebar.classList.toggle("visible");
            sidebarOverlay.style.display = sidebar.classList.contains("visible") ? "block" : "none";
        });
        sidebarOverlay.addEventListener("click", () => {
            sidebar.classList.remove("visible");
            sidebarOverlay.style.display = "none";
        });
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const targetId = link.getAttribute("data-target");
                pageSections.forEach(section => {
                    section.classList.toggle("active", section.id === targetId);
                });
                pageTitle.textContent = link.textContent.trim();
                navLinks.forEach(l => l.classList.remove("active"));
                link.classList.add("active");
                
                if (window.innerWidth <= 900) {
                    sidebar.classList.remove("visible");
                    sidebarOverlay.style.display = "none";
                }
            });
        });
    }

    // --- ВЫХОД ---
    function handleLogout() {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    }

    // =============================================
    // ====     ЛОГИКА УПРАВЛЕНИЯ ОПЕРАТОРАМИ    ====
    // =============================================

    function handleAddOperator(e) {
        e.preventDefault();
        const name = document.getElementById("add-name").value;
        const email = document.getElementById("add-email").value;
        const pass = document.getElementById("add-password").value;

        secondaryAuth.createUserWithEmailAndPassword(email, pass)
            .then(userCredential => {
                const newUid = userCredential.user.uid;
                return db.ref('users/' + newUid).set({
                    name: name,
                    email: email,
                    isAdmin: false,
                    approved: true // Сразу одобрен
                });
            })
            .then(() => {
                showToast(`Оператор ${name} создан.`, "success");
                addOperatorForm.reset();
                secondaryAuth.signOut();
            })
            .catch(error => {
                showToast(`Ошибка: ${error.message}`, "error");
                secondaryAuth.signOut();
            });
    }

    function listenForOperators() {
        operatorSkeletonLoader.style.display = "flex";
        operatorListContainer.style.display = "none";
        
        db.ref('users').on('value', snapshot => {
            allUsers = snapshot.val() || {};
            renderOperators();
        });
    }

    function renderOperators() {
        operatorSkeletonLoader.style.display = "none";
        operatorListContainer.style.display = "flex";
        operatorListContainer.innerHTML = "";
        
        Object.keys(allUsers).forEach(uid => {
            const user = allUsers[uid];
            if (user.isAdmin) return;
            
            const userItem = document.createElement("div");
            userItem.className = "user-item";
            
            let statusClass, statusText, actionsHtml;
            
            if (user.approved === true) {
                statusClass = 'status-approved';
                statusText = 'Активен';
                actionsHtml = `
                    <button class="card-action-btn" data-action="edit" data-id="${uid}" title="Изменить">
                        <i data-feather="edit-2" class="icon-small"></i>
                    </button>
                    <button class="btn-delete" data-action="delete" data-id="${uid}" title="Удалить">
                        <i data-feather="trash-2" class="icon-small"></i>
                    </button>
                `;
            } else if (user.approved === false) {
                statusClass = 'status-pending';
                statusText = 'Заявка';
                actionsHtml = `
                    <button class="btn-approve" data-action="approve" data-id="${uid}">Одобрить</button>
                    <button class="btn-reject" data-action="reject" data-id="${uid}">Отклонить</button>
                `;
            } else if (user.approved === 'rejected') {
                statusClass = 'status-rejected';
                statusText = 'Отклонен';
                actionsHtml = `
                    <button class="btn-delete" data-action="delete" data-id="${uid}" title="Удалить окончательно">
                        <i data-feather="trash-2" class="icon-small"></i>
                    </button>
                `;
            }

            userItem.innerHTML = `
                <div class="user-item-info">
                    <strong>${user.name}</strong>
                    <span class="email">(${user.email})</span>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                <div class="user-item-actions">${actionsHtml}</div>
            `;
            operatorListContainer.appendChild(userItem);
        });
        feather.replace();
    }

    function handleOperatorListClick(e) {
        const targetButton = e.target.closest("button");
        if (!targetButton) return;
        const userId = targetButton.getAttribute("data-id");
        if (!userId) return;
        
        const action = targetButton.getAttribute("data-action");
        const user = allUsers[userId];

        switch (action) {
            case 'edit':
                openOperatorEditModal(userId, user);
                break;
            case 'approve':
                db.ref('users/' + userId).update({ approved: true });
                showToast("Заявка одобрена.", "success");
                break;
            case 'reject':
                openRejectionModal(userId, user); // Открываем новую модалку
                break;
            case 'delete':
                if (confirm(`Удалить ${user.name}? ВНИМАНИЕ: Это удалит его только из Базы. Вам нужно будет вручную удалить его из 'Authentication'!`)) {
                    db.ref('users/' + userId).remove()
                        .then(() => showToast("Пользователь удален из Базы.", "info"));
                }
                break;
        }
    }
    
    // --- Модальное окно Редакт. Оператора ---
    function openOperatorEditModal(uid, user) {
        operatorModalTitle.textContent = `Редактировать: ${user.name}`;
        operatorEditUidInput.value = uid;
        operatorEditNameInput.value = user.name;
        operatorEditEmailInput.value = user.email;
        operatorEditModal.style.display = "grid";
        feather.replace();
    }
    function closeOperatorEditModal() {
        operatorEditModal.style.display = "none";
    }
    function handleOperatorEditFormSubmit(e) {
        e.preventDefault();
        const uid = operatorEditUidInput.value;
        const newName = operatorEditNameInput.value;
        db.ref('users/' + uid).update({ name: newName }).then(() => {
            showToast("ФИО обновлено.", "success");
            closeOperatorEditModal();
        });
    }
    function handlePasswordReset(e) {
        e.preventDefault();
        const email = operatorEditEmailInput.value;
        auth.sendPasswordResetEmail(email)
            .then(() => {
                showToast("Ссылка для сброса отправлена.", "success");
            })
            .catch(error => {
                showToast(`Ошибка: ${error.message}`, "error");
            });
    }
    
    // --- НОВОЕ: Модальное окно Отклонения ---
    function openRejectionModal(uid, user) {
        rejectionUidInput.value = uid;
        rejectionModal.style.display = "grid";
        feather.replace();
    }
    function closeRejectionModal() {
        rejectionModal.style.display = "none";
        rejectionForm.reset();
    }
    function handleRejectionFormSubmit(e) {
        e.preventDefault();
        const uid = rejectionUidInput.value;
        const reason = rejectionReasonInput.value.trim();
        
        if (!reason) {
            showToast("Укажите причину.", "error");
            return;
        }
        
        db.ref('users/' + uid).update({
            approved: 'rejected',
            rejectionReason: reason
        })
        .then(() => {
            showToast("Заявка отклонена.", "info");
            closeRejectionModal();
        })
        .catch(err => showToast(`Ошибка: ${err.message}`, "error"));
    }


    // =============================================
    // ====     ЛОГИКА УПРАВЛЕНИЯ ШАБЛОНАМИ     ====
    // =============================================
    function openTemplateModal(mode, templateId = null, data = {}) {
        if (mode === 'edit') {
            templateModalTitle.textContent = "Изменить шаблон";
            adminTemplateIdInput.value = templateId;
            document.getElementById("admin-template-title").value = data.title;
            document.getElementById("admin-template-ru").value = data.text_ru;
            document.getElementById("admin-template-tj").value = data.text_tj;
            document.getElementById("admin-template-tags").value = data.tags ? data.tags.join(", ") : '';
        } else {
            templateModalTitle.textContent = "Добавить шаблон";
            adminTemplateForm.reset();
            adminTemplateIdInput.value = "";
        }
        templateModal.style.display = "grid";
        feather.replace();
    }
    function closeTemplateModal() {
        templateModal.style.display = "none";
    }
    function handleAdminTemplateFormSubmit(e) {
        e.preventDefault();
        const id = adminTemplateIdInput.value;
        const templateData = {
            title: document.getElementById("admin-template-title").value,
            text_ru: document.getElementById("admin-template-ru").value,
            text_tj: document.getElementById("admin-template-tj").value,
            tags: document.getElementById("admin-template-tags").value.split(",").map(t => t.trim()).filter(t => t),
        };

        const action = id
            ? db.ref('templates/' + id).update(templateData)
            : db.ref('templates').push({ ...templateData, authorId: currentUser.uid, createdAt: new Date().toISOString() });

        action
            .then(() => {
                closeTemplateModal();
                showToast(id ? "Шаблон обновлен" : "Шаблон добавлен", "success");
            })
            .catch(err => showToast(`Ошибка: ${err.message}`, "error"));
    }

    function listenForTemplates() {
        templateSkeletonLoader.style.display = "grid";
        adminTemplateList.style.display = "none";
        
        db.ref('templates').on('value', snapshot => {
            allTemplates = snapshot.val() || {};
            renderAdminTemplates();
        });
    }
    
    function getTagColor(tag) {
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `tag-color-${Math.abs(hash % 6)}`;
    }

    function renderAdminTemplates() {
        templateSkeletonLoader.style.display = "none";
        adminTemplateList.style.display = "grid";
        adminTemplateList.innerHTML = "";
        
        const sortedTemplates = Object.keys(allTemplates)
            .map(id => ({ id: id, ...allTemplates[id] }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
        if (sortedTemplates.length === 0) {
            adminTemplateList.innerHTML = "<p>Шаблоны еще не созданы.</p>";
            return;
        }

        sortedTemplates.forEach(template => {
            const tagsHtml = (template.tags || []).map(tag => `<span class="tag ${getTagColor(tag)}">${tag}</span>`).join("");
            const card = document.createElement("div");
            card.className = "template-card";
            card.setAttribute("data-id", template.id);
            
            card.innerHTML = `
                <div class="card-header">
                    <h4>${template.title}</h4>
                    <div class="card-actions">
                        <button class="card-action-btn" data-action="edit">
                            <i data-feather="edit-2" class="icon-small"></i>
                        </button>
                        <button class="card-action-btn" data-action="delete">
                            <i data-feather="trash-2" class="icon-small"></i>
                        </button>
                    </div>
                </div>
                <div class="card-lang-tabs">
                    <div class="lang-tab active" data-lang="tj">Таджикский</div>
                    <div class="lang-tab" data-lang="ru">Русский</div>
                </div>
                <div class="card-body">
                    <div class="lang-content" data-content="ru">${template.text_ru}</div>
                    <div class="lang-content active" data-content="tj">${template.text_tj}</div>
                </div>
                <div class="card-footer">
                    <div class="card-tags">${tagsHtml}</div>
                </div>
            `;
            adminTemplateList.appendChild(card);
        });
        feather.replace();
    }

    function handleAdminTemplateListClick(e) {
        const card = e.target.closest(".template-card");
        if (!card) return;
        const templateId = card.getAttribute("data-id");
        const template = allTemplates[templateId];

        // Табы
        if (e.target.classList.contains("lang-tab")) {
            const lang = e.target.getAttribute("data-lang");
            card.querySelectorAll(".lang-tab").forEach(tab => tab.classList.remove("active"));
            e.target.classList.add("active");
            card.querySelectorAll(".lang-content").forEach(content => {
                content.classList.toggle("active", content.getAttribute("data-content") === lang);
            });
            return;
        }

        // Действия
        const actionButton = e.target.closest("[data-action]");
        if (!actionButton) return;
        const action = actionButton.getAttribute("data-action");

        if (action === "edit") {
            openTemplateModal('edit', templateId, template);
        }
        
        if (action === "delete") {
            if (confirm(`Удалить шаблон "${template.title}"?`)) {
                db.ref('templates/' + templateId).remove()
                    .then(() => showToast("Шаблон удален", "info"));
            }
        }
    }
    
    // Запуск иконок
    feather.replace();
});
