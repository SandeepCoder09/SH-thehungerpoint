const API = "https://sh-thehungerpoint.onrender.com";

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");
const btn = document.querySelector(".login-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // Disable button + start animation
  btn.disabled = true;
  btn.innerHTML = `<div class="loader"></div> Logging in...`;
  btn.classList.add("loading");

  msg.textContent = "";
  msg.style.color = "#ffecec";

  try {
    const res = await fetch(API + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      // Failed
      msg.textContent = data.error || "Invalid email or password";
      msg.style.color = "#ffb3b3";

      btn.disabled = false;
      btn.classList.remove("loading");
      btn.innerHTML = "Sign In";
      return;
    }

    // Success animation
    msg.textContent = "Login successful!";
    msg.style.color = "#d4ffd9";

    btn.innerHTML = `✔ Logged in`;
    btn.style.background = "#2ecc71";
    btn.style.color = "#fff";

    localStorage.setItem("admin_jwt", data.token);

    setTimeout(() => {
      window.location.href = "/admin/index.html";
    }, 900);

  } catch (err) {
    msg.textContent = "Server error. Please try again.";
    msg.style.color = "#ffb3b3";

    btn.disabled = false;
    btn.classList.remove("loading");
    btn.innerHTML = "Sign In";
  }
});
