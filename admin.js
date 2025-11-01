document.addEventListener("DOMContentLoaded", () => {
    
    // Основное приложение (для админа)
    const auth = firebase.auth();
    const db = firebase.database();
    
    // Вспомогательное приложение (для создания операторов)
    const secondaryApp = firebase.app("secondaryAdminApp");
    const secondaryAuth = secondaryApp.auth();

    let currentUser = null; 
    let allTemplates = {};
    let allUsers = {};

    // --- СЕЛЕКТОРЫ АДМИН-ПАНЕЛИ ---
    const adminUserEmail = document.getElementById("admin-user-email");
    const adminLogoutBtn = document.getElementById("admin-logout");
    const adminNavLinks = document.querySelectorAll("#admin-panel .nav-link");
    const adminContentSections = document.querySelectorAll("#admin-panel .content-section");
    const operatorListContainer = document.getElementById("operator-list");
    const adminTemplateForm = document.getElementById("admin-template-form");
    const adminTemplateList = document.getElementById("admin-template-list");
    const adminTemplateIdInput = document.getElementById("admin-template-id");
    const adminCancelEditBtn = document.getElementById("admin-cancel-edit");
    
    // --- Селекторы для формы создания ---
    const addOperatorForm = document.getElementById("add-operator-form");
    const addOperatorMessage = document.getElementById("add-operator-message");
    const addOperatorError = document.getElementById("add-operator-error");
    

    // --- ГЛАВНАЯ ПРОВЕРКА БЕЗОПАСНОСТИ ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.ref('/users/' + user.uid).once('value').then(snapshot => {
                if (snapshot.exists() && snapshot.val().isAdmin) {
                    currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                    initAdminPanel();
                } else {
                    alert("Доступ запрещен. Вы не администратор.");
                    window.location.href = "login.html";
                }
            });
        } else {
            window.location.href = "login.html";
        }
    });

    // --- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ АДМИНА ---
    function initAdminPanel() {
        adminUserEmail.textContent = currentUser.email;
        adminLogoutBtn.addEventListener("click", handleLogout);
        
        listenForOperators();
        listenForTemplates();

        // Навигация
        adminNavLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                adminNavLinks.forEach(l => l.classList.remove("active"));
                link.classList.add("active");
                const targetId = link.getAttribute("data-target");
                adminContentSections.forEach(section => {
                    section.classList.remove("active");
                    if (section.id === targetId) {
                        section.classList.add("active");
                    }
                });
            });
        });

        // Форма CRUD
        adminTemplateForm.addEventListener("submit", handleAdminFormSubmit);
        adminCancelEditBtn.addEventListener("click", resetAdminForm);

        // Клик-делегаты для списков
        operatorListContainer.addEventListener("click", handleOperatorListClick);
        adminTemplateList.addEventListener("click", handleAdminTemplateListClick);
        
        // Слушатель формы создания оператора
        addOperatorForm.addEventListener("submit", handleAddOperator);
    }

    // --- ВЫХОД ---
    function handleLogout() {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    }

    // --- Создание оператора (Админом) ---
    function handleAddOperator(e) {
        e.preventDefault();
        addOperatorMessage.style.display = "none";
        addOperatorError.style.display = "none";

        const name = document.getElementById("add-name").value;
        const email = document.getElementById("add-email").value;
        const pass = document.getElementById("add-password").value;
        const passConfirm = document.getElementById("add-password-confirm").value;

        if (pass !== passConfirm) {
            addOperatorError.textContent = "Пароли не совпадают.";
            addOperatorError.style.display = "block";
            return;
        }

        // 1. Используем "вспомогательное" Auth
        secondaryAuth.createUserWithEmailAndPassword(email, pass)
            .then(userCredential => {
                const newUid = userCredential.user.uid;
                
                // 2. Создаем запись в DB (сразу одобренную)
                return db.ref('users/' + newUid).set({
                    name: name,
                    email: email,
                    isAdmin: false,
                    approved: true // <-- Сразу одобрен
                });
            })
            .then(() => {
                addOperatorMessage.textContent = `Оператор ${name} успешно создан.`;
                addOperatorMessage.style.display = "block";
                addOperatorForm.reset();
                secondaryAuth.signOut(); // Выходим из-под "вспомогательного" юзера
            })
            .catch(error => {
                addOperatorError.textContent = `Ошибка: ${error.message}`;
                addOperatorError.style.display = "block";
                secondaryAuth.signOut();
            });
    }

    // --- Функции управления операторами ---

    function listenForOperators() {
        db.ref('users').on('value', snapshot => {
            allUsers = snapshot.val() || {};
            renderOperators();
        });
    }

   // ЗАМЕНИТЕ ФУНКЦИЮ renderOperators в admin.js
