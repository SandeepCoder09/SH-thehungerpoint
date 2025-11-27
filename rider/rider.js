// /rider/rider.js
import {
  db,
  auth,
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy
} from "/rider/firebase.js";

import { connectSocket, getSocket } from "/rider/socket-client.js";
import RIDER_GPS from "/rider/rider-gps.js";

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";

/* DOM */
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

/* state */
let RIDER_DOC_ID = localStorage.getItem("sh_rider_docid") || null;
let RIDER_ID_FIELD = localStorage.getItem("sh_rider_id") || null;
let RIDER_DATA = null;
let socket = null;
let selectedOrderId = null;
let riderMarker = null;
let sharing = false;

/* helpers */
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

/* Map */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);

async function loadRiderDoc() {
  // - If docid is present, use it
  // - Else try to find by auth current user or by stored email
  try {
    if (RIDER_DOC_ID) {
      const rref = doc(db, "riders", RIDER_DOC_ID);
      const snap = await getDoc(rref);
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() || {}) };
      } else {
        RIDER_DOC_ID = null;
      }
    }

    // try find by auth email or localStorage
    const email = (auth?.currentUser && auth.currentUser.email) || localStorage.getItem("sh_rider_email");
    if (email) {
      const q = query(collection(db, "riders"), orderBy("__name__")); // fetch all and match (small dataset)
      const snaps = await getDocs(q);
      for (const d of snaps.docs) {
        const data = d.data();
        if (String(data.email || "").toLowerCase() === String(email).toLowerCase()) {
          RIDER_DOC_ID = d.id;
          localStorage.setItem("sh_rider_docid", d.id);
          return { id: d.id, ...data };
        }
      }
    }

    return null;
  } catch (err) {
    console.error("loadRiderDoc error:", err);
    return null;
  }
}

async function refreshRiderUI() {
  const r = await loadRiderDoc();
  if (!r) {
    console.warn("No rider doc; redirecting to login.");
    window.location.href = "./login.html";
    return;
  }
  RIDER_DATA = r;
  riderNameEl.textContent = r.name || "Rider";
  riderEmailEl.textContent = r.email || "";
  riderIdDisplay.textContent = r.riderId || (r.email || "—");
  if (r.photoURL) profileImg.src = r.photoURL;
  else profileImg.src = "/home/SH-Favicon.png";

  if (r.status === "online") setStatusOnline(); else setStatusOffline();
  lastSeenEl.textContent = r.lastSeen && r.lastSeen !== "null" ? fmtLastSeen(r.lastSeen) : "—";
  activeOrderEl.textContent = r.activeOrder || "—";

  // set sh_rider_id local (used by gps)
  if (r.riderId) {
    localStorage.setItem("sh_rider_id", r.riderId);
    RIDER_ID_FIELD = r.riderId;
  }
}

async function connectEverything() {
  try {
    // connect socket
    socket = await connectSocket({ riderId: RIDER_DATA?.riderId || RIDER_DATA?.email });
    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";

    // When server emits order status/location we handle
    socket.on("order:status", (p) => {
      // used to optionally update UI if order status changes
      if (p && p.orderId && p.status) {
        // small visual feedback
        console.log("order:status", p);
      }
    });

    socket.on("rider:location", (p) => {
      // update own marker if the message is about current rider
      if (!p || !p.riderId) return;
      if (p.riderId === (RIDER_DATA?.riderId || RIDER_DATA?.email)) {
        const lat = p.lat, lng = p.lng;
        if (!riderMarker) {
          riderMarker = L.marker([lat, lng]).addTo(map);
        } else {
          riderMarker.setLatLng([lat, lng]);
        }
      }
    });

  } catch (err) {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
    console.warn("socket connection error:", err);
  }
}

/* Orders snapshot - show ALL orders (admin-like view) */
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
    badge.className = "order-badge " + ((o.status||"").toLowerCase());
    badge.textContent = (o.status||"NEW").toUpperCase();

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn small";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      if (o.customerLoc) {
        map.setView([o.customerLoc.lat, o.customerLoc.lng], 14);
        L.marker([o.customerLoc.lat, o.customerLoc.lng]).addTo(map).bindPopup("Customer").openPopup();
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
        L.marker([o.customerLoc.lat, o.customerLoc.lng]).addTo(map)
          .bindPopup("Customer").openPopup();
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

async function assignToMe(orderId) {
  if (!orderId) return;
  try {
    await updateDoc(doc(db, "orders", orderId), {
      riderId: RIDER_DATA.riderId || RIDER_DATA.email,
      status: "assigned",
      assignedAt: Date.now()
    });
    alert("Assigned " + orderId);
  } catch (err) {
    console.error("assign failed", err);
    alert("Assign failed: " + (err.message||err));
  }
}

/* Accept selected -> same as assign */
btnAcceptSelected?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  await assignToMe(selectedOrderId);
});

/* Start trip -> update order status and start GPS sending */
btnStartTrip?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "picked",
      pickedAt: Date.now(),
      riderId: RIDER_DATA.riderId || RIDER_DATA.email
    });

    // start gps sending (RIDER_GPS will emit to socket.io)
    RIDER_GPS.start(5000, { orderId: selectedOrderId, riderId: RIDER_DATA.riderId || RIDER_DATA.email });
    sharing = true;
    alert("Trip started");
  } catch (err) {
    console.error(err);
    alert("Failed to start trip");
  }
});

/* Mark delivered */
btnDeliver?.addEventListener("click", async () => {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "delivered",
      deliveredAt: Date.now()
    });
    RIDER_GPS.stop();
    sharing = false;
    alert("Marked delivered");
  } catch (err) {
    console.error(err);
    alert("Deliver failed");
  }
});

/* Upload profile photo (stores base64 in photoURL field) */
btnUploadPhoto?.addEventListener("click", async () => {
  const f = photoInput.files?.[0];
  if (!f) return uploadMsg.textContent = "Choose file first";
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

/* set online flag in rider doc for presence */
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

/* logout */
btnLogout?.addEventListener("click", async () => {
  localStorage.removeItem("sh_rider_docid");
  localStorage.removeItem("sh_rider_id");
  try { if (auth) await auth.signOut(); } catch (e) {}
  window.location.href = "./login.html";
});

/* init */
(async function init() {
  await refreshRiderUI();
  await connectEverything();

  // set online
  await setRiderOnline(true);

  // beforeunload set offline
  window.addEventListener("beforeunload", () => {
    try { updateDoc(doc(db, "riders", RIDER_DOC_ID), { status: "offline", lastSeen: Date.now() }); } catch (e) {}
  });

  // try show current location marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      map.setView([lat, lng], 13);
      riderMarker = L.marker([lat, lng]).addTo(map);
    }, () => {}, { enableHighAccuracy: true });
  }
})();