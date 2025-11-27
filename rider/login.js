// /rider/login.js
import {
  db,
  collection,
  query,
  where,
  getDocs
} from "/rider/firebase.js";

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";

const $ = (s) => document.querySelector(s);
const emailEl = $("#email");
const passEl = $("#password");
const btn = $("#btnSignIn");
const msg = $("#msg");

btn.addEventListener("click", async () => {
  const email = (emailEl.value || "").trim();
  const password = (passEl.value || "").trim();
  if (!email || !password) return (msg.textContent = "Provide email and password");

  msg.textContent = "Signing in...";

  try {
    // 1️⃣ Check login using Render backend
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

    const riderId = data.riderId || data.rider?.riderId || email;
    const token = data.token || "";

    // 2️⃣ FETCH REAL FIRESTORE DOC BY EMAIL
    const q = query(collection(db, "riders"), where("email", "==", email));
    const snaps = await getDocs(q);

    if (snaps.empty) {
      msg.textContent = "Rider not found in Firestore";
      return;
    }

    const docSnap = snaps.docs[0];
    const docId = docSnap.id;          // <<< REAL FIRESTORE DOC ID

    // 3️⃣ Save correct values
    localStorage.setItem("sh_rider_docid", docId);
    localStorage.setItem("sh_rider_id", riderId);
    localStorage.setItem("sh_rider_email", email);
    localStorage.setItem("sh_rider_token", token);

    msg.textContent = "Login successful — redirecting…";
    setTimeout(() => (window.location.href = "/rider/index.html"), 300);

  } catch (err) {
    console.error(err);
    msg.textContent = "Network error";
  }
});

// allow enter key
passEl.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });
emailEl.addEventListener("keydown", (e) => { if (e.key === "Enter") passEl.focus(); });