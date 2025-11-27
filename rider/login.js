// rider/login.js
const SERVER_BASE = window.SH?.API_BASE || "https://sh-thehungerpoint.onrender.com";

const elEmail = document.getElementById("email");
const elPass = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnDemo = document.getElementById("btnDemo");
const msg = document.getElementById("msg");

btnDemo.addEventListener("click", () => {
  elEmail.value = "harshharshkumar624@gmail.com";
  elPass.value = "password"; // fill with demo - replace with actual
});

btnLogin.addEventListener("click", async () => {
  const email = (elEmail.value || "").trim();
  const password = (elPass.value || "").trim();
  if (!email || !password) {
    msg.textContent = "Please enter email and password";
    return;
  }

  msg.textContent = "Signing in…";

  try {
    const res = await fetch(SERVER_BASE + "/rider/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!data.ok) {
      msg.textContent = data.error || "Login failed";
      return;
    }

    // server returns { ok:true, riderId, token }
    // NOTE: riderId returned here is rider doc id (as server earlier implemented)
    const docId = data.riderId || email;
    localStorage.setItem("sh_rider_id", docId);
    localStorage.setItem("sh_rider_token", data.token || "");

    msg.textContent = "Logged in — redirecting…";
    setTimeout(() => location.href = "./index.html", 400);
  } catch (err) {
    console.error(err);
    msg.textContent = "Network error";
  }
});
