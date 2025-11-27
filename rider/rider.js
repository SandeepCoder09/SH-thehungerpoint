// /rider/rider.js
// Main Rider Dashboard (expects rider/firebase.js + rider/socket-client.js + rider/rider-gps.js)

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

// identify rider doc:
// doc id == email (per your Firestore setup)
let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || null;
let RIDER_ID_FIELD = localStorage.getItem("sh_rider_id") || null; // readable riderId
let RIDER_DATA = null;

let socket = null;
let selectedOrderId = null;
let sharing = false;
let riderMarker = null;

// map
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);

// UI helpers
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
  const d = new Date(v);
  return d.toLocaleString();
}

async function loadRiderDoc() {
  try {
    if (!RIDER_DOC_ID) {
      // If no doc id saved, try redirect to login
      console.warn("missing doc id -> redirecting to login");
      window.location.href = "/rider/login.html";
      return null;
    }
    const ref = doc(db, "riders", RIDER_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn("rider doc not found -> redirecting to login");
      window.location.href = "/rider/login.html";
      return null;
    }
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error("loadRiderDoc err", err);
    return null;
  }
}

async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) return;
  RIDER_DATA = r;
  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent = r.riderId || (r.email || "—");
  if (r.photoURL) profileImg.src = r.photoURL;
  else profileImg.src = "/home/SH-Favicon.png";

  if (r.status === "online") setStatusOnline(); else setStatusOffline();
  lastSeenEl.textContent = r.lastSeen && r.lastSeen !== "null" ? fmtLastSeen(r.lastSeen) : "—";
  activeOrderEl.textContent = r.activeOrder || "—";
}

