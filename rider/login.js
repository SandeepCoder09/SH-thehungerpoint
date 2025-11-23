/* -------------------------------------------
   SH Rider Login System (Fixed & Optimized)
   File: /rider/login.js
-------------------------------------------- */

// YOUR backend server base URL
const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

// DOM helpers
const $ = (s) => document.querySelector(s);

// Elements
const emailInput = $("#riderEmail");
const passInput = $("#riderPassword");
const loginBtn  = $("#loginBtn");
const msgBox    = $("#loginMsg");

/* -----------------------------------------------------
   Toast Message Helper
----------------------------------------------------- */
function showMsg(text, color = "red") {
  msgBox.textContent = text;
  msgBox.style.color = color;
  msgBox.style.visibility = "visible";
}

/* -----------------------------------------------------
   Save rider session
----------------------------------------------------- */
function saveSession(token, riderId) {
  localStorage.setItem("riderToken", token);
  localStorage.setItem("riderId", riderId);
}

/* -----------------------------------------------------
   Login Function
----------------------------------------------------- */
async function riderLogin() {
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    showMsg("Please enter all fields");
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
    console.log("Login Response:", data);

    if (!data.ok) {
      showMsg(data.error || "Invalid credentials");
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
      return;
    }

    // Save session
    saveSession(data.token, data.riderId);

    showMsg("Login successful ✔", "green");

    // Redirect to rider dashboard
    setTimeout(() => {
      window.location.href = "/rider/index.html";
    }, 800);

  } catch (err) {
    console.error("Login error:", err);
    showMsg("Server error, try again");
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Login";
}

/* -----------------------------------------------------
   Button click
----------------------------------------------------- */
loginBtn.addEventListener("click", riderLogin);

/* -----------------------------------------------------
   Enter key support
----------------------------------------------------- */
passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") riderLogin();
});
