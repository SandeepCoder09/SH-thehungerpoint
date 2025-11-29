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

// Accept button removed from HTML; keep a safe ref (may be null)
const btnAcceptSelected = document.getElementById("btnAcceptSelected");

const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");

// New top action buttons (Track & Details) — added to HTML as requested
const btnTrackOrder = document.getElementById("btnTrackOrder");
const btnOrderDetails = document.getElementById("btnOrderDetails");

const ordersList = document.getElementById("ordersList");

// Upload elements
const photoInput = document.getElementById("photoInput");
const btnUploadPhoto = document.getElementById("btnUploadPhoto");
const uploadMsg = document.getElementById("uploadMsg");
const editPhotoBtn = document.getElementById("editPhotoBtn");
const uploadPanel = document.querySelector(".profile-upload-panel");

/* -------------------------------------------------------
   Initial upload panel state (hidden)
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
    if (uploadPanel) uploadPanel.style.display = "block";
  }
});

/* -------------------------------------------------------
   Local variables
------------------------------------------------------- */
let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || null;
let RIDER_DATA = null;
let socket = null;
let selectedOrderId = null;
let riderMarker = null;

/* To prevent double actions */
const processingOrders = new Set();

const ASSIGNABLE_STATUSES = new Set(["preparing", "new", "pending"]);
const STATUS_ASSIGNED = "assigned";
const STATUS_PICKED = "picked";
const STATUS_DELIVERED = "delivered";

/* -------------------------------------------------------
   Map
------------------------------------------------------- */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: ""
}).addTo(map);

/* -------------------------------------------------------
   Toast (replaces alerts)
------------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) {
    // fallback
    console.log("toast:", msg);
    return;
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

/* -------------------------------------------------------
   Status helpers
------------------------------------------------------- */
function setStatusOnline() {
  if (riderStatusEl) riderStatusEl.textContent = "Online";
  if (riderStatusDot) {
    riderStatusDot.classList.add("online");
    riderStatusDot.classList.remove("offline");
  }
}

function setStatusOffline() {
  if (riderStatusEl) riderStatusEl.textContent = "Offline";
  if (riderStatusDot) {
    riderStatusDot.classList.add("offline");
    riderStatusDot.classList.remove("online");
  }
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
    if (snap && snap.exists && snap.exists()) {
      RIDER_DOC_ID = docId;
      localStorage.setItem("sh_rider_docid", docId);
      return (RIDER_DATA = { id: snap.id, ...snap.data() });
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
   Connect Socket
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
        else
          riderMarker.setLatLng([p.lat, p.lng]);
      }
    });

    // Optional: update UI when order status events arrive
    socket.on("order:status", (p) => {
      // if current selected order changed status, refresh the activeOrder text
      if (p && p.orderId && selectedOrderId === p.orderId) {
        activeOrderEl.textContent = p.orderId;
      }
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
onSnapshot(collection(db, "orders"), (snap) => {
  const rows = [];
  snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
  renderOrders(rows);
});

/* -------------------------------------------------------
   Render Orders
   (Assign remains inside card; Track/Details were moved to top row)
------------------------------------------------------- */
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!list || !list.length) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const o of list) {
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
      activeOrderEl.textContent = o.orderId;
      updateActionButtons(o);
    };

    ordersList.appendChild(card);
  }
}

/* -------------------------------------------------------
   Show order details in toast (used by top Details button)
   We'll create a helper to fetch order & then display
------------------------------------------------------- */
function showOrderDetailsFromObj(o) {
  const msg =
    `Order: ${o.orderId}\n` +
    `Status: ${o.status || "—"}\n` +
    `Items: ${(o.items || []).map(i => `${i.name}×${i.qty}`).join(", ")}` +
    (o.customerName ? `\nCustomer: ${o.customerName}` : "");
  showToast(msg);
}

async function fetchOrderObj(orderId) {
  if (!orderId) return null;
  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) return null;
    return { orderId: snap.id, ...(snap.data() || {}) };
  } catch (err) {
    console.error("fetchOrderObj failed:", err);
    return null;
  }
}

