// /rider/rider.js
// Main Rider Dashboard (expects rider/firebase.js + rider/socket-client.js + rider/rider-gps.js)

import {
  db,
  auth,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc
} from "/rider/firebase.js";

import { connectSocket, getSocket } from "/rider/socket-client.js";
import RIDER_GPS from "/rider/rider-gps.js";

/* -------------------------------------------------------
   DOM Elements
------------------------------------------------------- */
const profileImg = document.getElementById("profileImg");
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const riderStatusEl = document.getElementById("riderStatus");
const riderStatusDot = document.getElementById("riderStatusDot");
const riderIdDisplay = document.getElementById("riderIdDisplay");

const connStatus = document.getElementById("connStatus");
const lastSeenEl = document.getElementById("lastSeen");
const activeOrderEl = document.getElementById("activeOrder");

const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");

const btnTrack = document.getElementById("btnTrack");
const btnDetails = document.getElementById("btnDetails");

const ordersList = document.getElementById("ordersList");

// Upload elements
const photoInput = document.getElementById("photoInput");
const btnUploadPhoto = document.getElementById("btnUploadPhoto");
const uploadMsg = document.getElementById("uploadMsg");
const editPhotoBtn = document.getElementById("editPhotoBtn");
const uploadPanel = document.querySelector(".profile-upload-panel");

/* -------------------------------------------------------
   Initial upload panel state
------------------------------------------------------- */
if (uploadPanel) uploadPanel.style.display = "none";

/* -------------------------------------------------------
   Pencil icon → open file selector
------------------------------------------------------- */
if (editPhotoBtn) {
  editPhotoBtn.addEventListener("click", () => {
    uploadMsg.textContent = "";
    btnUploadPhoto.textContent = "Upload Photo";
    btnUploadPhoto.style.display = "none";

    photoInput.value = "";
    photoInput.click();
  });
}

/* -------------------------------------------------------
   When user selects a photo → show upload panel
------------------------------------------------------- */
photoInput.addEventListener("change", () => {
  if (photoInput.files?.length > 0) {
    uploadMsg.textContent = "Profile photo uploading…";
    btnUploadPhoto.textContent = "Update Profile Photo";
    btnUploadPhoto.style.display = "block";
    uploadPanel.style.display = "block";
  }
});

/* -------------------------------------------------------
   Local variables
------------------------------------------------------- */
let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || null;
let RIDER_DATA = null;
let socket = null;
let selectedOrderId = null;
let CURRENT_ORDER_DATA = null;
let riderMarker = null;

const processingOrders = new Set();

const ASSIGNABLE_STATUSES = new Set(["preparing", "new", "pending"]);
const STATUS_ASSIGNED = "assigned";
const STATUS_PICKED = "picked";
const STATUS_DELIVERED = "delivered";

/* -------------------------------------------------------
   Map setup
------------------------------------------------------- */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: ""
}).addTo(map);

/* -------------------------------------------------------
   Toast
------------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

/* -------------------------------------------------------
   Status helpers
------------------------------------------------------- */
function setStatusOnline() {
  riderStatusEl.textContent = "Online";
  riderStatusDot.classList.add("online");
  riderStatusDot.classList.remove("offline");
}

function setStatusOffline() {
  riderStatusEl.textContent = "Offline";
  riderStatusDot.classList.add("offline");
  riderStatusDot.classList.remove("online");
}

function fmtLastSeen(v) {
  if (!v) return "—";
  const t = Number(v) || Date.parse(v);
  return t ? new Date(t).toLocaleString() : "—";
}

