// rider/rider.js
// Main dashboard script

import {
  db, doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs, getDocFromCache
} from "./firebase.js";
import { connectSocket, getSocket } from "./socket-client.js";
import RIDER_GPS from "./rider-gps.js";
import { storageRef, uploadBytes, getDownloadURL } from "./firebase.js";

const SERVER_BASE = window.SH?.API_BASE || "https://sh-thehungerpoint.onrender.com";

const riderDocId = localStorage.getItem("sh_rider_id");
const token = localStorage.getItem("sh_rider_token");

if (!riderDocId || !token) {
  window.location.href = "./login.html";
}

// Expose db globally for rider-gps fallback (optional)
window.__FIRESTORE_DB__ = db;

/* DOM */
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const riderIdSpan = document.getElementById("riderIdSpan");
const avatarImg = document.getElementById("avatarImg");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const lastSeenEl = document.getElementById("lastSeen");
const connStatusEl = document.getElementById("connStatus");
const activeOrderEl = document.getElementById("activeOrder");
const ordersListEl = document.getElementById("ordersList");

const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");
const avatarFile = document.getElementById("avatarFile");
const btnUploadAvatar = document.getElementById("btnUploadAvatar");

let selectedOrderId = null;
let ordersState = {}; // orderId -> doc
let socket = null;

/* MAP */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);
let riderMarker = null;
const customerMarkers = new Map();

function setRiderMarker(lat, lng) {
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng], { title: "You (rider)" }).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }
}

/* fetch rider doc and listen for changes */
const riderRef = doc(db, "riders", riderDocId);
onSnapshot(riderRef, (snap) => {
  const data = snap.data();
  if (!data) return;

  riderNameEl.textContent = data.name || "—";
  riderEmailEl.textContent = data.email || "—";
  riderIdSpan.textContent = data.riderId || riderDocId;
  lastSeenEl.textContent = data.lastSeen ? new Date(data.lastSeen).toLocaleString() : "—";

  // avatar
  if (data.avatar) avatarImg.src = data.avatar;
  else avatarImg.src = "/home/SH-Favicon.png";

  // status
  if (data.status === "online") {
    statusDot.style.background = "limegreen";
    statusText.textContent = "Online";
  } else {
    statusDot.style.background = "gray";
    statusText.textContent = "Offline";
  }
});

/* ORDERS listener (simple snapshot of orders collection) */
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  snap.docChanges().forEach(ch => {
    const id = ch.doc.id;
    ordersState[id] = { orderId: id, ...(ch.doc.data() || {}) };
  });
  renderOrders();
});

/* SOCKET */
async function startSocket() {
  try {
    socket = await connectSocket({ token, riderDocId });
    connStatusEl.textContent = "connected";
    connStatusEl.style.color = "lightgreen";

    socket.on("rider:location", (p) => {
      // ignore - server echoes rider positions
    });

    socket.on("order:status", (p) => {
      if (!p || !p.orderId) return;
      ordersState[p.orderId] = ordersState[p.orderId] || { orderId: p.orderId };
      ordersState[p.orderId].status = p.status;
      renderOrders();
    });

    socket.on("order:assigned", (p) => {
      // admin assigned order to rider
      console.log("assigned", p);
      renderOrders();
    });
  } catch (err) {
    connStatusEl.textContent = "disconnected";
    connStatusEl.style.color = "crimson";
    console.warn("socket start failed", err);
  }
}

/* render orders in right panel */
function renderOrders() {
  ordersListEl.innerHTML = "";
  const arr = Object.values(ordersState).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!arr.length) {
    ordersListEl.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  for (const o of arr) {
    // show only unassigned or assigned to this rider
    if (o.riderId && o.riderId !== riderDocId) continue;

    const card = document.createElement("div");
    card.className = "order-card";

    const itemsText = (o.items || []).map(i => `${i.name}×${i.qty}`).join(", ");

    card.innerHTML = `
      <div>
        <div style="font-weight:700">${o.orderId}</div>
        <div class="small">${o.status || "new"}</div>
        <div class="small">${itemsText}</div>
      </div>
      <div class="card-actions"></div>
    `;

    card.addEventListener("click", () => selectOrder(o.orderId));

    const actions = card.querySelector(".card-actions");
    const btnView = document.createElement("button"); btnView.className = "btn ghost"; btnView.textContent = "View";
    btnView.onclick = (ev) => { ev.stopPropagation(); selectOrder(o.orderId); };
    const btnAccept = document.createElement("button"); btnAccept.className = "btn"; btnAccept.textContent = "Accept";
    btnAccept.onclick = async (ev) => { ev.stopPropagation(); await acceptOrder(o.orderId); };

    actions.appendChild(btnView);
    actions.appendChild(btnAccept);

    ordersListEl.appendChild(card);
  }
}

