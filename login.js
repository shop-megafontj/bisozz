document.addEventListener("DOMContentLoaded", () => {
    
    const auth = firebase.auth();
    const db = firebase.database();

    // Селекторы
    const loginPage = document.getElementById("login-page");
    const registerPage = document.getElementById("register-page");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginError = document.getElementById("login-error");
    const registerError = document.getElementById("register-error");
    const registerMessage = document.getElementById("register-message");
    const showRegisterLink = document.getElementById("show-register");
    const showLoginLink = document.getElementById("show-login");

    let registrationInProgress = false;

    // --- ЛОГИКА TOAST-УВЕДОМЛЕНИЙ ---
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`; // type: success, error, info
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add("show");
        }, 100); // delay for entry animation

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 500); // delay for exit animation
        }, 3000);
    }

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
        if (user && !registrationInProgress) {
            checkUserRoleAndRedirect(user);
        }
    });

    // --- ВХОД ---
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        loginError.style.display = "none";
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;

        auth.signInWithEmailAndPassword(email, pass)
            .catch(error => {
                // loginError.textContent = `Ошибка: ${error.message}`;
                loginError.textContent = "Ошибка: Неверный почта или пароль.";
                loginError.style.display = "block";
                // Заменяем alert на toast
                // showToast(`Ошибка входа: ${error.message}`, "error");
            });
    });

    // --- РЕГИСТРАЦИЯ ---
    registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        registerError.style.display = "none";
        registerMessage.style.display = "none";
        registrationInProgress = true;

        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const pass = document.getElementById("reg-password").value;
        const passConfirm = document.getElementById("reg-password-confirm").value;

        if (pass !== passConfirm) {
            registerError.textContent = "Пароли не совпадают.";
            registerError.style.display = "block";
            registrationInProgress = false;
            return;
        }

        auth.createUserWithEmailAndPassword(email, pass)
            .then(userCredential => {
                const user = userCredential.user;
                // Создаем запись в DB со статусом "Ожидает" (false)
                return db.ref('users/' + user.uid).set({
                    name: name,
                    email: email,
                    isAdmin: false,
                    approved: false // Статус "Ожидает"
                });
            })
            .then(() => {
                // Успешная регистрация
                registerForm.reset();
                showToast("Заявка отправлена! Ожидайте одобрения.", "success");
                
                // Переключаемся на страницу входа
                loginPage.style.display = "flex";
                registerPage.style.display = "none";
            })
            .catch(error => {
                registerError.textContent = `Ошибка: ${error.message}`;
                registerError.style.display = "block";
            })
            .finally(() => {
                registrationInProgress = false;
            });
    });

    // --- ФУНКЦИЯ РЕДИРЕКТА (с новой логикой) ---
    function checkUserRoleAndRedirect(user) {
        db.ref('/users/' + user.uid).once('value').then(snapshot => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                if (userData.isAdmin) {
                    window.location.href = "admin.html";
                } 
                // НОВАЯ ЛОГИКА:
                // Неважно, какой статус (true, false, 'rejected'),
                // всех не-админов отправляем в operator.html.
                // operator.js сам решит, что им показать.
                else {
                    window.location.href = "operator.html";
                }
            } else {
                loginError.textContent = "Ошибка: не найдены данные пользователя.";
                loginError.style.display = "block";
                auth.signOut();
            }
        });
    }
});