/* -------------------------------------------------------
   Load Rider Document
------------------------------------------------------- */
async function loadRiderDoc() {
  try {
    const docId =
      RIDER_DOC_ID ||
      localStorage.getItem("sh_rider_docid") ||
      localStorage.getItem("sh_rider_email") ||
      localStorage.getItem("sh_rider_id");

    if (!docId) return null;

    const snap = await getDoc(doc(db, "riders", docId));
    if (snap.exists()) {
      RIDER_DOC_ID = docId;
      localStorage.setItem("sh_rider_docid", docId);
      return (RIDER_DATA = { id: snap.id, ...snap.data() });
    }
    return null;
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------------------
   Refresh UI
------------------------------------------------------- */
async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) {
    showToast("Login again");
    window.location.href = "./login.html";
    return;
  }

  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent =
    r.riderId || r.email || localStorage.getItem("sh_rider_id") || "—";

  profileImg.src = r.photoURL || "/home/SH-Favicon.png";

  r.status === "online" ? setStatusOnline() : setStatusOffline();
  lastSeenEl.textContent = fmtLastSeen(r.lastSeen);
  activeOrderEl.textContent = r.activeOrder || "—";
}

/* -------------------------------------------------------
   Socket
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
      if (p.riderId === riderIdForSocket) {
        if (!riderMarker)
          riderMarker = L.marker([p.lat, p.lng]).addTo(map);
        else riderMarker.setLatLng([p.lat, p.lng]);
      }
    });
  } catch {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }
}

/* -------------------------------------------------------
   Orders Snapshot
------------------------------------------------------- */
onSnapshot(collection(db, "orders"), (snap) => {
  const rows = [];
  snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
  renderOrders(rows);
});

