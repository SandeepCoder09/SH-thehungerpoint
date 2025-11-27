// rider/rider.js
// New clean version with:
// - Rider profile (photo, name, email)
// - Online / Offline toggle
// - Order accept / pickup / delivered
// - Socket + GPS integration (rider-gps.js handles GPS sending)
// - Firestore live order fetching

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot
} from "./firebase.js";

import { connectSocket, getSocket } from "./socket-client.js";

// -----------------------------------------
// BASIC AUTH
// -----------------------------------------
const riderId = localStorage.getItem("sh_rider_id");
const token   = localStorage.getItem("sh_rider_token");

if (!riderId || !token) {
  window.location.href = "./login.html";
}

// -----------------------------------------
// DOM REFERENCES
// -----------------------------------------
const riderNameEl   = document.getElementById("riderName");
const riderEmailEl  = document.getElementById("riderEmail");
const riderPhotoEl  = document.getElementById("riderPhoto");
const riderOnlineEl = document.getElementById("onlineToggle");
const onlineStatus  = document.getElementById("onlineStatus");

const connStatus    = document.getElementById("connStatus");
const ordersList    = document.getElementById("ordersList");
const activeOrderEl = document.getElementById("activeOrder");

const btnAccept     = document.getElementById("btnAccept");
const btnStartTrip  = document.getElementById("btnStartTrip");
const btnDelivered  = document.getElementById("btnDeliver");
const btnLogout     = document.getElementById("btnLogout");

// -----------------------------------------
// MAP SETUP (Leaflet)
// -----------------------------------------
let map = L.map("map").setView([23.1, 82.0], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: ""
}).addTo(map);

let riderMarker = null;
let customerMarkers = new Map();

function setRiderMarker(lat, lng) {
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng], { title: "You" }).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }
}

function setCustomerMarker(orderId, lat, lng) {
  if (customerMarkers.has(orderId)) {
    customerMarkers.get(orderId).setLatLng([lat, lng]);
  } else {
    const m = L.marker([lat, lng], { title: "Customer" }).addTo(map);
    customerMarkers.set(orderId, m);
  }
}

// -----------------------------------------
// LOAD RIDER PROFILE
// -----------------------------------------
async function loadRiderProfile() {
  const ref = doc(db, "riders", riderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  riderNameEl.textContent  = data.name || "Rider";
  riderEmailEl.textContent = data.email || "";
  riderPhotoEl.src         = data.photoURL || "/home/SH-Favicon.png";

  // Online status
  riderOnlineEl.checked    = data.online === true;
  onlineStatus.textContent = data.online ? "Online" : "Offline";
}

// Update Firestore when rider toggles online/offline
riderOnlineEl.addEventListener("change", async () => {
  try {
    await updateDoc(doc(db, "riders", riderId), {
      online: riderOnlineEl.checked
    });

    onlineStatus.textContent = riderOnlineEl.checked ? "Online" : "Offline";

  } catch (err) {
    console.error("Failed to update online status", err);
  }
});

// -----------------------------------------
// SOCKET CONNECTION
// -----------------------------------------
let socket = null;

async function initSocket() {
  try {
    socket = await connectSocket({ riderId, token });

    connStatus.textContent = "Connected";
    connStatus.style.color = "lightgreen";

    // Receive rider location updates for current order
    socket.on("order:riderLocation", (data) => {
      if (data.riderId === riderId) {
        setRiderMarker(data.lat, data.lng);
      }
    });

    // Order status updates pushed by admin
    socket.on("order:status", (data) => {
      if (!data || !data.orderId) return;
      ordersState[data.orderId] = {
        ...(ordersState[data.orderId] || {}),
        status: data.status
      };
      renderOrders();
    });

  } catch (err) {
    connStatus.textContent = "Disconnected";
    connStatus.style.color = "crimson";
  }
}

// -----------------------------------------
// FIRESTORE LIVE ORDER LISTENER
// -----------------------------------------
let ordersState = {};

onSnapshot(collection(db, "orders"), (snap) => {
  snap.forEach((docu) => {
    const data = docu.data();
    ordersState[docu.id] = {
      orderId: docu.id,
      ...data
    };
  });
  renderOrders();
});

// -----------------------------------------
// RENDER ORDERS LIST
// -----------------------------------------
let selectedOrder = null;

function renderOrders() {
  ordersList.innerHTML = "";

  const list = Object.values(ordersState)
    .filter(o => !o.riderId || o.riderId === riderId) // show unassigned + assigned to rider
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    ordersList.innerHTML = `<div class="small muted">No orders available</div>`;
    return;
  }

  list.forEach(o => {
    const card = document.createElement("div");
    card.className = "order-card";

    const items = (o.items || [])
      .map(i => `${i.name} × ${i.qty}`)
      .join(", ");

    card.innerHTML = `
      <div>
        <div style="font-weight:700">${o.orderId}</div>
        <div class="small">${o.status || "new"}</div>
        <div class="small">${items}</div>
      </div>
    `;

    card.onclick = () => selectOrder(o.orderId);
    ordersList.appendChild(card);
  });
}

// -----------------------------------------
// SELECT ORDER
// -----------------------------------------
function selectOrder(orderId) {
  selectedOrder = orderId;
  activeOrderEl.textContent = orderId;

  const o = ordersState[orderId];

  if (o && o.customerLoc) {
    setCustomerMarker(orderId, o.customerLoc.lat, o.customerLoc.lng);
  }

  if (riderMarker && o && o.customerLoc) {
    const group = new L.featureGroup([
      riderMarker,
      customerMarkers.get(orderId)
    ]);
    map.fitBounds(group.getBounds().pad(0.3));
  }
}

// -----------------------------------------
// ACCEPT ORDER
// -----------------------------------------
btnAccept.addEventListener("click", async () => {
  if (!selectedOrder) return alert("Select an order first");

  await updateDoc(doc(db, "orders", selectedOrder), {
    riderId,
    status: "accepted",
    acceptedAt: Date.now()
  });

  socket?.emit("order:status", {
    orderId: selectedOrder,
    status: "accepted"
  });
});

// -----------------------------------------
// START TRIP (GPS STARTS IN rider-gps.js AUTOMATICALLY)
// -----------------------------------------
btnStartTrip.addEventListener("click", async () => {
  if (!selectedOrder) return alert("Select an order first");

  await updateDoc(doc(db, "orders", selectedOrder), {
    status: "picked",
    pickedAt: Date.now()
  });

  socket?.emit("order:status", {
    orderId: selectedOrder,
    status: "picked"
  });

  alert("Trip started — GPS tracking active");
});

// -----------------------------------------
// MARK DELIVERED
// -----------------------------------------
btnDelivered.addEventListener("click", async () => {
  if (!selectedOrder) return alert("Select an order first");

  await updateDoc(doc(db, "orders", selectedOrder), {
    status: "delivered",
    deliveredAt: Date.now()
  });

  socket?.emit("order:status", {
    orderId: selectedOrder,
    status: "delivered"
  });

  alert("Order marked delivered");
});

// -----------------------------------------
// LOGOUT
// -----------------------------------------
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("sh_rider_token");
  localStorage.removeItem("sh_rider_id");
  window.location.href = "./login.html";
});

// -----------------------------------------
// INIT
// -----------------------------------------
(async function init() {
  await loadRiderProfile();
  await initSocket();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      setRiderMarker(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 14);
    });
  }
})();