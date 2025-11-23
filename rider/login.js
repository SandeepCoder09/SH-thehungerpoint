// rider/login.js
const API_BASE = window.SH?.API_BASE ?? "";

// UI refs
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const infoEl = document.getElementById("info");

function showInfo(text = "", isError = true) {
  infoEl.textContent = text;
  infoEl.style.color = isError ? "#ffd6d6" : "#b7f5d3";
}

async function checkApprovalAndGo(riderId, token) {
  try {
    showInfo("Checking approval...", false);

    const url = new URL(API_BASE + "/rider/check", location.origin);
    url.searchParams.set("riderId", riderId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await res.json();

    if (!data.ok) {
      showInfo(data.error || "Not approved yet.");
      return false;
    }

    // Approved — redirect to dashboard
    showInfo("Approved — redirecting...", false);
    localStorage.setItem("riderId", riderId);
    localStorage.setItem("riderToken", token);

    // Use replace to avoid back navigation to login
    window.location.replace("/rider/index.html");
    return true;

  } catch (err) {
    console.error("Approval check error:", err);
    showInfo("Unable to verify approval");
    return false;
  }
}

async function tryAutoLogin() {
  const storedRiderId = localStorage.getItem("riderId");
  const storedToken = localStorage.getItem("riderToken");
  if (storedRiderId && storedToken) {
    await checkApprovalAndGo(storedRiderId, storedToken);
  }
}

btnLogin?.addEventListener("click", async () => {
  const email = (emailEl.value || "").trim();
  const password = (passEl.value || "").trim();

  if (!email || !password) {
    showInfo("Enter email and password");
    return;
  }

  try {
    showInfo("Signing in...", false);

    const res = await fetch(API_BASE + "/rider/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.ok) {
      showInfo(data.error || "Login failed");
      return;
    }

    // Save and check approval
    localStorage.setItem("riderId", data.riderId);
    localStorage.setItem("riderToken", data.token);

    await checkApprovalAndGo(data.riderId, data.token);

  } catch (err) {
    console.error("Login error:", err);
    showInfo("Network error — try again");
  }
});

// try auto-login on load
tryAutoLogin();
