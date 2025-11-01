document.addEventListener("DOMContentLoaded", () => {
    
    const auth = firebase.auth();
    const db = firebase.database();

    // Селекторы для страниц
    const loginPage = document.getElementById("login-page");
    const registerPage = document.getElementById("register-page");

    // Формы
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    
    // Сообщения
    const loginError = document.getElementById("login-error");
    const registerError = document.getElementById("register-error");
    const registerMessage = document.getElementById("register-message");

    // Переключатели Вход/Регистрация
    const showRegisterLink = document.getElementById("show-register");
    const showLoginLink = document.getElementById("show-login");

    // --- Флаг, чтобы избежать "гонки" ---
    // Он не даст onAuthStateChanged сработать, пока идет регистрация
    let registrationInProgress = false;

    // --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ФОРМ ---
    showRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginPage.style.display = "none";
        registerPage.style.display = "flex";
    });
    showLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginPage.style.display = "flex";
        registerPage.style.display = "none";
    });

    // --- ПРОВЕРКА ДЛЯ ТЕХ, КТО УЖЕ ВОШЕЛ ---
    auth.onAuthStateChanged(user => {
        // Если пользователь вошел И НЕ идет процесс регистрации
        if (user && !registrationInProgress) {
            console.log("Уже вошел, проверяем права...");
            checkUserRoleAndRedirect(user);
        } else if (!user) {
            console.log("Нет активной сессии.");
        }
    });

    // --- ВХОД (Без изменений) ---
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        loginError.style.display = "none";
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;

        auth.signInWithEmailAndPassword(email, pass)
            .then(userCredential => {
                console.log("Вход успешен, ждем редирект...");
                // onAuthStateChanged сам сделает редирект
            })
            .catch(error => {
                loginError.textContent = `Ошибка: ${error.message}`;
                loginError.style.display = "block";
            });
    });

    // --- РЕГИСТРАЦИЯ (Исправленная логика) ---
    registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        registerError.style.display = "none";
        registerMessage.style.display = "none";

        // 1. Устанавливаем флаг
        registrationInProgress = true;

        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const pass = document.getElementById("reg-password").value;
        const passConfirm = document.getElementById("reg-password-confirm").value;

        if (pass !== passConfirm) {
            registerError.textContent = "Пароли не совпадают.";
            registerError.style.display = "block";
            registrationInProgress = false; // Снимаем флаг при ошибке
            return;
        }

        // 2. Создаем пользователя в Auth
        auth.createUserWithEmailAndPassword(email, pass)
            .then(userCredential => {
                const user = userCredential.user;
                
                // 3. Создаем запись в Database
                return db.ref('users/' + user.uid).set({
                    name: name,
                    email: email,
                    isAdmin: false,
                    approved: false // Статус "Ожидает"
                });
                // (Мы возвращаем .set(), чтобы .then() дождался его)
            })
            .then(() => {
                // 4. ЗАПИСЬ В БАЗУ УСПЕШНА!
                console.log("Регистрация и запись в DB успешны. Перенаправление...");
                // 5. Теперь вручную перенаправляем.
                window.location.href = "operator.html";
            })
            .catch(error => {
                // 6. Обработка ошибок
                registerError.textContent = `Ошибка: ${error.message}`;
                registerError.style.display = "block";
                registrationInProgress = false; // Снимаем флаг при ошибке
            });
    });

    // --- Функция редиректа (теперь только для входа) ---
    function checkUserRoleAndRedirect(user) {
        // Используем .once(), так как нам не нужно ждать
        db.ref('/users/' + user.uid).once('value').then(snapshot => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                if (userData.isAdmin) {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "operator.html";
                }
            } else {
                // Это может случиться, если админ удалил юзера из DB, но не из Auth
                loginError.textContent = "Ошибка: не найдены данные пользователя.";
                loginError.style.display = "block";
                auth.signOut();
            }
        });
    }
});
