// /rider/login.js
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

// server returns riderId and token  
const riderId = data.riderId || data.rider?.riderId || email;  
const token = data.token || "";  

localStorage.setItem("sh_rider_docid", email); // doc id is email  
localStorage.setItem("sh_rider_id", riderId);  
localStorage.setItem("sh_rider_token", token);  
localStorage.setItem("sh_rider_email", email);  

msg.textContent = "Logged in — redirecting…";  
setTimeout(() => (window.location.href = "/rider/index.html"), 300);

} catch (err) {
console.error(err);
msg.textContent = "Network error";
}
});

// allow enter key
passEl.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });
emailEl.addEventListener("keydown", (e) => { if (e.key === "Enter") passEl.focus(); });