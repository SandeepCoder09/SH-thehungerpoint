// Your backend URL
const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorBox = document.getElementById("error");

  errorBox.textContent = "";

  if (!email || !password) {
    errorBox.textContent = "Both fields are required.";
    return;
  }

  try {
    const res = await fetch(`${SERVER_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.ok) {
      errorBox.textContent = data.error || "Invalid email or password";
      return;
    }

    // Save admin token
    localStorage.setItem("admin_jwt", data.token);

    // Redirect to admin dashboard
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    errorBox.textContent = "Network error, try again.";
  }
});
