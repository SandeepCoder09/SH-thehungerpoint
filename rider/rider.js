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
  // some docs store "null" as string — handle that
  if (typeof v === "string" && v.toLowerCase() === "null") return "—";
  const t = Number(v) || Date.parse(v);
  if (!t) return "Invalid Date";
  return new Date(t).toLocaleString();
}


// ------------------------------------
// Load rider doc (your Firestore uses email as doc id)
// ------------------------------------
async function loadRiderDoc() {
  try {
    // prefer explicit docid in localStorage, else fallback to email
    const docId = RIDER_DOC_ID || localStorage.getItem("sh_rider_docid") || localStorage.getItem("sh_rider_email") || localStorage.getItem("sh_rider_id");
    if (!docId) {
      console.warn("No rider identifier in localStorage - redirecting to login");
      return null;
    }
    // your Firestore uses email as document id — try that first
    const ref = doc(db, "riders", docId);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        RIDER_DOC_ID = docId;
        localStorage.setItem("sh_rider_docid", docId);
        RIDER_DATA = { id: snap.id, ...snap.data() };
        return RIDER_DATA;
      }
    } catch (err) {
      console.warn("getDoc error (try docId):", err);
    }

    // fallback: scan all riders and match by email if needed (safer but slower)
    const email = localStorage.getItem("sh_rider_email") || docId;
    if (email) {
      try {
        const q = query(collection(db, "riders"), orderBy("__name__"));
        const snaps = await getDocs(q);
        for (const d of snaps.docs) {
          const data = d.data();
          if (String(data.email || "").toLowerCase() === String(email).toLowerCase() || (d.id && d.id === email)) {
            RIDER_DOC_ID = d.id;
            localStorage.setItem("sh_rider_docid", d.id);
            RIDER_DATA = { id: d.id, ...data };
            return RIDER_DATA;
          }
        }
      } catch (err) {
        console.warn("Fallback find rider failed:", err);
      }
    }

    return null;
  } catch (err) {
    console.error("loadRiderDoc top-level error:", err);
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

  RIDER_DATA = r;

  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent = r.riderId || r.email || (localStorage.getItem("sh_rider_id") || "—");

  if (r.photoURL) profileImg.src = r.photoURL;
  else profileImg.src = "/home/SH-Favicon.png";

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
    const token = localStorage.getItem("sh_rider_token") || null;
    const riderIdForSocket = RIDER_DATA?.riderId || RIDER_DATA?.email || localStorage.getItem("sh_rider_id") || localStorage.getItem("sh_rider_docid");

    socket = await connectSocket({ token, riderId: riderIdForSocket });

    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("rider:location", (p) => {
      if (!p) return;
      if (p.riderId === (RIDER_DATA?.riderId || RIDER_DATA?.email || localStorage.getItem("sh_rider_id"))) {
        if (!riderMarker) {
          riderMarker = L.marker([p.lat, p.lng]).addTo(map);
        } else {
          riderMarker.setLatLng([p.lat, p.lng]);
        }
      }
    });

    socket.on("order:status", (p) => {
      // optionally update UI when order status updates arrive via socket.
      if (p && p.orderId && p.status) {
        // if current selected order changed status, show it
        if (selectedOrderId === p.orderId) {
          activeOrderEl.textContent = p.orderId;
        }
      }
    });

    socket.on("disconnect", () => {
      connStatus.textContent = "disconnected";
      connStatus.style.color = "crimson";
    });

    socket.on("connect_error", (err) => {
      console.warn("socket connect_error:", err);
    });

  } catch (err) {
    console.warn("connectEverything error:", err);
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }
}


// ------------------------------------
// Orders Live Snapshot (shows all orders like admin)
// ------------------------------------
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  try {
    const rows = [];
    snap.forEach((d) => rows.push({ orderId: d.id, ...(d.data() || {}) }));
    renderOrders(rows);
  } catch (err) {
    // permission error can happen — show message and log
    console.error("orders snapshot error:", err);
    ordersList.innerHTML = "<div class='small muted'>Unable to load orders (check Firestore rules)</div>";
  }
}, (err) => {
  console.error("orders onSnapshot failed:", err);
  ordersList.innerHTML = "<div class='small muted'>Orders listener failed (check rules)</div>";
});


