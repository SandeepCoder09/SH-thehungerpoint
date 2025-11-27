// rider/dashboard.js
// Shows orders from both /orders and /tempOrders and renders search + filters + track/accept actions.

import {
  db,
  collection,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy
} from "./firebase.js";

// UI elements
const ordersListEl = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const connStatus = document.getElementById("connStatus");
const activeOrderEl = document.getElementById("activeOrder");
const lastSeenEl = document.getElementById("lastSeen");
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const riderAvatar = document.getElementById("riderAvatar");
const btnLogout = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");
const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const avatarFile = document.getElementById("avatarFile");
const btnUploadAvatar = document.getElementById("btnUploadAvatar");

// Rider info (from local storage — set during login)
const RIDER_EMAIL = localStorage.getItem("sh_rider_email") || null;
const RIDER_ID = localStorage.getItem("sh_rider_id") || null;
const RIDER_NAME = localStorage.getItem("sh_rider_name") || null;

if (RIDER_EMAIL) {
  riderEmailEl.textContent = RIDER_EMAIL;
}
if (RIDER_NAME) {
  riderNameEl.textContent = RIDER_NAME;
}

// map setup (leaflet)
let map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
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
function setCustomerMarker(id, lat, lng) {
  if (customerMarkers.has(id)) {
    customerMarkers.get(id).setLatLng([lat, lng]);
  } else {
    const m = L.marker([lat, lng], { title: "Customer" }).addTo(map);
    customerMarkers.set(id, m);
  }
}
function fitBoth(id) {
  const c = customerMarkers.get(id);
  if (!c || !riderMarker) return;
  const group = new L.featureGroup([riderMarker, c]);
  map.fitBounds(group.getBounds().pad(0.25));
}

// global orders state (merged)
const orders = {}; // orderId -> order object

function mergeAndRenderOrder(order) {
  orders[order.orderId] = { ...(orders[order.orderId] || {}), ...order };
  renderOrders();
}

// HELPERS: load initial snapshots for both collections
async function attachSnapshots() {
  const ordersCol = collection(db, "orders");
  const tempCol = collection(db, "tempOrders");

  // orders
  onSnapshot(ordersCol, (snap) => {
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      const data = { orderId: id, ...(ch.doc.data() || {}) };
      mergeAndRenderOrder(data);
    });
  });

  // tempOrders
  onSnapshot(tempCol, (snap) => {
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      const data = { orderId: id, ...(ch.doc.data() || {}) };
      // mark origin so you can see where it came from
      data._origin = "tempOrders";
      mergeAndRenderOrder(data);
    });
  });

  // initial fetch (in case onSnapshot missed)
  try {
    const oSnap = await getDocs(ordersCol);
    oSnap.forEach(d => mergeAndRenderOrder({ orderId: d.id, ...(d.data()||{}) }));
  } catch (e) { console.warn("orders fetch err", e); }

  try {
    const tSnap = await getDocs(tempCol);
    tSnap.forEach(d => mergeAndRenderOrder({ orderId: d.id, ...(d.data()||{}), _origin:"tempOrders" }));
  } catch (e) { console.warn("tempOrders fetch err", e); }
}

