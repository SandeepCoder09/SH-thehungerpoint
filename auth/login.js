// login.js

const $ = (s) => document.querySelector(s);
const toast = $("#toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 3000);
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("#email").value.trim();
  const password = $("#password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast("Logged in! Redirecting...");
    setTimeout(() => (window.location = "/"), 1200);
  } catch (err) {
    showToast(err.message);
  }
});

// Google Login
document.getElementById("googleLogin").addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    await auth.signInWithPopup(provider);
    showToast("Welcome!");
    setTimeout(() => (window.location = "/"), 1000);
  } catch (err) {
    showToast(err.message);
  }
});