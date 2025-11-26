/*  TRACK ORDER PAGE (Swiggy/Zomato Style)  */

const socket = io("https://sh-thehungerpoint.onrender.com"); // your server
const orderId = new URLSearchParams(window.location.search).get("orderId");

const db = firebase.firestore();
let map, riderMarker, userMarker;

/* ---------------- MAP SETUP ---------------- */
function initMap() {
  map = L.map("map").setView([25.927, 80.811], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);
}

/* ---------------- LOAD ORDER INFO ---------------- */
async function loadOrderDetails() {
  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) return;

  const data = doc.data();

  // Items
  const itemsList = document.getElementById("itemsList");
  itemsList.innerHTML = "";
  data.items.forEach(i => {
    itemsList.innerHTML += `${i.name} × ${i.qty}<br>`;
  });

  // ETA & Status
  updateStatus(data.status, data.eta);

  // Customer location
  if (data.userLocation) {
    addUserMarker(data.userLocation.lat, data.userLocation.lng);
  }
}

/* ---------------- MAP MARKERS ---------------- */
function addUserMarker(lat, lng) {
  if (userMarker) map.removeLayer(userMarker);

  userMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
      iconSize: [35, 35]
    })
  }).addTo(map);
}

function updateRiderMarker(lat, lng) {
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
        iconSize: [40, 40]
      })
    }).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }
}

/* ---------------- UPDATE STATUS UI ---------------- */
function updateStatus(status, eta) {
  const statusEl = document.getElementById("orderStatus");
  const etaEl = document.getElementById("etaText");

  if (eta) etaEl.textContent = `${eta} min`;

  if (status === "preparing") {
    statusEl.textContent = "Preparing 🔥";
    activateTimeline(1);
  } else if (status === "out_for_delivery") {
    statusEl.textContent = "Out for Delivery 🚴‍♂️";
    activateTimeline(2);
  } else if (status === "delivered") {
    statusEl.textContent = "Delivered ✅";
    activateTimeline(3);
  }
}

/* ---------------- TIMELINE STEPS ---------------- */
function activateTimeline(step) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));

  if (step === 1) document.getElementById("step1").classList.add("active");
  if (step === 2) document.getElementById("step2").classList.add("active");
  if (step === 3) document.getElementById("step3").classList.add("active");
}

/* ---------------- SOCKET: LIVE RIDER LOCATION ---------------- */
socket.emit("order:join", { orderId });

socket.on("order:riderLocation", (data) => {
  if (data.orderId === orderId) {
    updateRiderMarker(data.lat, data.lng);
  }
});

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadOrderDetails();
});