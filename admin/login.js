// admin/login.js
const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";

const inputEmail = document.getElementById("inputEmail");
const inputPassword = document.getElementById("inputPassword");
const btnLogin = document.getElementById("btnLogin");
const loginMsg = document.getElementById("loginMsg");

function setMsg(txt) { loginMsg.textContent = txt || ""; }

btnLogin.addEventListener("click", async () => {
  setMsg("");
  const email = (inputEmail.value || "").trim();
  const password = (inputPassword.value || "").trim();

  if (!email || !password) {
    setMsg("Enter email & password");
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Signing in...";

  try {
    const res = await fetch(API_BASE + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setMsg(data.error || "Invalid credentials");
      btnLogin.disabled = false;
      btnLogin.textContent = "Login";
      return;
    }

    // store token
    const token = data.token;
    if (!token) {
      setMsg("No token returned from server");
      btnLogin.disabled = false;
      btnLogin.textContent = "Login";
      return;
    }

    localStorage.setItem("adminToken", token);
    // redirect to admin dashboard
    window.location.href = "/admin/index.html";
  } catch (err) {
    console.error("login error", err);
    setMsg("Server error");
    btnLogin.disabled = false;
    btnLogin.textContent = "Login";
  }
});