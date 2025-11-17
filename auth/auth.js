/* ===========================================================
   The Hunger Point — Firebase Auth System
   Features:
   - Signup (Email + Password + Phone)
   - Login (Email/Password)
   - OTP Login (Firebase PhoneAuth)
   - Firestore User Profile Sync
   - Redirect to /home/index.html after login
=========================================================== */

// Firestore references
const db = firebase.firestore();

/* ---------------------------
   PAGE DETECTION
---------------------------- */
const page = document.body.dataset.page; 
// login, signup, otp

/* ---------------------------
   HELPERS
---------------------------- */
function $(s) { return document.querySelector(s); }
function showError(msg) {
    alert(msg);
}
function redirectHome() {
    window.location.href = "/home/index.html";
}

/* ===========================================================
   1️⃣ SIGNUP PAGE HANDLER
=========================================================== */
if (page === "signup") {
    
    $("#signupForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = $("#name").value.trim();
        const email = $("#email").value.trim();
        const phone = $("#phone").value.trim();
        const pass = $("#password").value.trim();

        if (name === "" || email === "" || phone === "" || pass === "") {
            return showError("All fields are required");
        }

        try {
            // Create user
            const userCred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
            const uid = userCred.user.uid;

            // Store user profile
            await db.collection("users").doc(uid).set({
                name,
                email,
                phone,
                createdAt: new Date(),
            });

            alert("Account created successfully!");
            redirectHome();

        } catch (err) {
            showError(err.message);
        }
    });
}

/* ===========================================================
   2️⃣ LOGIN PAGE HANDLER
=========================================================== */
if (page === "login") {

    $("#loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = $("#email").value.trim();
        const pass = $("#password").value.trim();

        if (email === "" || pass === "") {
            return showError("Enter email and password");
        }

        try {
            await firebase.auth().signInWithEmailAndPassword(email, pass);
            redirectHome();
        } catch (err) {
            showError(err.message);
        }
    });

    // OTP Login → redirect to OTP page
    $("#otpLoginBtn")?.addEventListener("click", () => {
        window.location.href = "/auth/otp.html";
    });
}

/* ===========================================================
   3️⃣ OTP LOGIN PAGE HANDLER
=========================================================== */

if (page === "otp") {

    // Firebase Recaptcha
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("otp-btn", {
        size: "invisible",
    });

    let confirmationResult = null;

    // STEP 1 — Send OTP
    $("#otpForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const phone = $("#phone").value.trim();

        if (phone.length < 10) {
            return showError("Enter valid phone number");
        }

        try {
            confirmationResult = await firebase.auth()
                .signInWithPhoneNumber("+91" + phone, window.recaptchaVerifier);

            $(".otp-box").classList.remove("hidden");
            $("#phone").disabled = true;

            alert("OTP sent!");

        } catch (error) {
            console.error(error);
            showError("OTP sending failed");
        }
    });

    // STEP 2 — Verify OTP
    $("#verifyOtpBtn")?.addEventListener("click", async () => {
        const code = $("#otp").value.trim();

        if (code.length < 6) return showError("Enter valid OTP");

        try {
            const result = await confirmationResult.confirm(code);
            const user = result.user;

            // Sync user profile in Firestore if not exists
            const ref = db.collection("users").doc(user.uid);
            const doc = await ref.get();

            if (!doc.exists) {
                await ref.set({
                    phone: user.phoneNumber,
                    createdAt: new Date(),
                });
            }

            alert("Login successful!");
            redirectHome();

        } catch (err) {
            showError("Invalid OTP");
        }
    });

}

/* ===========================================================
   AUTO REDIRECT IF ALREADY LOGGED IN
=========================================================== */

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        if (["login", "signup", "otp"].includes(page)) {
            redirectHome();
        }
    }
});