/* -------------------------------------------------------
   Render Orders
------------------------------------------------------- */
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  list.forEach((o) => {
    const stClass = (o.status || "").toLowerCase();

    const card = document.createElement("div");
    card.className = "order-card " + stClass;

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:700">${o.orderId}</div>
      <div class="meta">${(o.items || []).map(i => `${i.name}×${i.qty}`).join(", ")}</div>
      <div class="meta">${o.status || "NEW"}</div>
    `;

    const right = document.createElement("div");
    right.className = "order-actions";

    const badge = document.createElement("div");
    badge.className = "order-badge " + stClass;
    badge.textContent = (o.status || "NEW").toUpperCase();

    // Keep Assign to me button as-is
    const btnAssign = document.createElement("button");
    btnAssign.className = "btn small";
    btnAssign.textContent = "Assign to me";
    btnAssign.disabled = !ASSIGNABLE_STATUSES.has(stClass);
    btnAssign.onclick = (ev) => {
      ev.stopPropagation();
      assignToMe(o.orderId);
    };

    right.append(badge, btnAssign);
    card.append(left, right);

    card.onclick = () => {
      selectedOrderId = o.orderId;
      CURRENT_ORDER_DATA = o;
      activeOrderEl.textContent = o.orderId;
      updateActionButtons(o);
    };

    ordersList.appendChild(card);
  });
}

/* -------------------------------------------------------
   Button State Control
------------------------------------------------------- */
function updateActionButtons(order) {
  btnStartTrip.disabled = true;
  btnDeliver.disabled = true;
  btnTrack.disabled = true;
  btnDetails.disabled = true;

  if (!order || !RIDER_DATA) return;

  const status = (order.status || "").toLowerCase();
  const orderRiderId = order.riderId || "";

  if (status === STATUS_ASSIGNED && orderRiderId === RIDER_DATA.riderId)
    btnStartTrip.disabled = false;

  if (status === STATUS_PICKED && orderRiderId === RIDER_DATA.riderId)
    btnDeliver.disabled = false;

  // Always allow Track + Details when order is selected
  btnTrack.disabled = false;
  btnDetails.disabled = false;
}

/* -------------------------------------------------------
   Track Button
------------------------------------------------------- */
btnTrack.addEventListener("click", () => {
  if (!CURRENT_ORDER_DATA) return showToast("Select order first");

  const loc = CURRENT_ORDER_DATA.customerLoc;
  if (!loc) return showToast("Customer location missing");

  map.setView([loc.lat, loc.lng], 14);
  L.marker([loc.lat, loc.lng]).addTo(map)
    .bindPopup("Customer")
    .openPopup();
});

/* -------------------------------------------------------
   Details Button
------------------------------------------------------- */
btnDetails.addEventListener("click", () => {
  if (!CURRENT_ORDER_DATA) return showToast("Select order first");

  showToast(
    `Order: ${CURRENT_ORDER_DATA.orderId}\nStatus: ${CURRENT_ORDER_DATA.status}\nItems: ${(CURRENT_ORDER_DATA.items || [])
      .map(i => `${i.name}×${i.qty}`)
      .join(", ")}`
  );
});

/* -------------------------------------------------------
   Assign to Me
------------------------------------------------------- */
async function assignToMe(orderId) {
  if (!RIDER_DATA) return showToast("Rider data missing");
  if (processingOrders.has(orderId)) return;

  processingOrders.add(orderId);

  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showToast("Order not found");

    const od = snap.data();
    const status = (od.status || "").toLowerCase();

    if (!ASSIGNABLE_STATUSES.has(status))
      return showToast("Already assigned");

    if (od.riderId && od.riderId !== RIDER_DATA.riderId)
      return showToast("Assigned to another rider");

    await updateDoc(ref, {
      riderId: RIDER_DATA.riderId,
      status: STATUS_ASSIGNED,
      assignedAt: Date.now()
    });

    getSocket()?.emit("order:status", {
      orderId,
      status: STATUS_ASSIGNED
    });

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

  const ref = doc(db, "orders", selectedOrderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return showToast("Order not found");

  const od = snap.data();

  if (od.status !== STATUS_ASSIGNED) return showToast("Not assigned");
  if (od.riderId !== RIDER_DATA.riderId) return showToast("Wrong rider");

  await updateDoc(ref, {
    status: STATUS_PICKED,
    pickedAt: Date.now()
  });

  getSocket()?.emit("order:status", {
    orderId: selectedOrderId,
    status: STATUS_PICKED
  });

  RIDER_GPS.start();
  btnDeliver.disabled = false;
  showToast("Trip started");
});

/* -------------------------------------------------------
   Mark Delivered
------------------------------------------------------- */
btnDeliver.addEventListener("click", async () => {
  if (!selectedOrderId) return showToast("Select order first");

  const ref = doc(db, "orders", selectedOrderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return showToast("Order not found");

  const od = snap.data();
  if (od.status !== STATUS_PICKED) return showToast("Not picked");
  if (od.riderId !== RIDER_DATA.riderId) return showToast("Wrong rider");

  await updateDoc(ref, {
    status: STATUS_DELIVERED,
    deliveredAt: Date.now()
  });

  getSocket()?.emit("order:status", {
    orderId: selectedOrderId,
    status: STATUS_DELIVERED
  });

  RIDER_GPS.stop();
  showToast("Delivered");
});

/* -------------------------------------------------------
   Upload Photo
------------------------------------------------------- */
btnUploadPhoto.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return showToast("Choose a photo first");
  if (!RIDER_DOC_ID) return showToast("Rider not found");

  uploadMsg.textContent = "Profile photo uploading…";
  btnUploadPhoto.style.display = "none";

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;

    try {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        photoURL: dataUrl
      });

      profileImg.src = dataUrl;
      uploadMsg.textContent = "Profile photo uploaded";

      setTimeout(() => {
        uploadPanel.style.display = "none";
        uploadMsg.textContent = "";
      }, 1000);

      showToast("Photo uploaded");
    } catch (err) {
      uploadMsg.textContent = "Upload failed";
      btnUploadPhoto.style.display = "none";

      setTimeout(() => {
        uploadPanel.style.display = "none";
        uploadMsg.textContent = "";
      }, 1000);

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
  const now = Date.now();

  await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
    status: flag ? "online" : "offline",
    lastSeen: now
  });

  flag ? setStatusOnline() : setStatusOffline();
  lastSeenEl.textContent = fmtLastSeen(now);
}

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
(async function init() {
  btnStartTrip.disabled = true;
  btnDeliver.disabled = true;
  btnTrack.disabled = true;
  btnDetails.disabled = true;

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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        riderMarker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 13);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  }
})();
