// admin/modern/login.js
const API = "https://sh-thehungerpoint.onrender.com";
const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    const res = await fetch(API + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const j = await res.json();
    if (j.ok && j.token) {
      localStorage.setItem("admin_jwt", j.token);
      window.location.href = "/admin/modern/dashboard.html";
    } else {
      msg.textContent = j.error || "Login failed";
    }
  } catch (err) {
    msg.textContent = "Server error";
  }
});