/* -------------------------------------------------------
   Action Button Control
   (Start / Deliver / Track / Details enable/disable)
------------------------------------------------------- */
function updateActionButtons(order) {
  // default - disable all top action buttons
  if (btnStartTrip) btnStartTrip.disabled = true;
  if (btnDeliver) btnDeliver.disabled = true;
  if (btnTrackOrder) btnTrackOrder.disabled = true;
  if (btnOrderDetails) btnOrderDetails.disabled = true;
  if (btnAcceptSelected) {
    try { btnAcceptSelected.disabled = true; } catch(e) {}
  }

  if (!order || !RIDER_DATA) return;

  const status = (order.status || "").toLowerCase();
  const orderRiderId = order.riderId || "";

  // Accept button removed from UI; keep guard in JS (no-op if missing)
  if (ASSIGNABLE_STATUSES.has(status) && btnAcceptSelected) {
    try { btnAcceptSelected.disabled = false; } catch(e) {}
  }

  // Enable Start Trip if assigned to this rider
  if (status === STATUS_ASSIGNED && orderRiderId === RIDER_DATA.riderId) {
    if (btnStartTrip) btnStartTrip.disabled = false;
  }

  // Enable Deliver if picked by this rider
  if (status === STATUS_PICKED && orderRiderId === RIDER_DATA.riderId) {
    if (btnDeliver) btnDeliver.disabled = false;
  }

  // Track and Details should be available for any selected order
  if (btnTrackOrder) btnTrackOrder.disabled = false;
  if (btnOrderDetails) btnOrderDetails.disabled = false;
}

/* -------------------------------------------------------
   Assign to Me (unchanged)
------------------------------------------------------- */
async function assignToMe(orderId) {
  if (!RIDER_DATA) return showToast("Rider data missing");
  if (!orderId) return;

  if (processingOrders.has(orderId)) return;
  processingOrders.add(orderId);

  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showToast("Order not found");

    const od = snap.data();
    const status = (od.status || "").toLowerCase();

    if (!ASSIGNABLE_STATUSES.has(status)) return showToast("Already assigned");

    if (od.riderId && od.riderId !== RIDER_DATA.riderId)
      return showToast("Assigned to another rider");

    await updateDoc(ref, {
      riderId: RIDER_DATA.riderId,
      status: STATUS_ASSIGNED,
      assignedAt: Date.now()
    });

    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId, status: STATUS_ASSIGNED });

    showToast("Order assigned");
  } catch (err) {
    console.error("assignToMe failed:", err);
    showToast("Assign failed");
  } finally {
    processingOrders.delete(orderId);
  }
}

/* -------------------------------------------------------
   Start Trip
------------------------------------------------------- */
if (btnStartTrip) {
  btnStartTrip.addEventListener("click", async () => {
    if (!selectedOrderId) return showToast("Select order first");
    try {
      const ref = doc(db, "orders", selectedOrderId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showToast("Order not found");

      const od = snap.data();
      if ((od.status || "").toLowerCase() !== STATUS_ASSIGNED) return showToast("Not assigned");
      if (od.riderId !== RIDER_DATA.riderId) return showToast("Wrong rider");

      await updateDoc(ref, {
        status: STATUS_PICKED,
        pickedAt: Date.now()
      });

      const s = getSocket();
      if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: STATUS_PICKED });

      RIDER_GPS.start();
      if (btnDeliver) btnDeliver.disabled = false;
      showToast("Trip started");
    } catch (err) {
      console.error("Start trip failed:", err);
      showToast("Start failed");
    }
  });
}

/* -------------------------------------------------------
   Mark Delivered
------------------------------------------------------- */
if (btnDeliver) {
  btnDeliver.addEventListener("click", async () => {
    if (!selectedOrderId) return showToast("Select order first");
    try {
      const ref = doc(db, "orders", selectedOrderId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showToast("Order not found");

      const od = snap.data();
      if ((od.status || "").toLowerCase() !== STATUS_PICKED) return showToast("Not picked");
      if (od.riderId !== RIDER_DATA.riderId) return showToast("Wrong rider");

      await updateDoc(ref, {
        status: STATUS_DELIVERED,
        deliveredAt: Date.now()
      });

      const s = getSocket();
      if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: STATUS_DELIVERED });

      RIDER_GPS.stop();
      showToast("Delivered");
    } catch (err) {
      console.error("Deliver failed:", err);
      showToast("Deliver failed");
    }
  });
}