// ------------------------------------
// Render Orders
// ------------------------------------
function renderOrders(list) {
  ordersList.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    ordersList.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  // sort newest first by createdAt if present
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
    badge.className = "order-badge " + ((o.status||"").toLowerCase());
    badge.textContent = (o.status || "NEW").toUpperCase();

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn small";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      if (!o.customerLoc) return alert("Customer location missing");
      map.setView([o.customerLoc.lat, o.customerLoc.lng], 14);
      L.marker([o.customerLoc.lat, o.customerLoc.lng]).addTo(map).bindPopup("Customer").openPopup();
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
    `Status: ${o.status || "—"}`,
    `Items: ${(o.items || []).map(i => `${i.name}×${i.qty}`).join(", ")}`,
    `Customer: ${o.customerName || o.customerId || "—"}`
  ].join("\n");
  alert(txt);
}


// ------------------------------------
// Accept / Assign Order
// ------------------------------------
async function assignToMe(orderId) {
  if (!orderId) return;
  if (!RIDER_DATA) return alert("Rider data not loaded");
  try {
    await updateDoc(doc(db, "orders", orderId), {
      riderId: RIDER_DATA.riderId || RIDER_DATA.email || localStorage.getItem("sh_rider_id"),
      status: "assigned",
      assignedAt: Date.now()
    });

    // notify server via socket if available
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId, status: "assigned" });

    alert("Order assigned");
  } catch (err) {
    console.error("assignToMe failed:", err);
    alert("Assign failed (check Firestore rules/permissions)");
  }
}


// ------------------------------------
// Start Trip
// ------------------------------------
btnStartTrip.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select order first");
  if (!RIDER_DATA) return alert("Rider data not ready");

  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "picked",
      pickedAt: Date.now(),
      riderId: RIDER_DATA.riderId || RIDER_DATA.email || localStorage.getItem("sh_rider_id")
    });

    // notify backend via socket
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "picked" });

    // start GPS sends
    RIDER_GPS.start();
    sharing = true;
    alert("Trip started");
  } catch (err) {
    console.error("Start trip failed:", err);
    alert("Failed to start trip (check permissions)");
  }
});


// ------------------------------------
// Mark Delivered
// ------------------------------------
btnDeliver.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "delivered",
      deliveredAt: Date.now()
    });

    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "delivered" });

    RIDER_GPS.stop();
    sharing = false;
    alert("Delivered");
  } catch (err) {
    console.error("Mark delivered failed:", err);
    alert("Deliver failed (check Firestore rules)");
  }
});


// ------------------------------------
// Logout
// ------------------------------------
btnLogout.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_email");
  localStorage.removeItem("sh_rider_token");

  try {
    if (auth) await auth.signOut();
  } catch (e) { /* ignore */ }

  window.location.href = "./login.html";
});


// ------------------------------------
// Upload profile photo
// ------------------------------------
btnUploadPhoto.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return (uploadMsg.textContent = "Choose file first");
  if (!RIDER_DOC_ID) return (uploadMsg.textContent = "Rider document not found");

  uploadMsg.textContent = "Uploading…";
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    try {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { photoURL: dataUrl });
      profileImg.src = dataUrl;
      uploadMsg.textContent = "Uploaded";
    } catch (err) {
      console.error("photo upload failed:", err);
      uploadMsg.textContent = "Upload failed (check Firestore rules)";
    }
  };
  reader.readAsDataURL(f);
});


// ------------------------------------
// Set rider online/offline status
// ------------------------------------
async function setRiderOnline(flag = true) {
  if (!RIDER_DOC_ID) return;
  try {
    const now = Date.now();
    if (flag) {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "online", lastSeen: now });
      setStatusOnline();
      lastSeenEl.textContent = fmtLastSeen(now);
    } else {
      await updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: now });
      setStatusOffline();
      lastSeenEl.textContent = fmtLastSeen(now);
    }
  } catch (err) {
    console.warn("setRiderOnline failed (likely permissions):", err);
  }
}


// ------------------------------------
// INIT
// ------------------------------------
(async function init() {
  await refreshRiderUI();          // load rider doc & render header
  await connectEverything();      // socket
  await setRiderOnline(true);     // mark online in Firestore (best effort)

  // make sure we set offline on close if possible
  window.addEventListener("beforeunload", () => {
    try {
      if (RIDER_DOC_ID) updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: Date.now() });
    } catch (e) { /* ignore */ }
  });

  // show current location (best effort)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      riderMarker = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 13);
    }, (err) => {
      console.warn("initial geolocation failed", err);
    }, { enableHighAccuracy: true });
  }
})();
