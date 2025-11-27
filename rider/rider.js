// /rider/rider.js
// FULL WORKING RIDER DASHBOARD — FIXED VERSION

import {
  db,
  auth,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  orderBy
} from "/rider/firebase.js";

import { connectSocket, getSocket } from "/rider/socket-client.js";
import RIDER_GPS from "/rider/rider-gps.js";

// DOM refs
const profileImg = document.getElementById("profileImg");
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const riderStatusEl = document.getElementById("riderStatus");
const riderStatusDot = document.getElementById("riderStatusDot");
const riderIdDisplay = document.getElementById("riderIdDisplay");

const connStatus = document.getElementById("connStatus");
const lastSeenEl = document.getElementById("lastSeen");
const activeOrderEl = document.getElementById("activeOrder");

const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");

const ordersList = document.getElementById("ordersList");

const photoInput = document.getElementById("photoInput");
const btnUploadPhoto = document.getElementById("btnUploadPhoto");
const uploadMsg = document.getElementById("uploadMsg");

let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || null;
let RIDER_EMAIL = localStorage.getItem("sh_rider_email") || null;
let RIDER_ID = localStorage.getItem("sh_rider_id") || null;
let RIDER_DATA = null;

let socket = null;
let selectedOrderId = null;

let sharing = false;
let riderMarker = null;

// MAP
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);


// ------------------------------------
// UI helpers
// ------------------------------------
function setStatusOnline() {
  riderStatusEl.textContent = "Online";
  riderStatusDot.classList.remove("offline");
  riderStatusDot.classList.add("online");
}

function setStatusOffline() {
  riderStatusEl.textContent = "Offline";
  riderStatusDot.classList.remove("online");
  riderStatusDot.classList.add("offline");
}

function fmtLastSeen(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}


// ------------------------------------
// FIXED: Correct rider doc loading
// ------------------------------------
async function loadRiderDoc() {
  try {
    const email = localStorage.getItem("sh_rider_email");

    if (!email) {
      console.warn("No rider email found in localStorage");
      return null;
    }

    const ref = doc(db, "riders", email);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("Rider not found in Firestore:", email);
      return null;
    }

    RIDER_DOC_ID = email;
    RIDER_DATA = { id: email, ...snap.data() };

    return RIDER_DATA;

  } catch (e) {
    console.error("loadRiderDoc ERROR:", e);
    return null;
  }
}


// ------------------------------------
// Refresh Rider UI
// ------------------------------------
async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) {
    window.location.href = "./login.html";
    return;
  }

  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent = r.riderId || r.email;

  if (r.photoURL) profileImg.src = r.photoURL;

  if (r.status === "online") setStatusOnline();
  else setStatusOffline();

  lastSeenEl.textContent = fmtLastSeen(r.lastSeen);
  activeOrderEl.textContent = r.activeOrder || "—";
}


// ------------------------------------
// Socket connection
// ------------------------------------
async function connectEverything() {
  try {
    socket = await connectSocket({
      riderId: RIDER_DATA.riderId || RIDER_DATA.email
    });

    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("rider:location", (p) => {
      if (!p) return;
      if (p.riderId === (RIDER_DATA.riderId || RIDER_DATA.email)) {
        if (!riderMarker) {
          riderMarker = L.marker([p.lat, p.lng]).addTo(map);
        } else {
          riderMarker.setLatLng([p.lat, p.lng]);
        }
      }
    });

  } catch (err) {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }
}


// ------------------------------------
// Orders Live Snapshot
// ------------------------------------
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  const rows = [];
  snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
  renderOrders(rows);
});


// ------------------------------------
// Render Orders
// ------------------------------------
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const o of list) {
    const card = document.createElement("div");
    card.className = "order-card";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:700">${o.orderId}</div>
      <div class="meta">${(o.items || []).map(i => `${i.name}×${i.qty}`).join(", ")}</div>
      <div class="meta">${o.status || "NEW"}</div>
    `;

    const right = document.createElement("div");
    right.className = "order-actions";

    const badge = document.createElement("div");
    badge.className = "order-badge " + (o.status || "").toLowerCase();
    badge.textContent = (o.status || "NEW").toUpperCase();

    const btnAssign = document.createElement("button");
    btnAssign.className = "btn small";
    btnAssign.textContent = "Assign to me";
    btnAssign.onclick = (ev) => {
      ev.stopPropagation();
      assignToMe(o.orderId);
    };

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn small";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      if (!o.customerLoc) return alert("Customer location missing");
      map.setView([o.customerLoc.lat, o.customerLoc.lng], 14);
      L.marker([o.customerLoc.lat, o.customerLoc.lng]).addTo(map);
    };

    right.appendChild(badge);
    right.appendChild(btnTrack);
    right.appendChild(btnAssign);

    card.appendChild(left);
    card.appendChild(right);

    card.onclick = () => {
      selectedOrderId = o.orderId;
      activeOrderEl.textContent = o.orderId;
    };

    ordersList.appendChild(card);
  }
}


// ------------------------------------
// Accept / Assign Order
// ------------------------------------
async function assignToMe(orderId) {
  if (!orderId) return;

  await updateDoc(doc(db, "orders", orderId), {
    riderId: RIDER_DATA.riderId || RIDER_DATA.email,
    status: "assigned",
    assignedAt: Date.now()
  });

  alert("Order assigned");
}


// ------------------------------------
// Start Trip
// ------------------------------------
btnStartTrip.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select order first");

  await updateDoc(doc(db, "orders", selectedOrderId), {
    status: "picked",
    pickedAt: Date.now()
  });

  RIDER_GPS.start();
  alert("Trip started");
});


// ------------------------------------
// Mark Delivered
// ------------------------------------
btnDeliver.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select order first");

  await updateDoc(doc(db, "orders", selectedOrderId), {
    status: "delivered",
    deliveredAt: Date.now()
  });

  RIDER_GPS.stop();
  alert("Delivered");
});


// ------------------------------------
// Logout
// ------------------------------------
btnLogout.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_email");

  try {
    if (auth) await auth.signOut();
  } catch (e) {}

  window.location.href = "./login.html";
});


// ------------------------------------
// Upload profile photo
// ------------------------------------
btnUploadPhoto.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return (uploadMsg.textContent = "Choose file first");

  uploadMsg.textContent = "Uploading…";

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;

    try {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        photoURL: dataUrl
      });

      profileImg.src = dataUrl;
      uploadMsg.textContent = "Uploaded";
    } catch (err) {
      uploadMsg.textContent = "Upload failed";
    }
  };

  reader.readAsDataURL(f);
});


// ------------------------------------
// Set rider online/offline status
// ------------------------------------
async function setRiderOnline(flag = true) {
  try {
    const now = Date.now();

    if (flag) {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        status: "online",
        lastSeen: now
      });

      setStatusOnline();
      lastSeenEl.textContent = fmtLastSeen(now);
    } else {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        status: "offline",
        lastSeen: now
      });

      setStatusOffline();
      lastSeenEl.textContent = fmtLastSeen(now);
    }

  } catch (err) {
    console.warn("setRiderOnline failed", err);
  }
}


// ------------------------------------
// INIT
// ------------------------------------
(async function init() {
  await refreshRiderUI();
  await connectEverything();

  await setRiderOnline(true);

  window.addEventListener("beforeunload", () => {
    updateDoc(doc(db, "riders", RIDER_DOC_ID), {
      status: "offline",
      lastSeen: Date.now()
    });
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      riderMarker = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 13);
    });
  }
})();