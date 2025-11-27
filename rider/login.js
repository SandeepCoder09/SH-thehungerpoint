// rider/login.js
const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";

const $ = (s) => document.querySelector(s);
const form = $("#loginForm");
const idInput = $("#identifier");
const pwInput = $("#password");
const msg = $("#msg");
const btn = $("#btnLogin");

function showMsg(text, isError = true) {
  msg.textContent = text || "";
  msg.style.color = isError ? "#b91c1c" : "#065f46";
  if (!text) msg.style.display = "none";
  else msg.style.display = "block";
}

function normalizeIdentifier(v) {
  v = (v || "").trim();
  if (!v) return {};
  if (/@/.test(v)) return { email: v };
  return { phone: v };
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  showMsg("");
  const identifier = idInput.value.trim();
  const password = pwInput.value.trim();
  if (!identifier || !password) {
    showMsg("Enter identifier & password");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Signing in...";

  const body = Object.assign({ password }, normalizeIdentifier(identifier));

  try {
    const res = await fetch(API_BASE + "/rider/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok || data?.ok === false) {
      showMsg(data?.error || "Login failed");
      btn.disabled = false;
      btn.textContent = "Sign in";
      return;
    }

    // server returns token & riderId
    const token = data.token || data.accessToken || data.data?.token;
    const riderId = data.riderId || data.data?.riderId || data.data?.rider?.id;

    if (!token || !riderId) {
      showMsg("Invalid server response");
      btn.disabled = false;
      btn.textContent = "Sign in";
      return;
    }

    localStorage.setItem("sh_rider_token", token);
    localStorage.setItem("sh_rider_id", riderId);

    showMsg("Login successful — redirecting...", false);
    setTimeout(() => window.location.href = "./index.html", 600);
  } catch (err) {
    console.error("login error", err);
    showMsg("Network error");
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

// if already logged in, redirect
if (localStorage.getItem("sh_rider_token")) {
  window.location.href = "./index.html";
}