// Render list with filters & search
function renderOrders() {
  const q = (searchInput.value || "").toLowerCase().trim();
  const filter = filterSelect.value;

  const arr = Object.values(orders).sort((a,b) => {
    const ta = a.updatedAt || a.createdAt || 0;
    const tb = b.updatedAt || b.createdAt || 0;
    return (tb - ta);
  });

  const filtered = arr.filter(o => {
    // filter type
    if (filter === "assigned" && !o.riderId) return false;
    if (filter === "unassigned" && o.riderId) return false;
    if (filter === "accepted" && (o.status || "").toLowerCase() !== "accepted") return false;
    if (filter === "picked" && (o.status || "").toLowerCase() !== "picked") return false;
    if (filter === "delivered" && (o.status || "").toLowerCase() !== "delivered") return false;

    // search
    if (!q) return true;
    const hay = `${o.orderId} ${(o.items||[]).map(i=>i.name).join(" ")} ${o.customerName||o.customerId||""} ${o.status||""}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    ordersListEl.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  ordersListEl.innerHTML = "";
  for (const o of filtered) {
    const card = document.createElement("div");
    card.className = "order-card";

    const left = document.createElement("div");
    left.className = "order-left";

    const meta = document.createElement("div");
    meta.innerHTML = `<div class="order-meta">${o.orderId} <span class="small muted"> ${o._origin ? "(temp)" : ""}</span></div>
                      <div class="order-items">${(o.items||[]).map(it=>`${it.name} × ${it.qty}`).join(", ")}</div>
                      <div class="order-items small muted">Status: ${o.status || "new"}</div>`;

    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "order-actions";

    const btnView = document.createElement("button");
    btnView.className = "btn ghost";
    btnView.textContent = "View";
    btnView.onclick = (ev) => { ev.stopPropagation(); showOrderModal(o.orderId); };

    const btnTrack = document.createElement("button");
    btnTrack.className = "btn";
    btnTrack.textContent = "Track";
    btnTrack.onclick = (ev) => {
      ev.stopPropagation();
      // open track page — adapt URL as needed
      const url = `/rider/track-order.html?orderId=${encodeURIComponent(o.orderId)}`;
      window.open(url, "_blank");
    };

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn";
    btnAccept.textContent = "Accept";
    btnAccept.onclick = async (ev) => {
      ev.stopPropagation();
      await acceptOrder(o.orderId);
    };

    actions.appendChild(btnView);
    actions.appendChild(btnTrack);
    actions.appendChild(btnAccept);

    card.appendChild(left);
    card.appendChild(actions);

    // click selects order and centers map
    card.onclick = () => {
      if (o.customerLoc) {
        setCustomerMarker(o.orderId, o.customerLoc.lat, o.customerLoc.lng);
        if (riderMarker) fitBoth(o.orderId);
        else map.setView([o.customerLoc.lat, o.customerLoc.lng], 13);
      } else {
        alert("Customer location not available for this order.");
      }
    };

    ordersListEl.appendChild(card);
  }
}

// accept order
async function acceptOrder(orderId) {
  try {
    const ref = doc(db, "orders", orderId);
    await updateDoc(ref, { riderId: RIDER_ID || RIDER_EMAIL || null, status: "accepted", acceptedAt: Date.now() });
    alert(`Accepted ${orderId}`);
  } catch (err) {
    console.error("accept err", err);
    alert("Accept failed. Check console.");
  }
}

// simple detail modal (browser alert for now)
function showOrderModal(orderId) {
  const o = orders[orderId];
  if (!o) return alert("Order not found");
  const items = (o.items||[]).map(it=>`${it.name} × ${it.qty} (₹${it.price||0})`).join("\n");
  alert(`Order: ${orderId}\nStatus: ${o.status || "—"}\nCustomer: ${o.customerName||o.customerId||"—"}\n\nItems:\n${items}`);
}

// last seen helper
function updateLastSeen(ts) {
  if (!ts) return lastSeenEl.textContent = "—";
  const d = new Date(ts);
  lastSeenEl.textContent = `${d.toLocaleString()}`;
}

// Avatar upload (simple: stores file URL to Firestore rider doc - requires storage setup if you want file upload; here we store base64 inline as dataURL if small)
btnUploadAvatar?.addEventListener("click", async () => {
  const f = avatarFile.files?.[0];
  if (!f) return alert("Pick a file first");
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataURL = e.target.result;
    try {
      // store to riders collection doc (doc id probably email)
      const riderDocId = RIDER_EMAIL;
      if (!riderDocId) return alert("No rider id in localStorage");
      await updateDoc(doc(db, "riders", riderDocId), { avatarDataURL: dataURL, updatedAt: Date.now() });
      riderAvatar.src = dataURL;
      alert("Avatar updated (stored in Firestore)");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };
  reader.readAsDataURL(f);
});

// logout
btnLogout?.addEventListener("click", () => {
  localStorage.removeItem("sh_rider_email");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_name");
  window.location.href = "./login.html";
});
btnBack?.addEventListener("click", () => window.history.back());

// wire search & filter
searchInput?.addEventListener("input", renderOrders);
filterSelect?.addEventListener("change", renderOrders);

// show rider avatar if exists in firestore (one-time)
async function loadRiderProfile() {
  if (!RIDER_EMAIL) return;
  try {
    const rDoc = await getDoc(doc(db, "riders", RIDER_EMAIL));
    if (rDoc.exists()) {
      const data = rDoc.data();
      if (data.avatarDataURL) riderAvatar.src = data.avatarDataURL;
      if (data.lastSeen) updateLastSeen(data.lastSeen);
      if (data.name) riderNameEl.textContent = data.name;
      if (data.status) connStatus.textContent = data.status;
    }
  } catch (e) { console.warn("load profile err", e); }
}

// start: attach snapshots and initial load
(async function init() {
  await attachSnapshots();
  await loadRiderProfile();
  renderOrders();

  // try browser geolocation to show rider on map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => {
      setRiderMarker(p.coords.latitude, p.coords.longitude);
      map.setView([p.coords.latitude, p.coords.longitude], 13);
    }, (err) => {}, { enableHighAccuracy: true });
  }
})();
