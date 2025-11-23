// rider/rider.js
const API_BASE = window.SH?.API_BASE ?? "";
const riderNameEl = document.getElementById("riderName");
const orderContainer = document.getElementById("orderContainer");
const btnLogout = document.getElementById("btnLogout");

// check session
const riderId = localStorage.getItem("riderId");
const token = localStorage.getItem("riderToken");

if (!riderId || !token) {
  // not logged in
  window.location.replace("/rider/login.html");
}

// show rider info
riderNameEl.textContent = riderId;

// logout handler
btnLogout?.addEventListener("click", () => {
  localStorage.removeItem("riderId");
  localStorage.removeItem("riderToken");
  if (window.socket) {
    try { window.socket.disconnect(); } catch {}
  }
  window.location.href = "/rider/login.html";
});

// placeholder function to load active orders from Firestore via your server (optional)
async function loadActiveOrders() {
  try {
    // update when you implement backend API for orders
    orderContainer.innerHTML = "<div class='muted'>No active orders assigned</div>";
  } catch (err) {
    console.error("Load orders error", err);
    orderContainer.innerHTML = "<div class='muted'>Unable to fetch orders</div>";
  }
}

// Start GPS if socket connected (socket-client will set window.socket)
function startTrackingWhenReady() {
  if (typeof window.startGPS === "function") {
    window.startGPS();
  } else {
    // wait a bit
    setTimeout(startTrackingWhenReady, 500);
  }
}

// when socket connects it emits rider:join in socket-client.js
startTrackingWhenReady();
loadActiveOrders();
