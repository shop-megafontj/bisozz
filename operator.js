document.addEventListener("DOMContentLoaded", () => {
    
    const auth = firebase.auth();
    const db = firebase.database();

    let currentUser = null; // { uid, email, name, isAdmin, approved }
    let allTemplates = {};
    let allUsers = {};

    // --- СЕЛЕКТОРЫ ПАНЕЛИ ОПЕРАТОРА ---
    const operatorUserEmail = document.getElementById("operator-user-email");
    const operatorLogoutBtn = document.getElementById("operator-logout");
    const operatorPendingMessage = document.getElementById("operator-pending-message");
    const pendingHr = document.getElementById("pending-hr");
    const openAddModalBtn = document.getElementById("open-add-modal-btn");
    
    const operatorTemplateList = document.getElementById("operator-template-list");
    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-select");
    const showFavoritesCheckbox = document.getElementById("show-favorites");

    // --- СЕЛЕКТОРЫ МОДАЛЬНОГО ОКНА ---
    const modal = document.getElementById("template-modal");
    const modalTitle = document.getElementById("modal-title");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const operatorTemplateForm = document.getElementById("operator-template-form");
    const templateIdInput = document.getElementById("op-template-id");


    // --- ПРОВЕРКА АВТОРИЗАЦИИ (с исправлением ошибки) ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // 1. Пользователь вошел, ПОДПИСЫВАЕМСЯ на его данные
            db.ref('/users/' + user.uid).on('value', snapshot => {
                if (snapshot.exists()) {
                    
                    if (snapshot.val().isAdmin) {
                        // 2. Это АДМИН. Выкидываем его.
                        alert("Доступ запрещен. Это аккаунт администратора.");
                        auth.signOut(); // Выходим из системы
                        window.location.href = "login.html";
                    } else {
                        // 3. Это ОПЕРАТОР. Обновляем currentUser и запускаем панель.
                        currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                        initOperatorPanel();
                    }
                    
                } else {
                    // 4. Данных ЕЩЕ НЕТ (идет регистрация). Просто ждем.
                    console.log("Ожидание данных пользователя (регистрация)...");
                    operatorUserEmail.textContent = "Идет регистрация...";
                }
            });
        } else {
            // 5. Пользователь не вошел.
            window.location.href = "login.html";
        }
    });

    // --- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ ОПЕРАТОРА ---
    function initOperatorPanel() {
        if (!currentUser) return; // Защита, если данных еще нет

        operatorUserEmail.textContent = currentUser.email;
        operatorLogoutBtn.addEventListener("click", handleLogout);

        // --- КЛЮЧЕВАЯ ЛОГИКА (Одобрение) ---
        if (currentUser.approved) {
            // Одобрен: показываем кнопку "Добавить"
            openAddModalBtn.style.display = "flex";
            operatorPendingMessage.style.display = "none";
            pendingHr.style.display = "none";
        } else {
            // Не одобрен: показываем сообщение "Ожидайте"
            openAddModalBtn.style.display = "none";
            operatorPendingMessage.style.display = "block";
            pendingHr.style.display = "block";
        }
        
        // Запускаем слушателей (только один раз)
        if (!window.listenersInitialized) {
            listenForTemplates();
            db.ref('users').on('value', snapshot => {
                allUsers = snapshot.val() || {};
                renderOperatorTemplates(); // Перерисовать с новыми именами
            });

            // События
            operatorTemplateForm.addEventListener("submit", handleOperatorFormSubmit);
            searchInput.addEventListener("input", renderOperatorTemplates);
            sortSelect.addEventListener("change", renderOperatorTemplates);
            showFavoritesCheckbox.addEventListener("change", renderOperatorTemplates);
            operatorTemplateList.addEventListener("click", handleCardClick);
            
            // Модальное окно
            openAddModalBtn.addEventListener("click", () => openTemplateModal('add'));
            closeModalBtn.addEventListener("click", closeTemplateModal);
            modal.addEventListener("click", (e) => {
                if (e.target === modal) { // Закрытие по клику на фон
                    closeTemplateModal();
                }
            });

            window.listenersInitialized = true;
        }
    }

    // --- ВЫХОД ---
    function handleLogout() {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    }

    // --- ЛОГИКА МОДАЛЬНОГО ОКНА ---
    
    function openTemplateModal(mode, templateId = null, data = {}) {
        if (mode === 'edit') {
            modalTitle.textContent = "Изменить шаблон";
            templateIdInput.value = templateId; // Записываем ID в скрытое поле
            document.getElementById("op-template-title").value = data.title;
            document.getElementById("op-template-ru").value = data.text_ru;
            document.getElementById("op-template-tj").value = data.text_tj;
            document.getElementById("op-template-tags").value = data.tags ? data.tags.join(", ") : '';
        } else {
            modalTitle.textContent = "Добавить шаблон";
            operatorTemplateForm.reset(); // Очищаем форму
            templateIdInput.value = ""; // Очищаем скрытое поле
        }
        modal.style.display = "flex"; // Показываем модальное окно
        feather.replace(); 
    }

    function closeTemplateModal() {
        modal.style.display = "none";
        operatorTemplateForm.reset();
        templateIdInput.value = "";
    }

    // (Добавление/Изменение)
    function handleOperatorFormSubmit(e) {
        e.preventDefault();
        if (!currentUser.approved) return; 

        const templateData = {
            title: document.getElementById("op-template-title").value,
            text_ru: document.getElementById("op-template-ru").value,
            text_tj: document.getElementById("op-template-tj").value,
            tags: document.getElementById("op-template-tags").value.split(",").map(t => t.trim()).filter(t => t),
        };

        const templateId = templateIdInput.value;

        if (templateId) {
            // --- РЕЖИМ ИЗМЕНЕНИЯ ---
            db.ref('templates/' + templateId).update(templateData)
                .then(closeTemplateModal)
                .catch(err => console.error("Ошибка обновления:", err));
        } else {
            // --- РЕЖИМ ДОБАВЛЕНИЯ ---
            templateData.authorId = currentUser.uid;
            templateData.createdAt = new Date().toISOString();
            
            db.ref('templates').push(templateData)
                .then(closeTemplateModal)
                .catch(err => console.error("Ошибка добавления:", err));
        }
    }


    // --- ФУНКЦИИ ОПЕРАТОРА (Отрисовка и Карточки) ---

    function listenForTemplates() {
        db.ref('templates').on('value', snapshot => {
            allTemplates = snapshot.val() || {};
            renderOperatorTemplates();
        });
    }

    function renderOperatorTemplates() {
        if (!currentUser) return; 
        
        operatorTemplateList.innerHTML = "";
        
        const searchTerm = searchInput.value.toLowerCase();
        const sortBy = sortSelect.value;
        const showOnlyFavorites = showFavoritesCheckbox.checked;

        let filteredTemplates = [];
        for (const id in allTemplates) {
            filteredTemplates.push({ id: id, ...allTemplates[id] });
        }

        // Фильтрация
        filteredTemplates = filteredTemplates.filter(t => {
            const titleMatch = t.title.toLowerCase().includes(searchTerm);
            const textRuMatch = t.text_ru.toLowerCase().includes(searchTerm);
            const textTjMatch = t.text_tj.toLowerCase().includes(searchTerm);
            const tagsMatch = t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            const isFavorite = t.favorites && t.favorites[currentUser.uid];
            const favoriteMatch = !showOnlyFavorites || isFavorite;
            return (titleMatch || textRuMatch || textTjMatch || tagsMatch) && favoriteMatch;
        });

        // Сортировка
        filteredTemplates.sort((a, b) => {
            switch (sortBy) {
                case "date-desc": return new Date(b.createdAt) - new Date(a.createdAt);
                case "date-asc": return new Date(a.createdAt) - new Date(b.createdAt);
                case "title-asc": return a.title.localeCompare(b.title);
                case "title-desc": return b.title.localeCompare(a.title);
                default: return 0;
            }
        });
        
        // Отрисовка
        if (filteredTemplates.length === 0) {
            operatorTemplateList.innerHTML = "<p>Шаблоны не найдены.</p>";
            return;
        }

        filteredTemplates.forEach(template => {
            const author = allUsers[template.authorId];
            const authorName = author ? author.name : "Неизвестно";
            const date = new Date(template.createdAt).toLocaleDateString("ru-RU");
            const isFavorite = template.favorites && template.favorites[currentUser.uid];

            // --- Проверяем, является ли текущий юзер автором ---
            const isAuthor = template.authorId === currentUser.uid;

            const card = document.createElement("div");
            card.className = "template-card";
            card.setAttribute("data-id", template.id);
            
            card.innerHTML = `
                <div class="card-header">
                    <h4>${template.title}</h4>
                    <div class="card-actions">
                        ${isAuthor ? `
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
                    <div class="lang-tab active" data-lang="ru">Русский</div>
                    <div class="lang-tab" data-lang="tj">Таджикский</div>
                </div>
                <div class="card-body">
                    <div class="lang-content active" data-content="ru">${template.text_ru}</div>
                    <div class="lang-content" data-content="tj">${template.text_tj}</div>
                </div>
                <div class="card-footer">
                    <div class="card-tags">
                        ${template.tags ? template.tags.map(tag => `<span class="tag">${tag}</span>`).join("") : ''}
                    </div>
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

        feather.replace(); // Обновляем все иконки
    }

    
    function handleCardClick(e) {
        const card = e.target.closest(".template-card");
        if (!card) return;
        
        const templateId = card.getAttribute("data-id");
        const template = allTemplates[templateId];

        // --- Изменить ---
        if (e.target.closest("[data-action='edit']")) {
            if (template.authorId === currentUser.uid) {
                openTemplateModal('edit', templateId, template);
            }
            return;
        }

        // --- Удалить ---
        if (e.target.closest("[data-action='delete']")) {
            if (template.authorId === currentUser.uid) {
                if (confirm(`Вы уверены, что хотите удалить шаблон "${template.title}"?`)) {
                    // --- ИСПРАВЛЕНИЕ ОПЕЧАТКИ ---
                    db.ref('templates/' + templateId).remove();
                }
            }
            return;
        }

        // --- Переключение языковых табов ---
        if (e.target.classList.contains("lang-tab")) {
            const lang = e.target.getAttribute("data-lang");
            card.querySelectorAll(".lang-tab").forEach(tab => tab.classList.remove("active"));
            e.target.classList.add("active");

            card.querySelectorAll(".lang-content").forEach(content => {
                content.classList.remove("active");
                if (content.getAttribute("data-content") === lang) {
                    content.classList.add("active");
                }
            });
            return; // Добавил return для оптимизации
        }

        // --- Добавить/Удалить из Избранного ---
        if (e.target.closest("[data-action='favorite']")) {
            const isFavorite = template.favorites && template.favorites[currentUser.uid];
            const favRef = db.ref(`templates/${templateId}/favorites/${currentUser.uid}`);

            if (isFavorite) {
                favRef.remove();
            } else {
                favRef.set(true);
            }
            return; // Добавил return
        }

        // --- Копировать в буфер обмена ---
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
            return; // Добавил return
        }
    }
});