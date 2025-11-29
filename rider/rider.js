// /rider/rider.js
// FINAL STABLE VERSION – CLEAN + NO BUGS

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
   DOM ELEMENTS
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
const btnDetails = document.getElementById("btnDetails");
const btnTrack = document.getElementById("btnTrack");
const btnLogout = document.getElementById("btnLogout");

const ordersList = document.getElementById("ordersList");

// upload panel
const photoInput = document.getElementById("photoInput");
const btnUploadPhoto = document.getElementById("btnUploadPhoto");
const uploadMsg = document.getElementById("uploadMsg");
const editPhotoBtn = document.getElementById("editPhotoBtn");
const uploadPanel = document.querySelector(".profile-upload-panel");

/* -------------------------------------------------------
   RESTORE OLD WORKING DOC-ID DETECTION
------------------------------------------------------- */
let RIDER_DOC_ID =
  localStorage.getItem("sh_rider_docid") ||
  localStorage.getItem("sh_rider_email") ||
  localStorage.getItem("sh_rider_id") ||
  null;

let RIDER_DATA = null;
let selectedOrderId = null;
let socket = null;
let riderMarker = null;

const ASSIGNABLE_STATUSES = new Set(["new", "pending", "preparing"]);
const STATUS_ASSIGNED = "assigned";
const STATUS_PICKED = "picked";
const STATUS_DELIVERED = "delivered";

/* -------------------------------------------------------
   MAP
------------------------------------------------------- */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: ""
}).addTo(map);

