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

// local lock to avoid multiple clicks
const processingOrders = new Set();

// Allowed assign statuses (your DB uses lowercase)
const ASSIGNABLE_STATUSES = new Set(["preparing", "new", "pending"]);

// Lowercase (your database format)
const STATUS_ASSIGNED = "assigned";
const STATUS_PICKED = "picked";
const STATUS_DELIVERED = "delivered";

// MAP
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: ""
}).addTo(map);


/* -------------------------------------------------------
   MOBILE-SAFE TOAST (REPLACES ALL ALERTS)
------------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return console.warn("Toast missing in HTML");

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}


/* -------------------------------------------------------
   UI helpers
------------------------------------------------------- */
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
  if (typeof v === "string" && v.toLowerCase() === "null") return "—";
  const t = Number(v) || Date.parse(v);
  if (!t) return "Invalid Date";
  return new Date(t).toLocaleString();
}


/* -------------------------------------------------------
   Load rider doc
------------------------------------------------------- */
async function loadRiderDoc() {
  try {
    const docId =
      RIDER_DOC_ID ||
      localStorage.getItem("sh_rider_docid") ||
      localStorage.getItem("sh_rider_email") ||
      localStorage.getItem("sh_rider_id");

    if (!docId) return null;

    const ref = doc(db, "riders", docId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      RIDER_DOC_ID = docId;
      localStorage.setItem("sh_rider_docid", docId);
      RIDER_DATA = { id: snap.id, ...snap.data() };
      return RIDER_DATA;
    }

    return null;
  } catch (err) {
    console.error("loadRiderDoc error:", err);
    return null;
  }
}


/* -------------------------------------------------------
   Refresh Rider UI
------------------------------------------------------- */
async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) {
    showToast("Login again");
    window.location.href = "./login.html";
    return;
  }

  RIDER_DATA = r;

  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent =
    r.riderId || r.email || localStorage.getItem("sh_rider_id") || "—";

  profileImg.src = r.photoURL || "/home/SH-Favicon.png";

  if (r.status === "online") setStatusOnline();
  else setStatusOffline();

  lastSeenEl.textContent = fmtLastSeen(r.lastSeen);
  activeOrderEl.textContent = r.activeOrder || "—";
}


/* -------------------------------------------------------
   Socket connection
------------------------------------------------------- */
async function connectEverything() {
  try {
    const token = localStorage.getItem("sh_rider_token") || null;

    const riderIdForSocket =
      RIDER_DATA?.riderId ||
      RIDER_DATA?.email ||
      localStorage.getItem("sh_rider_id");

    socket = await connectSocket({ token, riderId: riderIdForSocket });

    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("rider:location", (p) => {
      if (!p) return;

      if (
        p.riderId ===
        (RIDER_DATA?.riderId ||
          RIDER_DATA?.email ||
          localStorage.getItem("sh_rider_id"))
      ) {
        if (!riderMarker) {
          riderMarker = L.marker([p.lat, p.lng]).addTo(map);
        } else {
          riderMarker.setLatLng([p.lat, p.lng]);
        }
      }
    });

    socket.on("order:status", (p) => {
      if (!p) return;
      if (selectedOrderId === p.orderId) {
        activeOrderEl.textContent = p.orderId;
      }
    });

    socket.on("disconnect", () => {
      connStatus.textContent = "disconnected";
      connStatus.style.color = "crimson";
    });
  } catch (err) {
    console.warn("connectEverything error:", err);
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }
}


/* -------------------------------------------------------
   Orders Snapshot
------------------------------------------------------- */
const ordersCol = collection(db, "orders");

onSnapshot(
  ordersCol,
  (snap) => {
    try {
      const rows = [];
      snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
      renderOrders(rows);
    } catch (err) {
      console.error("orders snapshot error:", err);
      ordersList.innerHTML =
        "<div class='small muted'>Unable to load orders</div>";
    }
  },
  (err) => {
    console.error("Snapshot failed:", err);
    ordersList.innerHTML =
      "<div class='small muted'>Orders listener failed</div>";
  }
);


