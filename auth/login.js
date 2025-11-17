// login.js — Firebase email/password login
const $ = (s) => document.querySelector(s);

function showToast(msg, ms = 2400) {
  const container = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function setError(msg) {
  $("#error").textContent = msg || "";
}

// toggle password
$("#togglePw")?.addEventListener("click", () => {
  const pw = $("#password");
  if (pw.type === "password") {
    pw.type = "text";
    $("#togglePw").textContent = "🙈";
  } else {
    pw.type = "password";
    $("#togglePw").textContent = "👁️";
  }
});

// login flow
$("#loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");

  const email = $("#email").value.trim();
  const password = $("#password").value;

  if (!email || !password) {
    setError("Enter email & password");
    return;
  }

  $("#loginBtn").disabled = true;

  try {
    const auth = firebase.auth();
    await auth.signInWithEmailAndPassword(email, password);

    showToast("Logging in…");

    setTimeout(() => {
      window.location.href = "/home/index.html";
    }, 900);

  } catch (err) {
    console.error(err);
    let msg = "Login failed";

    if (err.code === "auth/user-not-found") msg = "No account found.";
    if (err.code === "auth/wrong-password") msg = "Incorrect password.";
    if (err.code === "auth/invalid-email") msg = "Invalid email.";

    setError(msg);
    showToast(msg, 3000);
    $("#loginBtn").disabled = false;
  }
});

// password reset
$("#forgotLink")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = $("#email").value.trim();
  if (!email) {
    setError("Enter email to reset password");
    return;
  }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showToast("Reset email sent!");
  } catch (err) {
    console.error(err);
    showToast("Reset failed");
  }
});