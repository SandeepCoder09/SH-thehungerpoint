// rider/rider.js
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const API_BASE = window.SH?.API_BASE ?? "";
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const orderContainer = document.getElementById("orderContainer");
const btnLogout = document.getElementById("btnLogout");

// Session Check
const riderId = localStorage.getItem("riderId");
const token = localStorage.getItem("riderToken");

if (!riderId || !token) {
  window.location.replace("/rider/login.html");
}

// Load Rider Name + Email
async function loadRiderProfile() {
  try {
    const ref = doc(db, "riders", riderId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      riderNameEl.textContent = data.name || "Unknown Rider";
      riderEmailEl.textContent = data.email || "";
    } else {
      riderNameEl.textContent = riderId;
    }
  } catch (err) {
    console.error("Profile load error:", err);
    riderNameEl.textContent = riderId;
  }
}

// Logout
btnLogout?.addEventListener("click", () => {
  localStorage.removeItem("riderId");
  localStorage.removeItem("riderToken");
  try { window.socket?.disconnect(); } catch {}
  window.location.href = "/rider/login.html";
});

// Active Orders placeholder
async function loadActiveOrders() {
  orderContainer.innerHTML = "<div class='muted'>No active orders assigned</div>";
}

// GPS Start
function startTrackingWhenReady() {
  if (typeof window.startGPS === "function") {
    window.startGPS();
  } else {
    setTimeout(startTrackingWhenReady, 500);
  }
}

// INIT
(function init() {
  loadRiderProfile();
  loadActiveOrders();
  startTrackingWhenReady();
})();