async function connectEverything() {
  const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
  const token = localStorage.getItem("sh_rider_token") || "";
  try {
    socket = await connectSocket({ token, riderId: RIDER_DATA?.riderId || RIDER_DATA?.email, url: API_BASE });
    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("order:status", (p) => {
      // order status updates are handled via Firestore snapshot (we leave this lightweight)
    });

    socket.on("rider:location", (p) => {
      if (!p) return;
      if (p.riderId === (RIDER_DATA?.riderId || RIDER_DATA?.email)) {
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
    console.warn("socket connect failed", err);
  }
}

// Orders listener (shows all orders — same as admin)
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  const rows = [];
  snap.forEach(d => rows.push({ orderId: d.id, ...(d.data()||{}) }));
  renderOrders(rows);
});

function renderOrders(list) {
  ordersList.innerHTML = "";
  if (!list.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }
  list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  for (const o of list) {
    const card = document.createElement("div");
    card.className = "order-card";
    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:700">${o.orderId}</div>
                      <div class="meta">${(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(", ")}</div>
                      <div class="meta">${o.status||"new"}</div>`;
    const right = document.createElement("div");
    right.className = "order-actions";

    const badge = document.createElement("div");
    badge.className = "order-badge " + (o.status || "").toLowerCase();
    badge.textContent = (o.status || "NEW").toUpperCase();

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn small";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      if (o.customerLoc) {
        const lat = o.customerLoc.lat, lng = o.customerLoc.lng;
        map.setView([lat, lng], 14);
        L.marker([lat, lng]).addTo(map).bindPopup("Customer").openPopup();
      } else alert("Customer location not available");
    };

    const btnDetails = document.createElement("button");
    btnDetails.className = "btn small";
    btnDetails.textContent = "Details";
    btnDetails.onclick = (ev) => { ev.stopPropagation(); showOrderDetails(o); };

    const btnAssign = document.createElement("button");
    btnAssign.className = "btn small";
    btnAssign.textContent = "Assign to me";
    btnAssign.onclick = (ev) => { ev.stopPropagation(); assignToMe(o.orderId); };

    right.appendChild(badge);
    right.appendChild(btnTrack);
    right.appendChild(btnDetails);
    right.appendChild(btnAssign);

    card.appendChild(left);
    card.appendChild(right);

    card.onclick = () => {
      selectedOrderId = o.orderId;
      activeOrderEl.textContent = o.orderId;
      if (o.customerLoc) {
        map.setView([o.customerLoc.lat, o.customerLoc.lng], 13);
        L.marker([o.customerLoc.lat, o.customerLoc.lng]).addTo(map).bindPopup("Customer").openPopup();
      }
    };

    ordersList.appendChild(card);
  }
}

function showOrderDetails(o) {
  const txt = [
    `Order: ${o.orderId}`,
    `Status: ${o.status||"—"}`,
    `Items: ${(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(", ")}`,
    `Customer: ${o.customerName||o.customerId||"—"}`
  ].join("\n");
  alert(txt);
}

async function assignToMe(orderId) {
  if (!orderId) return;
  try {
    await updateDoc(doc(db, "orders", orderId), {
      riderId: RIDER_DATA.riderId || RIDER_DATA.email,
      status: "assigned",
      assignedAt: Date.now()
    });
    const sock = getSocket();
    if (sock && sock.connected) sock.emit("order:status", { orderId, status: "assigned" });
    alert("Assigned " + orderId);
  } catch (err) {
    console.error("assign failed", err);
    alert("Assign failed: " + (err.message || err));
  }
}

btnAcceptSelected?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  await assignToMe(selectedOrderId);
});

btnStartTrip?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "picked",
      pickedAt: Date.now(),
      riderId: RIDER_DATA.riderId || RIDER_DATA.email
    });
    // start GPS sending with orderId
    RIDER_GPS.start({ riderId: RIDER_DATA.riderId || RIDER_DATA.email, orderId: selectedOrderId, intervalMs: 5000 });
    sharing = true;
    const sock = getSocket();
    if (sock && sock.connected) sock.emit("order:status", { orderId: selectedOrderId, status: "picked" });
    alert("Trip started");
  } catch (err) {
    console.error(err);
    alert("Failed to start trip");
  }
});

btnDeliver?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "delivered", deliveredAt: Date.now() });
    RIDER_GPS.stop();
    sharing = false;
    const sock = getSocket();
    if (sock && sock.connected) sock.emit("order:status", { orderId: selectedOrderId, status: "delivered" });
    alert("Marked delivered");
  } catch (err) {
    console.error(err);
    alert("Deliver failed");
  }
});

btnLogout?.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_token");
  try { if (auth) await auth.signOut(); } catch(e){}
  window.location.href = "/rider/login.html";
});

// Photo upload
btnUploadPhoto?.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) { uploadMsg.textContent = "Choose file first"; return; }
  uploadMsg.textContent = "Uploading...";
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    try {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { photoURL: dataUrl });
      profileImg.src = dataUrl;
      uploadMsg.textContent = "Uploaded";
    } catch (err) {
      console.error(err);
      uploadMsg.textContent = "Upload failed";
    }
  };
  reader.readAsDataURL(f);
});

// set online/offline lastSeen
async function setRiderOnline(flag = true) {
  try {
    const now = Date.now();
    if (flag) {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "online", lastSeen: now });
      setStatusOnline();
      lastSeenEl.textContent = fmtLastSeen(now);
    } else {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: Date.now() });
      setStatusOffline();
      lastSeenEl.textContent = fmtLastSeen(Date.now());
    }
  } catch (err) {
    console.warn("setRiderOnline failed", err);
  }
}

async function init() {
  const r = await loadRiderDoc();
  if (!r) return;
  await refreshRiderUI();
  await connectEverything();
  await setRiderOnline(true);

  window.addEventListener("beforeunload", () => {
    try { updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: Date.now() }); } catch(e){}
  });

  // current location marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      map.setView([lat, lng], 13);
      riderMarker = L.marker([lat, lng]).addTo(map);
    }, (err) => {}, { enableHighAccuracy: true });
  }
}

init();