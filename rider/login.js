/* -------------------------------------------
   SH Rider Login System (FINAL WORKING VERSION)
   File: /rider/login.js
-------------------------------------------- */

const SERVER_URL = window.SH?.API_BASE || "https://sh-thehungerpoint.onrender.com";

// DOM shortcuts
const $ = (s) => document.querySelector(s);

// Elements
const emailInput = $("#riderEmail");
const passInput  = $("#riderPassword");
const loginBtn   = $("#loginBtn");
const msgBox     = $("#loginMsg");

/* -----------------------------------------------------
   Toast-like message
----------------------------------------------------- */
function showMsg(text, color = "red") {
  msgBox.textContent = text;
  msgBox.style.color = color;
  msgBox.style.visibility = "visible";
}

/* -----------------------------------------------------
   Save session after login
----------------------------------------------------- */
function saveSession(token, riderId) {
  localStorage.setItem("riderToken", token);
  localStorage.setItem("riderId", riderId);
}

/* -----------------------------------------------------
   Perform login
----------------------------------------------------- */
async function riderLogin() {
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    showMsg("Please enter both fields");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    const res = await fetch(`${SERVER_URL}/rider/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log("Rider Login Response:", data);

    if (!data.ok) {
      showMsg(data.error || "Incorrect credentials");
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
      return;
    }

    // Success
    saveSession(data.token, data.riderId);
    showMsg("Login successful ✔", "green");

    setTimeout(() => {
      window.location.href = "/rider/index.html";
    }, 700);

  } catch (err) {
    console.error("Login error:", err);
    showMsg("Server error. Try again.");
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Login";
}

/* -----------------------------------------------------
   Button click
----------------------------------------------------- */
loginBtn.addEventListener("click", riderLogin);

/* -----------------------------------------------------
   Enter key triggers login
----------------------------------------------------- */
passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") riderLogin();
});
