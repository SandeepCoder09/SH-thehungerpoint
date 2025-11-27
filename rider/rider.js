// /rider/rider.js
// Main Rider Dashboard — uses Firestore, Socket and Rider GPS helper.

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

/* ---------- DOM ---------- */
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

/* ---------- Config: use custom doc id (B) ---------- */
// Use provided rider Firestore document ID: SH_RD_01
let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || "SH_RD_01";
// Optional readable riderId stored in doc (riderId field). We'll keep both.
let RIDER_ID_FIELD = localStorage.getItem("sh_rider_id") || null;

let RIDER_DATA = null;
let socket = null;
let selectedOrderId = null;
let sharing = false;
let riderMarker = null;

/* ---------- Map init ---------- */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);

/* ---------- Helpers ---------- */
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
function fmtLastSeen(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  return d.toLocaleString();
}

/* ---------- Load rider doc (by doc id) ---------- */
async function loadRiderDoc() {
  try {
    if (!RIDER_DOC_ID) return null;
    const ref = doc(db, "riders", RIDER_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn("Rider doc not found:", RIDER_DOC_ID);
      return null;
    }
    const data = snap.data();
    RIDER_DATA = { id: snap.id, ...data };
    // write readable rider id to localStorage for reuse
    if (RIDER_DATA.riderId) {
      RIDER_ID_FIELD = RIDER_DATA.riderId;
      localStorage.setItem("sh_rider_id", RIDER_ID_FIELD);
    }
    localStorage.setItem("sh_rider_docid", RIDER_DOC_ID);
    return RIDER_DATA;
  } catch (err) {
    console.error("loadRiderDoc error", err);
    return null;
  }
}

/* ---------- UI refresh ---------- */
async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) {
    // redirect to login page (if you have one)
    console.warn("No rider doc - redirect to login");
    window.location.href = "./login.html";
    return;
  }
  RIDER_DATA = r;
  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent = r.riderId || r.email || r.id || "—";
  if (r.photoURL) profileImg.src = r.photoURL;
  else profileImg.src = "/home/SH-Favicon.png";

  if (r.status === "online") setStatusOnline(); else setStatusOffline();
  lastSeenEl.textContent = r.lastSeen && r.lastSeen !== "null" ? fmtLastSeen(r.lastSeen) : "—";
  activeOrderEl.textContent = r.activeOrder || "—";
}

/* ---------- Socket connect & events ---------- */
async function connectEverything() {
  try {
    const socketIdHint = RIDER_DATA?.riderId || RIDER_DATA?.email || RIDER_DOC_ID;
    socket = await connectSocket({ riderId: socketIdHint });
    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    socket.on("connect", () => {
      connStatus.textContent = "connected";
      connStatus.style.color = "lightgreen";
    });
    socket.on("disconnect", () => {
      connStatus.textContent = "disconnected";
      connStatus.style.color = "crimson";
    });

    // rider location updates (from server or other clients)
    socket.on("order:riderLocation", (p) => {
      if (!p) return;
      if ((RIDER_DATA?.riderId && p.riderId === RIDER_DATA.riderId) || p.riderId === RIDER_DATA.email || p.riderId === RIDER_DOC_ID) {
        // update own marker
        if (!riderMarker) {
          riderMarker = L.marker([p.lat, p.lng]).addTo(map);
        } else {
          riderMarker.setLatLng([p.lat, p.lng]);
        }
      }
    });

    // generic order status updates
    socket.on("order:status", (p) => {
      if (!p || !p.orderId) return;
      // we'll rely on Firestore snapshot to reflect latest state, but update UI where helpful
      if (p.orderId === selectedOrderId) {
        // update active order display
        activeOrderEl.textContent = p.orderId;
      }
    });

  } catch (err) {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
    console.warn("socket connect failed", err);
  }
}

/* ---------- Orders: show ALL orders like admin ---------- */
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  const rows = [];
  snap.forEach(d => rows.push({ orderId: d.id, ...(d.data()||{}) }));
  renderOrders(rows);
});

function renderOrders(list) {
  ordersList.innerHTML = "";
  if (!list || !list.length) {
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
    badge.className = "order-badge " + ((o.status||"").toLowerCase());
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
  const txt = `
Order: ${o.orderId}
Status: ${o.status||"—"}
Items: ${(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(", ")}
Customer: ${o.customerName||o.customerId||"—"}
`;
  alert(txt);
}

/* ---------- Assign/accept/start/deliver ---------- */
async function assignToMe(orderId) {
  if (!orderId) return;
  try {
    await updateDoc(doc(db, "orders", orderId), {
      riderId: RIDER_DATA.riderId || RIDER_DATA.email || RIDER_DOC_ID,
      status: "assigned",
      assignedAt: Date.now()
    });
    alert("Assigned " + orderId);
  } catch (err) {
    console.error("assign failed", err);
    alert("Assign failed: " + (err.message||err));
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
      riderId: RIDER_DATA.riderId || RIDER_DATA.email || RIDER_DOC_ID
    });
    RIDER_GPS.start(); // periodic sends
    sharing = true;
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
    alert("Marked delivered");
  } catch (err) {
    console.error(err);
    alert("Deliver failed");
  }
});

/* ---------- Profile photo upload (base64 to Firestore) ---------- */
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

/* ---------- Set online/offline and lastSeen ---------- */
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

/* ---------- Logout ---------- */
btnLogout?.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  try { if (auth) await auth.signOut(); } catch(e){}
  window.location.href = "./login.html";
});

/* ---------- Init ---------- */
(async function init() {
  // load rider doc and show UI
  await refreshRiderUI();

  // connect socket
  await connectEverything();

  // mark online
  await setRiderOnline(true);

  // on unload set offline
  window.addEventListener("beforeunload", () => {
    try { updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: Date.now() }); } catch(e){}
  });

  // initialize map with current location if available
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      map.setView([lat, lng], 13);
      riderMarker = L.marker([lat, lng]).addTo(map);
    }, (err) => { /* ignore */ }, { enableHighAccuracy: true });
  }
})();