/* -------------------------------------------------------
   Track selected order (top button)
------------------------------------------------------- */
if (btnTrackOrder) {
  btnTrackOrder.addEventListener("click", async () => {
    if (!selectedOrderId) return showToast("Select order first");
    try {
      const order = await fetchOrderObj(selectedOrderId);
      if (!order) return showToast("Order not found");
      if (!order.customerLoc || !order.customerLoc.lat || !order.customerLoc.lng)
        return showToast("Customer location missing");

      map.setView([order.customerLoc.lat, order.customerLoc.lng], 14);
      L.marker([order.customerLoc.lat, order.customerLoc.lng])
        .addTo(map)
        .bindPopup("Customer")
        .openPopup();
    } catch (err) {
      console.error("Track failed:", err);
      showToast("Track failed");
    }
  });
}

/* -------------------------------------------------------
   Show details for selected order (top button)
------------------------------------------------------- */
if (btnOrderDetails) {
  btnOrderDetails.addEventListener("click", async () => {
    if (!selectedOrderId) return showToast("Select order first");
    try {
      const order = await fetchOrderObj(selectedOrderId);
      if (!order) return showToast("Order not found");
      showOrderDetailsFromObj(order);
    } catch (err) {
      console.error("Details failed:", err);
      showToast("Details failed");
    }
  });
}

/* -------------------------------------------------------
   PROFILE PHOTO UPLOAD
   (uploadPanel is shown only when file selected; auto-hide after success)
------------------------------------------------------- */
if (btnUploadPhoto) {
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
        await updateDoc(doc(db, "riders", RIDER_DOC_ID), { photoURL: dataUrl });

        profileImg.src = dataUrl;
        uploadMsg.textContent = "Profile photo uploaded";

        // AUTO-HIDE PANEL AFTER 1 SECOND (as requested)
        setTimeout(() => {
          if (uploadPanel) uploadPanel.style.display = "none";
          uploadMsg.textContent = "";
        }, 1000);

        showToast("Photo uploaded");
      } catch (err) {
        console.error("photo upload failed:", err);
        uploadMsg.textContent = "Upload failed";
        btnUploadPhoto.style.display = "none";

        // Hide after fail
        setTimeout(() => {
          if (uploadPanel) uploadPanel.style.display = "none";
          uploadMsg.textContent = "";
        }, 1000);

        showToast("Upload failed");
      }
    };

    reader.readAsDataURL(f);
  });
}

/* -------------------------------------------------------
   Online / Offline
------------------------------------------------------- */
async function setRiderOnline(flag = true) {
  if (!RIDER_DOC_ID) return;
  const now = Date.now();

  try {
    await updateDoc(doc(db, "riders", RIDER_DOC_ID), {
      status: flag ? "online" : "offline",
      lastSeen: now
    });
  } catch (err) {
    console.warn("setRiderOnline update failed:", err);
  }

  flag ? setStatusOnline() : setStatusOffline();
  lastSeenEl.textContent = fmtLastSeen(now);
}

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
(async function init() {
  // Ensure top action buttons disabled until order selected
  if (btnStartTrip) btnStartTrip.disabled = true;
  if (btnDeliver) btnDeliver.disabled = true;
  if (btnTrackOrder) btnTrackOrder.disabled = true;
  if (btnOrderDetails) btnOrderDetails.disabled = true;
  if (btnAcceptSelected) {
    try { btnAcceptSelected.disabled = true; } catch(e) {}
  }

  await refreshRiderUI();
  await connectEverything();
  await setRiderOnline(true);

  // mark offline when closing (best effort)
  window.addEventListener("beforeunload", () => {
    try {
      updateDoc(doc(db, "riders", RIDER_DOC_ID), {
        status: "offline",
        lastSeen: Date.now()
      });
    } catch (e) { /* ignore */ }
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        riderMarker = L.marker([lat, lng]).addTo(map);
        