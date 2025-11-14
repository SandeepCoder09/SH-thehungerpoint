const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("error");

  errorBox.textContent = "";

  try {
    const res = await fetch(`${SERVER_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!data.ok) {
      errorBox.textContent = data.error;
      return;
    }

    localStorage.setItem("admin_jwt", data.token);
    window.location.href = "index.html";
  } catch (err) {
    errorBox.textContent = "Network error, try again.";
  }
});
