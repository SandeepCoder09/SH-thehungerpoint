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

  msg.textContent = "Checking rider account...";

  try {
    // 🚫 IMPORTANT FIX:
    // DO NOT auto-create Firebase user for riders.
    // We try sign-in, but if rider doesn't exist in Firebase Auth,
    // we DO NOT create them.

    const fbUser = await signInWithEmailAndPassword(auth, email, password)
      .catch(() => null); // Prevent Firebase error from breaking flow

    if (!fbUser) {
      msg.textContent = "Invalid credentials (Firebase auth)";
      return;
    }

    // 2️⃣ Backend login (MAIN AUTHENTICATION)
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

    // 3️⃣ Rider MUST exist in Firestore /riders
    const riderDoc = data.riderId || email;

    // Save rider session
    localStorage.setItem("sh_rider_docid", email);
    localStorage.setItem("sh_rider_id", riderDoc);
    localStorage.setItem("sh_rider_email", email);
    localStorage.setItem("sh_rider_token", data.token || "");

    msg.textContent = "Login successful! Redirecting...";

    setTimeout(() => {
      window.location.href = "/rider/index.html";
    }, 600);

  } catch (err) {
    console.error(err);
    msg.textContent = "Invalid email or password";
  }
});