function renderOperators() {
    operatorListContainer.innerHTML = "";
    Object.keys(allUsers).forEach(uid => {
        const user = allUsers[uid];
        // Не показываем самого админа в списке
        if (user.isAdmin) return;
        
        const userItem = document.createElement("div");
        userItem.className = "user-item";
        
        let statusClass, statusText;
        if (user.approved) {
            statusClass = 'status-approved'; statusText = 'Активен'; // <-- Изменено
        } else {
            statusClass = 'status-pending'; statusText = 'Заявка'; // <-- Изменено
        }

        userItem.innerHTML = `
            <div class="user-item-info">
                <strong>${user.name}</strong>
                <span class="email">(${user.email})</span>
                <span class="status ${statusClass}">${statusText}</span>
            </div>
            <div class="user-item-actions">
                ${!user.approved ? // <-- Если не одобрен, показать кнопку
                    `<button class="btn-approve" data-id="${uid}">Одобрить</button>` : ''} 
                
                <button class="btn-delete" data-id="${uid}">Удалить</button>
            </div>
        `;
        operatorListContainer.appendChild(userItem);
    });
}

    function handleOperatorListClick(e) {
        const target = e.target;
        const userId = target.getAttribute("data-id");
        if (!userId) return;

        // Кнопка "Принять" (Одобрить)
        if (target.classList.contains("btn-approve")) {
            db.ref('users/' + userId).update({ approved: true });
        }
        
        // Кнопка "Отклонить/Удалить"
        if (target.classList.contains("btn-delete")) {
            if (confirm(`Удалить пользователя ${allUsers[userId].name}? (Отменить будет нельзя)`)) {
                db.ref('users/' + userId).remove();
                // ВАЖНО: Это удалит его из Базы, но не из Authentication.
                // Его нужно будет вручную удалить из вкладки "Authentication" в Firebase.
                console.warn("Пользователь удален из DB, но не из Auth.");
            }
        }
    }
    
    // --- Функции управления шаблонами (CRUD) ---
    
    function listenForTemplates() {
        db.ref('templates').on('value', snapshot => {
            allTemplates = snapshot.val() || {};
            renderAdminTemplates();
        });
    }

    function renderAdminTemplates() {
        adminTemplateList.innerHTML = "";
        Object.keys(allTemplates).forEach(templateId => {
            const template = allTemplates[templateId];
            const item = document.createElement("div");
            item.className = "template-item-admin";
            item.innerHTML = `
                <div class="template-item-admin-info">
                    <strong>${template.title}</strong>
                    <div class="tags">Метки: ${template.tags ? template.tags.join(", ") : 'нет'}</div>
                </div>
                <div class="template-item-admin-actions">
                    <button class="btn-edit" data-id="${templateId}">Изменить</button>
                    <button class="btn-delete" data-id="${templateId}">Удалить</button>
                </div>
            `;
            adminTemplateList.appendChild(item);
        });
    }

    function handleAdminFormSubmit(e) {
        e.preventDefault();
        const id = adminTemplateIdInput.value;
        const templateData = {
            title: document.getElementById("admin-template-title").value,
            text_ru: document.getElementById("admin-template-ru").value,
            text_tj: document.getElementById("admin-template-tj").value,
            tags: document.getElementById("admin-template-tags").value.split(",").map(t => t.trim()).filter(t => t),
        };

        if (id) {
            db.ref('templates/' + id).update(templateData);
        } else {
            templateData.authorId = currentUser.uid;
            templateData.createdAt = new Date().toISOString();
            db.ref('templates').push(templateData);
        }
        resetAdminForm();
    }

    function resetAdminForm() {
        adminTemplateForm.reset();
        adminTemplateIdInput.value = "";
        adminCancelEditBtn.style.display = "none";
    }

    function handleAdminTemplateListClick(e) {
        const target = e.target;
        const templateId = target.getAttribute("data-id");
        if (!templateId) return;

        if (target.classList.contains("btn-edit")) {
            const template = allTemplates[templateId];
            if (template) {
                adminTemplateIdInput.value = templateId;
                document.getElementById("admin-template-title").value = template.title;
                document.getElementById("admin-template-ru").value = template.text_ru;
                document.getElementById("admin-template-tj").value = template.text_tj;
                document.getElementById("admin-template-tags").value = template.tags ? template.tags.join(", ") : '';
                adminCancelEditBtn.style.display = "inline-block";
                window.scrollTo(0, 0);
            }
        }
        if (target.classList.contains("btn-delete")) {
            if (confirm(`Удалить этот шаблон?`)) {
                db.ref('templates/' + templateId).remove();
            }
        }
    }
});