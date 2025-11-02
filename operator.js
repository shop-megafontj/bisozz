document.addEventListener("DOMContentLoaded", () => {
    
    const auth = firebase.auth();
    const db = firebase.database();

    let currentUser = null; 
    let allTemplates = {};
    let allUsers = {};
    let forcedToProfile = false; // Флаг, чтобы не перекидывать на профиль при каждом обновлении

    // --- СЕЛЕКТОРЫ СТРУКТУРЫ ---
    const pageTitle = document.getElementById("page-title");
    const operatorUserEmail = document.getElementById("operator-user-email");
    const operatorLogoutBtn = document.getElementById("operator-logout");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.getElementById("app-sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const navLinks = document.querySelectorAll(".nav-link");
    const pageSections = document.querySelectorAll(".page-section");
    const themeSwitcher = document.getElementById("theme-switcher");
    const themeIcon = themeSwitcher.querySelector('i');

    // --- СЕЛЕКТОРЫ РАЗДЕЛА "ШАБЛОНЫ" ---
    const operatorPendingMessage = document.getElementById("operator-pending-message");
    const openAddModalBtn = document.getElementById("open-add-modal-btn");
    const templateSkeletonLoader = document.getElementById("template-skeleton-loader");
    const operatorTemplateList = document.getElementById("operator-template-list");
    const searchInput = document.getElementById("search-input");

    // --- СЕЛЕКТОРЫ РАЗДЕЛА "ПРОФИЛЬ" ---
    const rejectionNotice = document.getElementById("rejection-notice");
    const rejectionReasonSpan = document.getElementById("rejection-reason");
    const resubmitBtn = document.getElementById("resubmit-application-btn"); // НОВАЯ КНОПКА
    const profileDataForm = document.getElementById("profile-data-form");
    const profileNameInput = document.getElementById("profile-name");
    const profileEmailInput = document.getElementById("profile-email");
    const profilePasswordForm = document.getElementById("profile-password-form");
    const profileOldPassInput = document.getElementById("profile-old-pass");
    const profileNewPassInput = document.getElementById("profile-new-pass");

    // --- СЕЛЕКТОРЫ МОДАЛЬНОГО ОКНА ---
    const modal = document.getElementById("template-modal");
    const modalTitle = document.getElementById("modal-title");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const operatorTemplateForm = document.getElementById("operator-template-form");
    const templateIdInput = document.getElementById("op-template-id");
    
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


    // --- ПРОВЕРКА АВТОРИЗАЦИИ ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.ref('/users/' + user.uid).on('value', snapshot => {
                if (snapshot.exists() && !snapshot.val().isAdmin) {
                    currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                    initOperatorPanel();
                } else if (snapshot.val() && snapshot.val().isAdmin) {
                    showToast("Доступ запрещен. Это аккаунт администратора.", "error");
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
    function initOperatorPanel() {
        if (!currentUser) return;

        operatorUserEmail.textContent = currentUser.email;
        profileNameInput.value = currentUser.name;
        profileEmailInput.value = currentUser.email;
        
        const templatesLink = document.querySelector('.nav-link[data-target="templates-page"]');
        templatesLink.style.display = "flex"; // Шаблоны видны всем (кроме бага)
        
        // --- ОБНОВЛЕННАЯ ЛОГИКА СТАТУСОВ ---
        if (currentUser.approved === true) {
            // ОДОБРЕН
            openAddModalBtn.style.display = "inline-flex";
            operatorPendingMessage.style.display = "none";
            rejectionNotice.style.display = "none";
        } else if (currentUser.approved === false) {
            // ОЖИДАЕТ
            openAddModalBtn.style.display = "none";
            operatorPendingMessage.style.display = "block"; // "Ваша заявка на рассмотрении"
            rejectionNotice.style.display = "none";
        } else if (currentUser.approved === 'rejected') {
            // ОТКЛОНЕН
            openAddModalBtn.style.display = "none"; // Не может добавлять
            operatorPendingMessage.style.display = "none";
            
            // Показываем причину
            rejectionNotice.style.display = "block";
            rejectionReasonSpan.textContent = currentUser.rejectionReason || "Причина не указана.";
            
            // Принудительно открыть Профиль, чтобы показать причину
            // Делаем это только один раз при загрузке, чтобы не мешать
            if (!forcedToProfile) {
                 navigateToPage("profile-page");
                 forcedToProfile = true; // Флаг, что мы уже это сделали
            }
        }
        
        // Запускаем слушателей (только один раз)
        if (!window.listenersInitialized) {
            setupNavigation();
            listenForTemplates();
            db.ref('users').on('value', snapshot => {
                allUsers = snapshot.val() || {};
                renderOperatorTemplates();
            });

            // События
            operatorLogoutBtn.addEventListener("click", handleLogout);
            resubmitBtn.addEventListener("click", handleResubmit); // НОВЫЙ СЛУШАТЕЛЬ
            operatorTemplateForm.addEventListener("submit", handleOperatorFormSubmit);
            searchInput.addEventListener("input", renderOperatorTemplates);
            operatorTemplateList.addEventListener("click", handleCardClick);
            profileDataForm.addEventListener("submit", handleProfileDataSubmit);
            profilePasswordForm.addEventListener("submit", handleProfilePasswordSubmit);
            
            // Модальное окно
            openAddModalBtn.addEventListener("click", () => openTemplateModal('add'));
            closeModalBtn.addEventListener("click", closeTemplateModal);
            modal.addEventListener("click", (e) => {
                if (e.target === modal) closeTemplateModal();
            });

            window.listenersInitialized = true;
        }
    }
    
    // --- НАВИГАЦИЯ (Гамбургер и Разделы) ---
    function navigateToPage(targetId) {
        pageSections.forEach(section => {
            section.classList.toggle("active", section.id === targetId);
        });
        const activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if (activeLink) {
            pageTitle.textContent = activeLink.textContent.trim();
            navLinks.forEach(l => l.classList.remove("active"));
            activeLink.classList.add("active");
        }
        if (window.innerWidth <= 900) {
            sidebar.classList.remove("visible");
            sidebarOverlay.style.display = "none";
        }
    }

    function setupNavigation() {
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
                navigateToPage(link.getAttribute("data-target"));
            });
        });
    }

    // --- ВЫХОД ---
    function handleLogout() {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    }

    // --- НОВАЯ ФУНКЦИЯ: Повторная отправка ---
    function handleResubmit() {
        if (!currentUser || currentUser.approved !== 'rejected') return;

        // Меняем статус с 'rejected' на 'false' (ожидание)
        db.ref('users/' + currentUser.uid).update({
            approved: false, 
            rejectionReason: null // Очищаем причину
        })
        .then(() => {
            showToast("Ваша заявка отправлена повторно.", "success");
            // .on('value') listener в auth.onAuthStateChanged
            // автоматически поймает это изменение и вызовет
            // initOperatorPanel(), которая скроет .rejection-notice
            // и покажет .operatorPendingMessage.
        })
        .catch(err => {
            showToast(`Ошибка: ${err.message}`, "error");
        });
    }

    // --- ЛОГИКА ПРОФИЛЯ ---
    function handleProfileDataSubmit(e) {
        e.preventDefault();
        const newName = profileNameInput.value;
        db.ref('users/' + currentUser.uid).update({ name: newName })
            .then(() => {
                showToast("ФИО успешно обновлено.", "success");
            })
            .catch(err => {
                showToast(`Ошибка: ${err.message}`, "error");
            });
    }

    function handleProfilePasswordSubmit(e) {
        e.preventDefault();
        const oldPass = profileOldPassInput.value;
        const newPass = profileNewPassInput.value;
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPass);

        user.reauthenticateWithCredential(credential)
            .then(() => user.updatePassword(newPass))
            .then(() => {
                profilePasswordForm.reset();
                showToast("Пароль успешно обновлен.", "success");
            })
            .catch(error => {
                let message = (error.code === 'auth/wrong-password') 
                    ? "Текущий пароль введен неверно." 
                    : `Ошибка: ${error.message}`;
                showToast(message, "error");
            });
    }

    // --- ЛОГИКА ШАБЛОНОВ ---
    function openTemplateModal(mode, templateId = null, data = {}) {
        if (mode === 'edit') {
            modalTitle.textContent = "Изменить шаблон";
            templateIdInput.value = templateId;
            document.getElementById("op-template-title").value = data.title || '';
            document.getElementById("op-template-ru").value = data.text_ru;
            document.getElementById("op-template-tj").value = data.text_tj;
            document.getElementById("op-template-tags").value = data.tags ? data.tags.join(", ") : '';
        } else {
            modalTitle.textContent = "Добавить шаблон";
            operatorTemplateForm.reset();
            templateIdInput.value = "";
        }
        modal.style.display = "grid";
        feather.replace(); 
    }

    function closeTemplateModal() {
        modal.style.display = "none";
        operatorTemplateForm.reset();
    }

    function handleOperatorFormSubmit(e) {
        e.preventDefault();
        // Доп. проверка: не даем создавать, если не одобрен
        if (currentUser.approved !== true) {
            showToast("У вас нет прав на добавление шаблонов.", "error");
            return;
        }; 

        let title = document.getElementById("op-template-title").value.trim();
        const textTj = document.getElementById("op-template-tj").value.trim();
        
        if (!title) {
            title = textTj.substring(0, 40) + (textTj.length > 40 ? "..." : "");
        }
        if (!title) {
            title = "Без названия";
        }

        const templateData = {
            title: title,
            text_ru: document.getElementById("op-template-ru").value,
            text_tj: textTj,
            tags: document.getElementById("op-template-tags").value.split(",").map(t => t.trim()).filter(t => t),
        };
        const templateId = templateIdInput.value;

        const action = templateId 
            ? db.ref('templates/' + templateId).update(templateData)
            : db.ref('templates').push({ ...templateData, authorId: currentUser.uid, createdAt: new Date().toISOString() });

        action
            .then(() => {
                closeTemplateModal();
                showToast(templateId ? "Шаблон обновлен" : "Шаблон добавлен", "success");
            })
            .catch(err => showToast(`Ошибка: ${err.message}`, "error"));
    }

    function listenForTemplates() {
        templateSkeletonLoader.style.display = "grid";
        operatorTemplateList.style.display = "none";
        
        db.ref('templates').on('value', snapshot => {
            allTemplates = snapshot.val() || {};
            renderOperatorTemplates();
        });
    }
    
    function getTagColor(tag) {
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash % 6);
        return `tag-color-${colorIndex}`;
    }

    function renderOperatorTemplates() {
        if (!currentUser) return; 
        
        templateSkeletonLoader.style.display = "none";
        operatorTemplateList.style.display = "grid";
        operatorTemplateList.innerHTML = "";
        
        const searchTerm = searchInput.value.toLowerCase();
        let filteredTemplates = [];

        for (const id in allTemplates) {
            filteredTemplates.push({ id: id, ...allTemplates[id] });
        }

        filteredTemplates = filteredTemplates.filter(t => {
            const titleMatch = (t.title || '').toLowerCase().includes(searchTerm);
            const textRuMatch = (t.text_ru || '').toLowerCase().includes(searchTerm);
            const textTjMatch = (t.text_tj || '').toLowerCase().includes(searchTerm);
            const tagsMatch = t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            return (titleMatch || textRuMatch || textTjMatch || tagsMatch);
        });

        filteredTemplates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (filteredTemplates.length === 0) {
            operatorTemplateList.innerHTML = "<p>Шаблоны не найдены.</p>";
            return;
        }

        filteredTemplates.forEach(template => {
            const author = allUsers[template.authorId];
            const authorName = author ? author.name : "Неизвестно";
            const date = new Date(template.createdAt).toLocaleDateString("ru-RU");
            const isFavorite = template.favorites && template.favorites[currentUser.uid];
            // Проверяем, является ли юзер автором И одобрен ли он
            const canEdit = (template.authorId === currentUser.uid) && (currentUser.approved === true);
            
            const tagsHtml = (template.tags || [])
                .map(tag => `<span class="tag ${getTagColor(tag)}">${tag}</span>`)
                .join("");

            const card = document.createElement("div");
            card.className = "template-card";
            card.setAttribute("data-id", template.id);
            
            card.innerHTML = `
                <div class="card-header">
                    <h4>${template.title}</h4>
                    <div class="card-actions">
                        ${canEdit ? `
                            <button class="card-action-btn" data-action="edit">
                                <i data-feather="edit-2" class="icon-small"></i>
                            </button>
                            <button class="card-action-btn" data-action="delete">
                                <i data-feather="trash-2" class="icon-small"></i>
                            </button>
                        ` : ''}
                        <span class="card-favorite ${isFavorite ? 'favorited' : ''}" data-action="favorite">
                            <i data-feather="star" class="icon-small"></i>
                        </span>
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
                    <div class="card-meta">
                        <div class="card-author">Добавил: <strong>${authorName}</strong><br>${date}</div>
                        <button class="btn-copy" data-action="copy">
                            <i data-feather="copy" class="icon"></i>
                            <span class="copy-text">Копировать</span>
                        </button>
                    </div>
                </div>
            `;
            operatorTemplateList.appendChild(card);
        });

        feather.replace();
    }

    function handleCardClick(e) {
        const card = e.target.closest(".template-card");
        if (!card) return;
        const templateId = card.getAttribute("data-id");
        if (!templateId) return;
        const template = allTemplates[templateId];
        if (!template) return;

        // --- Изменить ---
        if (e.target.closest("[data-action='edit']")) {
            // Проверка: автор И одобрен
            if ((template.authorId === currentUser.uid) && (currentUser.approved === true)) {
                openTemplateModal('edit', templateId, template);
            } else if (currentUser.approved !== true) {
                showToast("Только одобренные операторы могут редактировать.", "error");
            }
            return;
        }
        // --- Удалить ---
        if (e.target.closest("[data-action='delete']")) {
            // Проверка: автор И одобрен
            if ((template.authorId === currentUser.uid) && (currentUser.approved === true)) {
                if (confirm(`Удалить шаблон "${template.title}"?`)) {
                    db.ref('templates/' + templateId).remove()
                        .then(() => showToast("Шаблон удален", "info"))
                        .catch(err => showToast(`Ошибка: ${err.message}`, "error"));
                }
            } else if (currentUser.approved !== true) {
                showToast("Только одобренные операторы могут удалять.", "error");
            }
            return;
        }
        // --- Табы ---
        if (e.target.classList.contains("lang-tab")) {
            const lang = e.target.getAttribute("data-lang");
            card.querySelectorAll(".lang-tab").forEach(tab => tab.classList.remove("active"));
            e.target.classList.add("active");
            card.querySelectorAll(".lang-content").forEach(content => {
                content.classList.toggle("active", content.getAttribute("data-content") === lang);
            });
            return;
        }
        // --- Избранное ---
        if (e.target.closest("[data-action='favorite']")) {
            const isFavorite = template.favorites && template.favorites[currentUser.uid];
            db.ref(`templates/${templateId}/favorites/${currentUser.uid}`).set(isFavorite ? null : true);
            return;
        }
        // --- Копировать ---
        if (e.target.closest("[data-action='copy']")) {
            const activeLangContent = card.querySelector(".lang-content.active").textContent;
            navigator.clipboard.writeText(activeLangContent).then(() => {
                const copyButton = e.target.closest(".btn-copy");
                const copyText = copyButton.querySelector(".copy-text");
                if (copyText) {
                    copyText.textContent = "Скопировано!";
                    copyButton.style.background = "#2ecc71";
                    setTimeout(() => {
                        copyText.textContent = "Копировать";
                        copyButton.style.background = "var(--primary-color)";
                    }, 1500);
                }
            });
            return;
        }
    }
    
    // Инициализация иконок Feather
    feather.replace();
});
