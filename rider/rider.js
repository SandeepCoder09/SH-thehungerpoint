// rider/rider.js
// Main UI + logic. Relies on socket-client.js, rider-gps.js and firebase.js

import { db, collection, onSnapshot, doc, updateDoc, getDocs } from "./firebase.js";
import { connectSocket, getSocket } from "./socket-client.js";

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const riderId = localStorage.getItem("sh_rider_id");
const token = localStorage.getItem("sh_rider_token");

if (!riderId || !token) {
  window.location.href = "./login.html";
}

// DOM
const riderIdSpan = document.getElementById("riderIdSpan");
const connStatus = document.getElementById("connStatus");
const logArea = document.getElementById("logArea");
const ordersList = document.getElementById("ordersList");
const currentOrderSpan = document.getElementById("activeOrder");
const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");

riderIdSpan.textContent = riderId;

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logArea.textContent = `[${t}] ${msg}\n` + logArea.textContent;
}

// Map setup
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);
let riderMarker = null;
let customerMarkers = new Map();
let selectedOrderId = null;
let ordersState = {}; // id -> order

function setRiderMarker(lat, lng) {
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng], { title: "You (rider)" }).addTo(map);
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

function fitBothMarkers(orderId) {
  const c = customerMarkers.get(orderId);
  if (!c || !riderMarker) return;
  const group = new L.featureGroup([riderMarker, c]);
  map.fitBounds(group.getBounds().pad(0.25));
}

// Socket connect
let socket = null;
async function startSocket() {
  try {
    socket = await connectSocket({ token, riderId });
    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";
    socket.on("order:riderLocation", (p) => {
      if (!p) return;
      if (p.riderId === riderId) {
        setRiderMarker(p.lat, p.lng);
      }
      // update UI if relevant
      if (p.orderId && ordersState[p.orderId] && ordersState[p.orderId].customerLoc) {
        const c = ordersState[p.orderId].customerLoc;
        setCustomerMarker(p.orderId, c.lat, c.lng);
        if (selectedOrderId === p.orderId) fitBothMarkers(p.orderId);
      }
    });

    socket.on("order:status", (p) => {
      if (!p || !p.orderId) return;
      ordersState[p.orderId] = ordersState[p.orderId] || {};
      ordersState[p.orderId].status = p.status;
      renderOrders();
      if (selectedOrderId === p.orderId) showSelectedOrder(p.orderId);
    });

    socket.on("admin:orderAssigned", (p) => {
      log("admin assigned order: " + (p.orderId || "unknown"));
      // rely on Firestore snapshot to refresh
    });

  } catch (err) {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
    log("socket error: " + (err.message||err));
  }
}

// Firestore snapshot (listen to orders collection)
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  snap.docChanges().forEach(ch => {
    const id = ch.doc.id;
    const data = { orderId: id, ...(ch.doc.data() || {}) };
    ordersState[id] = data;
  });
  renderOrders();
});

// Render order list
function renderOrders() {
  ordersList.innerHTML = "";
  const arr = Object.values(ordersState).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  if (!arr.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }
  for (const o of arr) {
    // show if assigned to this rider or unassigned/new
    if (o.riderId && o.riderId !== riderId && o.riderId !== null) continue;
    const card = document.createElement("div");
    card.className = "order-card";
    const itemsText = (o.items || []).map(i => `${i.name}×${i.qty}`).join(", ");
    card.innerHTML = `
      <div>
        <div style="font-weight:700">${o.orderId}</div>
        <div class="small">${o.status || "new"}</div>
        <div class="small">${itemsText}</div>
      </div>
      <div class="order-actions"></div>
    `;
    card.onclick = () => selectOrder(o.orderId);

    const actions = card.querySelector(".order-actions");
    const btnView = document.createElement("button"); btnView.className = "btn ghost"; btnView.textContent = "View"; btnView.onclick = (ev) => { ev.stopPropagation(); selectOrder(o.orderId); };
    const btnAccept = document.createElement("button"); btnAccept.className = "btn"; btnAccept.textContent = "Accept"; btnAccept.onclick = (ev) => { ev.stopPropagation(); acceptOrder(o.orderId); };
    actions.appendChild(btnView); actions.appendChild(btnAccept);

    ordersList.appendChild(card);
  }
}

function showSelectedOrder(orderId) {
  selectedOrderId = orderId;
  const o = ordersState[orderId] || {};
  currentOrderSpan.textContent = orderId || "—";
  if (o.customerLoc) {
    setCustomerMarker(orderId, o.customerLoc.lat, o.customerLoc.lng);
  }
  if (riderMarker && o.customerLoc) {
    fitBothMarkers(orderId);
  } else if (riderMarker) {
    map.setView(riderMarker.getLatLng(), 13);
  }
  log("Selected order " + orderId);
}

async function selectOrder(orderId) {
  showSelectedOrder(orderId);
}

// Accept order: write riderId & update status in Firestore
async function acceptOrder(orderId) {
  if (!orderId) return alert("No order id");
  try {
    await updateDoc(doc(db, "orders", orderId), { riderId, status: "accepted", acceptedAt: Date.now() });
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId, status: "accepted" });
    log("Accepted " + orderId);
  } catch (err) {
    console.error(err);
    alert("Accept failed. Check Firestore rules or network.");
  }
}

// Start sharing: set status 'picked' and start geolocation watch
let watchId = null;
function startSharing() {
  if (!selectedOrderId) return alert("Select an order first");
  if (watchId) return alert("Already sharing");
  // change status to 'picked'
  updateDoc(doc(db, "orders", selectedOrderId), { status: "picked", pickedAt: Date.now() }).catch(e => console.warn(e));
  const s = getSocket();
  if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "picked" });

  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  watchId = navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    setRiderMarker(lat, lng);
    const payload = { riderId, lat, lng, orderId: selectedOrderId, timestamp: Date.now() };
    const sock = getSocket();
    if (sock && sock.connected) sock.emit("rider:location", payload);
  }, (err) => {
    console.warn("geo err", err);
    log("GPS error: " + (err.message || err.code));
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });

  log("Started sharing location for " + selectedOrderId);
}

// Stop sharing
function stopSharing() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    log("Stopped sharing");
  }
}

// Mark delivered
async function markDelivered() {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "delivered", deliveredAt: Date.now() });
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "delivered" });
    stopSharing();
    log("Marked delivered: " + selectedOrderId);
  } catch (err) {
    console.error(err);
    alert("Deliver failed");
  }
}

// helpers to get socket from socket-client module
import { getSocket } from "./socket-client.js";
function getSocket() { return getSocket(); } // local wrapper

btnAcceptSelected?.addEventListener("click", () => {
  if (!selectedOrderId) return alert("Select an order first");
  acceptOrder(selectedOrderId);
});
btnStartTrip?.addEventListener("click", () => startSharing());
btnDeliver?.addEventListener("click", () => markDelivered());
btnLogout?.addEventListener("click", () => {
  localStorage.removeItem("sh_rider_token");
  localStorage.removeItem("sh_rider_id");
  window.location.href = "./login.html";
});
btnBack?.addEventListener("click", () => window.history.back());

// init
(async function init() {
  await startSocket();
  // try get current location to show rider marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => {
      setRiderMarker(p.coords.latitude, p.coords.longitude);
      map.setView([p.coords.latitude, p.coords.longitude], 13);
    }, () => {}, { enableHighAccuracy: true });
  }
})();