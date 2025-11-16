const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("error");

  errorEl.textContent = "";

  try {
    const res = await fetch(`${SERVER_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.ok) {
      errorEl.textContent = data.error || "Invalid email or password";
      return;
    }

    // Save JWT
    localStorage.setItem("admin_jwt", data.token);

    // Redirect correctly on Vercel
    window.location.href = "/admin/index.html";

  } catch (err) {
    console.error(err);
    errorEl.textContent = "Server error. Try again.";
  }
});

// Password show/hide toggle
document.getElementById("toggleEye").addEventListener("click", () => {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
});
