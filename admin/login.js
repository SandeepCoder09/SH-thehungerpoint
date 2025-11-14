const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const errorEl = document.getElementById("error");
const loginBtn = document.getElementById("loginBtn");

// Admin email (Lock login to only your admin account)
const ADMIN_EMAIL = "sr07572107@gmail.com";

loginBtn.addEventListener("click", async () => {
  errorEl.textContent = "";

  const email = emailEl.value.trim();
  const password = passEl.value.trim();

  if (!email || !password) {
    errorEl.textContent = "Please enter email & password";
    return;
  }

  if (email !== ADMIN_EMAIL) {
    errorEl.textContent = "Access denied: Not an admin";
    return;
  }

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);

    // Save session
    localStorage.setItem("sh_admin_auth", "1");

    // Redirect
    window.location.href = "index.html";

  } catch (err) {
    errorEl.textContent = err.message;
  }
});