/* -------------------------------------------------------
   TOAST
------------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

/* -------------------------------------------------------
   STATUS HELPERS
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
   LOAD RIDER DOCUMENT (RESTORED)
------------------------------------------------------- */
async function loadRiderDoc() {
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
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

/* -------------------------------------------------------
   REFRESH UI
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

  r.status === "online" ? setStatusOnline() : setStatusOffline();
  lastSeenEl.textContent = fmtLastSeen(r.lastSeen);
  activeOrderEl.textContent = r.activeOrder || "—";
}

/* -------------------------------------------------------
   SOCKET
------------------------------------------------------- */
async function connectEverything() {
  try {
    const token = localStorage.getItem("sh_rider_token");
    const riderIdForSocket =
      RIDER_DATA?.riderId ||
      RIDER_DATA?.email ||
      localStorage.getItem("sh_rider_id");

    socket = await connectSocket({ token, riderId: riderIdForSocket });

    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("rider:location", (p) => {
      if (!p) return;
      if (p.riderId !== riderIdForSocket) return;

      if (!riderMarker)
        riderMarker = L.marker([p.lat, p.lng]).addTo(map);
      else riderMarker.setLatLng([p.lat, p.lng]);
    });
  } catch {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }
}

/* -------------------------------------------------------
   ORDER SNAPSHOT
------------------------------------------------------- */
onSnapshot(collection(db, "orders"), (snap) => {
  const rows = [];
  snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
  renderOrders(rows);
});

/* -------------------------------------------------------
   RENDER ORDERS
------------------------------------------------------- */
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!list.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  list.forEach((o) => {
    const st = (o.status || "").toLowerCase();

    const card = document.createElement("div");
    card.className = "order-card " + st;

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:700">${o.orderId}</div>
      <div class="meta">${(o.items || []).map(i => `${i.name}×${i.qty}`).join(", ")}</div>
      <div class="meta">${o.status}</div>
    `;

    const right = document.createElement("div");
    right.className = "order-actions";

    const badge = document.createElement("div");
    badge.className = "order-badge " + st;
    badge.textContent = o.status.toUpperCase();

    const btnAssign = document.createElement("button");
    btnAssign.className = "btn small";
    btnAssign.textContent = "Assign to me";
    btnAssign.disabled = !ASSIGNABLE_STATUSES.has(st);
    btnAssign.onclick = (ev) => {
      ev.stopPropagation();
      assignToMe(o.orderId);
    };

    right.append(badge, btnAssign);
    card.append(left, right);

    card.onclick = () => {
      selectedOrderId = o.orderId;
      activeOrderEl.textContent = o.orderId;
      updateActionButtons(o);
    };

    ordersList.appendChild(card);
  });
}

/* -------------------------------------------------------
   UPDATE BUTTONS (TOP PANEL)
------------------------------------------------------- */
function updateActionButtons(order) {
  btnStartTrip.disabled = true;
  btnDeliver.disabled = true;
  btnTrack.disabled = !order;
  btnDetails.disabled = !order;

  if (!order || !RIDER_DATA) return;

  const status = (order.status || "").toLowerCase();
  const orderRiderId = order.riderId;

  if (status === STATUS_ASSIGNED && orderRiderId === RIDER_DATA.riderId)
    btnStartTrip.disabled = false;

  if (status === STATUS_PICKED && orderRiderId === RIDER_DATA.riderId)
    btnDeliver.disabled = false;
}

/* -------------------------------------------------------
   DETAILS POPUP
------------------------------------------------------- */
btnDetails.addEventListener("click", () => {
  if (!selectedOrderId) return showToast("Select order first");
  const card = [...ordersList.children].find(c => c.innerText.includes(selectedOrderId));
  if (!card) return showToast("Order not found");
  showToast("Order ID: " + selectedOrderId);
});

/* -------------------------------------------------------
   TRACK BUTTON
------------------------------------------------------- */
btnTrack.addEventListener("click", () => {
  if (!selectedOrderId) return showToast("Select order first");
  showToast("Tracking customer…");
});

/* -------------------------------------------------------
   ASSIGN TO ME
------------------------------------------------------- */
async function assignToMe(orderId) {
  if (!RIDER_DATA) return showToast("Rider data missing");

  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return showToast("Order not found");

  const od = snap.data();
  const st = (od.status || "").toLowerCase();

  if (!ASSIGNABLE_STATUSES.has(st))
    return showToast("Already assigned");

  await updateDoc(ref, {
    riderId: RIDER_DATA.riderId,
    status: STATUS_ASSIGNED,
    assignedAt: Date.now()
  });

  getSocket()?.emit("order:status", { orderId, status: STATUS_ASSIGNED });

  showToast("Order Assigned");
}

/* -------------------------------------------------------
   START TRIP
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

  RIDER_GPS.start();
  btnDeliver.disabled = false;

  getSocket()?.emit("order:status", {
    orderId: selectedOrderId,
    status: STATUS_PICKED
  });

  showToast("Trip started");
});

/* -------------------------------------------------------
   MARK DELIVERED
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

  RIDER_GPS.stop();

  getSocket()?.emit("order:status", {
    orderId: selectedOrderId,
    status: STATUS_DELIVERED
  });

  showToast("Delivered");
});

/* -------------------------------------------------------
   PHOTO UPLOAD SYSTEM (STABLE)
------------------------------------------------------- */
if (uploadPanel) uploadPanel.style.display = "none";

if (editPhotoBtn) {
  editPhotoBtn.addEventListener("click", () => {
    uploadMsg.textContent = "";
    btnUploadPhoto.style.display = "none";
    uploadPanel.style.display = "none";

    photoInput.value = "";
    photoInput.click();
  });
}

photoInput.addEventListener("change", () => {
  if (photoInput.files?.length > 0) {
    uploadMsg.textContent = "Profile photo uploading…";
    btnUploadPhoto.textContent = "Update Profile Photo";
    btnUploadPhoto.style.display = "block";
    uploadPanel.style.display = "block";
  }
});

btnUploadPhoto.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return showToast("Choose a photo first");
  if (!RIDER_DOC_ID) return showToast("Rider not found");

  uploadMsg.textContent = "Profile photo uploading…";
  btnUploadPhoto.style.display = "none";

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dataUrl = reader.result;
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { photoURL: dataUrl });

      profileImg.src = dataUrl;
      uploadMsg.textContent = "Profile photo uploaded";

      setTimeout(() => {
        uploadPanel.style.display = "none";
        uploadMsg.textContent = "";
      }, 1000);

      showToast("Photo uploaded");
    } catch {
      uploadMsg.textContent = "Upload failed";
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
   ONLINE / OFFLINE
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
    if (RIDER_DOC_ID) {
      updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        status: "offline",
        lastSeen: Date.now()
      });
    }
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
