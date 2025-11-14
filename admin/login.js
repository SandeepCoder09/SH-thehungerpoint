// admin/login.js
// Admin email (as requested)
const ADMIN_EMAIL = "sr07572107@gmail.com";

const auth = firebase.auth();

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errEl = document.getElementById("error");

loginBtn.addEventListener("click", async () => {
  errEl.textContent = "";
  const email = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) {
    errEl.textContent = "Enter email and password.";
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      errEl.textContent = "Unauthorized user.";
      await auth.signOut();
      return;
    }

    // mark logged-in locally; admin pages will check this
    localStorage.setItem("sh_admin_auth", "1");

    // redirect to admin dashboard
    window.location.href = "index.html";
  } catch (e) {
    // friendly error message
    errEl.textContent = e.message || "Failed to sign in.";
  }
});
