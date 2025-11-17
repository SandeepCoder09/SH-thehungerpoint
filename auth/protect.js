import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // User NOT logged in
        if (!window.location.pathname.includes("/auth/login.html") &&
            !window.location.pathname.includes("/auth/signup.html")) {

            window.location.href = "/auth/login.html";
        }
    } else {
        // User logged in → prevent going back to login screen
        if (window.location.pathname.includes("/auth/login.html") ||
            window.location.pathname.includes("/auth/signup.html")) {

            window.location.href = "/home/index.html";
        }
    }
});