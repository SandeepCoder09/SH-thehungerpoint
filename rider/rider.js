// SCREEN ELEMENTS
const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const riderNameEl = document.getElementById("riderName");

// LOGIN ELEMENTS
const emailInput = document.getElementById("riderEmail");
const passInput = document.getElementById("riderPass");
const loginBtn = document.getElementById("loginBtn");

// LOGOUT
const logoutBtn = document.getElementById("logoutBtn");


// -------------------------------
// SHOW / HIDE SCREENS
// -------------------------------
function showLogin() {
  loginScreen.classList.add("active");
  dashboardScreen.classList.remove("active");
}

function showDashboard() {
  loginScreen.classList.remove("active");
  dashboardScreen.classList.add("active");
}


// -------------------------------
// CHECK IF RIDER IS ALREADY LOGGED IN
// -------------------------------
const savedRiderId = localStorage.getItem("riderId");
const savedToken = localStorage.getItem("riderToken");

if (savedRiderId && savedToken) {
  checkApproval(savedRiderId);
}


// -------------------------------
// LOGIN LOGIC
// -------------------------------
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  const res = await fetch("/rider/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error);
    return;
  }

  // SAVE LOGIN SESSION
  localStorage.setItem("riderId", data.riderId);
  localStorage.setItem("riderToken", data.token);

  checkApproval(data.riderId);
});


// -------------------------------
// APPROVAL CHECK
// -------------------------------
async function checkApproval(riderId) {
  const res = await fetch("/rider/check?riderId=" + riderId);
  const data = await res.json();

  if (!data.ok) {
    alert("Not approved yet.");
    showLogin();
    return;
  }

  // APPROVED → show dashboard + start GPS
  riderNameEl.innerText = riderId;
  showDashboard();

  startGPS(); // from rider-gps.js
}


// -------------------------------
// LOGOUT
// -------------------------------
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("riderId");
  localStorage.removeItem("riderToken