/* select an order -> show on map */
async function selectOrder(orderId) {
  selectedOrderId = orderId;
  activeOrderEl.textContent = orderId;

  const o = ordersState[orderId];
  if (!o) return;

  if (o.customerLoc && o.customerLoc.lat && o.customerLoc.lng) {
    const lat = o.customerLoc.lat, lng = o.customerLoc.lng;
    if (customerMarkers.has(orderId)) {
      customerMarkers.get(orderId).setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { title: "Customer" }).addTo(map);
      customerMarkers.set(orderId, m);
    }

    if (riderMarker) {
      const group = new L.featureGroup([riderMarker, customerMarkers.get(orderId)]);
      map.fitBounds(group.getBounds().pad(0.2));
    } else {
      map.setView([lat, lng], 13);
    }
  }
}

/* accept order */
async function acceptOrder(orderId) {
  if (!orderId) return alert("No order id");
  try {
    await updateDoc(doc(db, "orders", orderId), { riderId: riderDocId, status: "accepted", acceptedAt: Date.now() });
    // notify server
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId, status: "accepted", riderId: riderDocId });
    alert("Order accepted");
  } catch (e) {
    console.error(e);
    alert("Accept failed: check Firestore rules & network");
  }
}

/* start sharing GPS and mark status finished/picked */
btnStartTrip.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    // set status picked
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "picked", pickedAt: Date.now() });
    // update rider doc status online
    await updateDoc(doc(db, "riders", riderDocId), { status: "online", lastSeen: Date.now() });
    RIDER_GPS.start(4000); // every 4s
    alert("Trip started — sharing location");
  } catch (e) {
    console.error(e);
    alert("Start trip failed");
  }
});

/* mark delivered */
btnDeliver.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "delivered", deliveredAt: Date.now() });
    await updateDoc(doc(db, "riders", riderDocId), { status: "offline", lastSeen: Date.now() });
    RIDER_GPS.stop();
    alert("Marked delivered");
  } catch (e) {
    console.error(e);
    alert("Mark delivered failed");
  }
});

/* avatar upload */
btnUploadAvatar.addEventListener("click", async () => {
  const f = avatarFile.files[0];
  if (!f) return alert("Choose a file first");
  const key = `riders/${riderDocId}/avatar_${Date.now()}.jpg`;
  const ref = storageRef(window.__FIREBASE_STORAGE__, key);
  try {
    const snap = await uploadBytes(ref, f);
    const url = await getDownloadURL(ref);
    await updateDoc(doc(db, "riders", riderDocId), { avatar: url });
    alert("Uploaded");
  } catch (e) {
    console.error(e);
    alert("Upload failed");
  }
});

/* logout */
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_token");
  window.location.href = "./login.html";
});
btnBack.addEventListener("click", () => window.history.back());

/* attempt to get initial location */
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((p) => {
    setRiderMarker(p.coords.latitude, p.coords.longitude);
    map.setView([p.coords.latitude, p.coords.longitude], 13);
  }, () => {}, { enableHighAccuracy: true });
}

/* make storage global references for avatar upload helper */
import { storage as __s } from "./firebase.js";
window.__FIREBASE_STORAGE__ = __s;

/* start socket & attach rider gps location listener */
(async function init() {
  await startSocket();
  // make socket accessible for other modules
  // keep listening for rider location messages from server
  const s = getSocket();
  if (s) {
    s.on("admin:ping", (p) => console.log("admin:ping", p));
    s.emit("rider:join", { riderId: riderDocId });
  }

  // periodically update lastSeen even when not sharing
  setInterval(async () => {
    try {
      await updateDoc(doc(db, "riders", riderDocId), { lastSeen: Date.now() });
    } catch (e) { /* silently ignore */ }
  }, 60_000);

  renderOrders();
})();
