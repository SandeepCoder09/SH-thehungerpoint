const API_BASE = "https://sh-thehungerpoint.onrender.com";  // your server

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnLogin");

btn.addEventListener("click", login);

async function login() {
  const identifier = emailEl.value.trim();
  const password = passEl.value.trim();

  msg.textContent = "";

  if (!identifier || !password) {
    msg.textContent = "Enter email & password";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/rider/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: identifier,
        phone: identifier,
        riderId: identifier,
        password
      })
    });

    const data = await res.json();

    if (!data.ok) {
      msg.textContent = data.error || "Login failed";
      return;
    }

    // save session
    localStorage.setItem("sh_rider_id", data.riderId);
    localStorage.setItem("sh_rider_email", data.email);
    localStorage.setItem("sh_rider_name", data.name);
    localStorage.setItem("sh_rider_token", data.token);

    window.location.href = "/rider/index.html";

  } catch (err) {
    console.error(err);
    msg.textContent = "Network error";
  }
}
