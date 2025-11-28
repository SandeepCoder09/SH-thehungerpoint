// /rider/login.js
import { auth, signInWithEmailAndPassword } from "/rider/firebase.js";

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";

const $ = (s) => document.querySelector(s);
const emailEl = $("#email");
const passEl = $("#password");
const btn = $("#btnSignIn");
const msg = $("#msg");

btn.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  const password = passEl.value.trim();

  if (!email || !password) {
    msg.textContent = "Please enter email & password";
    return;
  }

  msg.textContent = "Signing in...";

  try {
    // 1. Firebase Auth Login (required for Firestore rules)
    const fbUser = await signInWithEmailAndPassword(auth, email, password);

    // 2. Backend login (to get riderId + token)
    const res = await fetch(API_BASE + "/rider/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!data.ok) {
      msg.textContent = data.error || "Login failed";
      return;
    }

    const riderId = data.riderId || email;

    // Save session
    localStorage.setItem("sh_rider_docid", email);
    localStorage.setItem("sh_rider_id", riderId);
    localStorage.setItem("sh_rider_email", email);
    localStorage.setItem("sh_rider_token", data.token || "");

    msg.textContent = "Login successful! Redirecting...";

    setTimeout(() => {
      window.location.href = "/rider/index.html";
    }, 500);
  } catch (err) {
    console.error(err);
    msg.textContent = "Invalid email or password";
  }
});