/* -------------------------------------------------------
   Render Orders
------------------------------------------------------- */
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const o of list) {
    const card = document.createElement("div");

    const stClass = (o.status || "").toLowerCase();
    card.className = "order-card " + stClass;

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:700">${o.orderId}</div>
      <div class="meta">${(o.items || [])
        .map((i) => `${i.name}×${i.qty}`)
        .join(", ")}</div>
      <div class="meta">${o.status || "NEW"}</div>
    `;

    const right = document.createElement("div");
    right.className = "order-actions";

    const badge = document.createElement("div");
    const statusText = (o.status || "NEW").toString();
    badge.className = "order-badge " + statusText.toLowerCase();
    badge.textContent = statusText.toUpperCase();

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn small";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      if (!o.customerLoc) return showToast("Customer location missing");
      map.setView([o.customerLoc.lat, o.customerLoc.lng], 14);
      L.marker([o.customerLoc.lat, o.customerLoc.lng])
        .addTo(map)
        .bindPopup("Customer")
        .openPopup();
    };

    const btnDetails = document.createElement("button");
    btnDetails.className = "btn small";
    btnDetails.textContent = "Details";
    btnDetails.onclick = (ev) => {
      ev.stopPropagation();
      showOrderDetails(o);
    };

    const btnAssign = document.createElement("button");
    btnAssign.className = "btn small";
    btnAssign.textContent = "Assign to me";
    btnAssign.onclick = (ev) => {
      ev.stopPropagation();
      assignToMe(o.orderId);
    };

    const st = (o.status || "").toLowerCase();
    if (!ASSIGNABLE_STATUSES.has(st)) btnAssign.disabled = true;

    right.appendChild(badge);
    right.appendChild(btnTrack);
    right.appendChild(btnDetails);
    right.appendChild(btnAssign);

    card.appendChild(left);
    card.appendChild(right);

    card.onclick = () => {
      selectedOrderId = o.orderId;
      activeOrderEl.textContent = o.orderId;
      updateActionButtons(o);

      if (o.customerLoc) {
        map.setView([o.customerLoc.lat, o.customerLoc.lng], 13);
        L.marker([o.customerLoc.lat, o.customerLoc.lng])
          .addTo(map)
          .bindPopup("Customer")
          .openPopup();
      }
    };

    ordersList.appendChild(card);
  }
}

function showOrderDetails(o) {
  const msg =
    `Order: ${o.orderId}\n` +
    `Status: ${o.status}\n` +
    `Items: ${(o.items || [])
      .map((i) => `${i.name}×${i.qty}`)
      .join(", ")}\n` +
    `Customer: ${o.customerName || o.customerId || "—"}`;

  showToast(msg);
}


/* -------------------------------------------------------
   Update action buttons
------------------------------------------------------- */
function updateActionButtons(order) {
  btnStartTrip.disabled = true;
  btnDeliver.disabled = true;
  btnAcceptSelected.disabled = true;

  if (!order || !RIDER_DATA) return;

  const status = (order.status || "").toLowerCase();
  const orderRiderId = order.riderId || "";

  if (ASSIGNABLE_STATUSES.has(status)) btnAcceptSelected.disabled = false;

  if (status === STATUS_ASSIGNED && orderRiderId === RIDER_DATA.riderId)
    btnStartTrip.disabled = false;

  if (status === STATUS_PICKED && orderRiderId === RIDER_DATA.riderId)
    btnDeliver.disabled = false;
}


/* -------------------------------------------------------
   Assign to Me
------------------------------------------------------- */
async function assignToMe(orderId) {
  if (!orderId) return;
  if (!RIDER_DATA) return showToast("Rider data not loaded");
  if (processingOrders.has(orderId)) return;

  processingOrders.add(orderId);

  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return showToast("Order not found");

    const od = snap.data() || {};
    const status = (od.status || "").toLowerCase();
    const currentRider = od.riderId || "";

    if (!ASSIGNABLE_STATUSES.has(status))
      return showToast("Already assigned or processed");

    if (currentRider && currentRider !== RIDER_DATA.riderId)
      return showToast("Assigned to another rider");

    await updateDoc(ref, {
      riderId: RIDER_DATA.riderId,
      status: STATUS_ASSIGNED,
      assignedAt: Date.now()
    });

    const s = getSocket();
    if (s && s.connected)
      s.emit("order:status", { orderId, status: STATUS_ASSIGNED });

    showToast("Order assigned");
  } finally {
    processingOrders.delete(orderId);
  }
}


/* -------------------------------------------------------
   Start Trip
------------------------------------------------------- */
btnStartTrip.addEventListener("click", async () => {
  if (!selectedOrderId) return showToast("Select order first");
  if (!RIDER_DATA) return showToast("Rider data missing");
  const orderId = selectedOrderId;

  if (processingOrders.has(orderId)) return;
  processingOrders.add(orderId);

  btnStartTrip.disabled = true;

  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return showToast("Order not found");

    const od = snap.data() || {};
    const status = (od.status || "").toLowerCase();

    if (status !== STATUS_ASSIGNED)
      return showToast("Order not assigned");

    if (od.riderId !== RIDER_DATA.riderId)
      return showToast("Wrong rider");

    await updateDoc(ref, {
      status: STATUS_PICKED,
      pickedAt: Date.now(),
      riderId: RIDER_DATA.riderId
    });

    const s = getSocket();
    if (s && s.connected)
      s.emit("order:status", { orderId, status: STATUS_PICKED });

    RIDER_GPS.start();
    sharing = true;

    btnDeliver.disabled = false;

    showToast("Trip started");
  } finally {
    processingOrders.delete(orderId);
  }
});


/* -------------------------------------------------------
   Mark Delivered
------------------------------------------------------- */
btnDeliver.addEventListener("click", async () => {
  if (!selectedOrderId) return showToast("Select order first");

  const orderId = selectedOrderId;

  if (processingOrders.has(orderId)) return;
  processingOrders.add(orderId);

  btnDeliver.disabled = true;

  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return showToast("Order not found");

    const od = snap.data() || {};
    const status = (od.status || "").toLowerCase();

    if (status !== STATUS_PICKED)
      return showToast("Order not picked");

    if (od.riderId !== RIDER_DATA.riderId)
      return showToast("Wrong rider");

    await updateDoc(ref, {
      status: STATUS_DELIVERED,
      deliveredAt: Date.now()
    });

    const s = getSocket();
    if (s && s.connected)
      s.emit("order:status", { orderId, status: STATUS_DELIVERED });

    RIDER_GPS.stop();
    sharing = false;

    showToast("Delivered");
  } finally {
    processingOrders.delete(orderId);
  }
});


/* -------------------------------------------------------
   Logout
------------------------------------------------------- */
btnLogout.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_email");
  localStorage.removeItem("sh_rider_token");

  try {
    if (auth) await auth.signOut();
  } catch (e) {}

  window.location.href = "./login.html";
});


/* -------------------------------------------------------
   Upload Photo
------------------------------------------------------- */
btnUploadPhoto.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return showToast("Choose file first");
  if (!RIDER_DOC_ID) return showToast("Rider document missing");

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
      showToast("Photo updated");
    } catch (err) {
      console.error("photo upload failed:", err);
      uploadMsg.textContent = "Upload failed";
      showToast("Upload failed");
    }
  };

  reader.readAsDataURL(f);
});


/* -------------------------------------------------------
   Online / Offline
------------------------------------------------------- */
async function setRiderOnline(flag = true) {
  if (!RIDER_DOC_ID) return;

  try {
    const now = Date.now();

    await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
      status: flag ? "online" : "offline",
      lastSeen: now
    });

    if (flag) setStatusOnline();
    else setStatusOffline();

    lastSeenEl.textContent = fmtLastSeen(now);
  } catch (err) {
    console.warn("setRiderOnline failed:", err);
  }
}


/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
(async function init() {
  btnStartTrip.disabled = true;
  btnDeliver.disabled = true;
  btnAcceptSelected.disabled = true;

  await refreshRiderUI();
  await connectEverything();
  await setRiderOnline(true);

  window.addEventListener("beforeunload", () => {
    try {
      updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        status: "offline",
        lastSeen: Date.now()
      });
    } catch (e) {}
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        riderMarker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 13);
      },
      (err) => {
        console.warn("initial geolocation failed", err);
      },
      { enableHighAccuracy: true }
    );
  }
})();
