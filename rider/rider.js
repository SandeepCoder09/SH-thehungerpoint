// rider/rider.js
// Full rider frontend logic — profiles, orders, GPS, socket, avatar upload

import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";

import { connectSocket, getSocket } from "./socket-client.js";
import RIDER_GPS from "./rider-gps.js";

/* -------------------------
   DOM
   ------------------------- */
const riderNameEl = document.getElementById("riderName");
const riderEmailEl = document.getElementById("riderEmail");
const riderIdBoxEl = document.getElementById("riderIdBox");
const avatarEl = document.getElementById("avatar");
const onlineDot = document.getElementById("onlineDot");
const onlineText = document.getElementById("onlineText");
const connStatusEl = document.getElementById("connStatus");
const lastSeenEl = document.getElementById("lastSeen");
const activeOrderEl = document.getElementById("activeOrder");

const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");

const photoFileInput = document.getElementById("photoFile");
const btnUpload = document.getElementById("btnUpload");

const ordersListEl = document.getElementById("ordersList");

/* -------------------------
   Local state
   ------------------------- */
let socket = null;
let riderEmail = localStorage.getItem("sh_rider_email");
let riderId = localStorage.getItem("sh_rider_id");
let riderName = localStorage.getItem("sh_rider_name") || "";
let riderDocRef = null;
let selectedOrderId = null;
let ordersState = {}; // orderId -> order data

// guard: require login
if (!riderEmail || !riderId) {
  // Not logged in — redirect to login
  window.location.href = "/rider/login.html";
}

/* -------------------------
   Util
   ------------------------- */
function fmtTime(ts) {
  if (!ts) return "—";
  try {
    const d = typeof ts === "number" ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function setOnlineUI(isOnline) {
  if (isOnline) {
    onlineDot.classList.remove("off");
    onlineDot.classList.add("on");
    onlineText.textContent = "Online";
  } else {
    onlineDot.classList.remove("on");
    onlineDot.classList.add("off");
    onlineText.textContent = "Offline";
  }
}

/* -------------------------
   Initialize: load rider profile
   ------------------------- */
async function loadRiderProfile() {
  riderDocRef = doc(db, "riders", riderEmail);
  try {
    const snap = await getDoc(riderDocRef);
    if (!snap.exists()) {
      alert("Rider profile not found. Contact admin.");
      return;
    }
    const data = snap.data();
    riderName = data.name || riderName || "Rider";
    riderNameEl.textContent = riderName;
    riderEmailEl.textContent = data.email || riderEmail;
    riderIdBoxEl.textContent = data.riderId || riderId;
    riderId = data.riderId || riderId;

    // avatar
    if (data.avatarUrl) {
      avatarEl.src = data.avatarUrl;
    } else {
      avatarEl.src = "/home/SH-Favicon.png";
    }

    // online status & lastSeen
    setOnlineUI(data.status === "online");
    lastSeenEl.textContent = data.lastSeen ? fmtTime(data.lastSeen) : "—";
    activeOrderEl.textContent = data.activeOrder || "—";
  } catch (err) {
    console.error("loadRiderProfile error:", err);
  }
}

/* -------------------------
   Socket connect + events
   ------------------------- */
async function startSocket() {
  try {
    socket = await connectSocket({ riderId, token: null });

    connStatusEl.textContent = "connected";
    connStatusEl.style.color = "lightgreen";
    setOnlineUI(true);
    await setRiderOnline(true);

    socket.on("disconnect", () => {
      connStatusEl.textContent = "disconnected";
      connStatusEl.style.color = "crimson";
      setOnlineUI(false);
      updateLastSeen();
    });

    socket.on("connect_error", (err) => {
      console.warn("socket connect_error", err);
      connStatusEl.textContent = "error";
      connStatusEl.style.color = "orange";
    });

    // order status updates (admin or system)
    socket.on("order:status", (p) => {
      if (!p || !p.orderId) return;
      ordersState[p.orderId] = ordersState[p.orderId] || {};
      ordersState[p.orderId].status = p.status;
      ordersState[p.orderId].updatedAt = p.timestamp || Date.now();
      renderOrders();
      if (selectedOrderId === p.orderId) showSelectedOrder(p.orderId);
    });

    // rider location updates (could be others)
    socket.on("order:riderLocation", (p) => {
      if (!p || !p.orderId) return;
      // keep small state, map rendering handled elsewhere (we rely on rider-gps + leaflet)
      ordersState[p.orderId] = ordersState[p.orderId] || {};
      ordersState[p.orderId].riderLoc = { lat: p.lat, lng: p.lng };
      ordersState[p.orderId].updatedAt = p.timestamp || Date.now();
      renderOrders();
    });

    // optional admin assignment event
    socket.on("admin:orderAssigned", (p) => {
      // reload orders from firestore snapshot will pick this up
      console.log("admin assigned", p);
    });

  } catch (err) {
    console.error("startSocket error:", err);
    connStatusEl.textContent = "failed";
    connStatusEl.style.color = "crimson";
  }
}

/* -------------------------
   Firestore: orders snapshot
   ------------------------- */
function subscribeOrders() {
  try {
    const col = collection(db, "orders");
    // we listen to whole collection and filter client-side
    onSnapshot(col, (snap) => {
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id;
        const d = ch.doc.data() || {};
        ordersState[id] = { orderId: id, ...d };
        // normalize timestamps if necessary
      });
      renderOrders();
    }, (err) => {
      console.warn("orders onSnapshot error:", err);
    });
  } catch (err) {
    console.error("subscribeOrders error", err);
  }
}

/* -------------------------
   Render orders list
   ------------------------- */
function renderOrders() {
  ordersListEl.innerHTML = "";
  const arr = Object.values(ordersState).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!arr.length) {
    ordersListEl.innerHTML = "<div class='small muted'>No orders</div>";
    return;
  }

  for (const o of arr) {
    // display only new/unassigned or assigned-to-this-rider
    if (o.riderId && o.riderId !== riderId) continue;

    const div = document.createElement("div");
    div.className = "order-card";

    const itemsText = (o.items || []).map(i => `${i.name}×${i.qty}`).join(", ");

    div.innerHTML = `
      <div class="order-left">
        <div style="font-weight:700">${o.orderId}</div>
        <div class="small">${o.status || "new"}</div>
        <div class="small">${itemsText}</div>
      </div>
      <div class="order-actions"></div>
    `;

    div.addEventListener("click", () => selectOrder(o.orderId));

    const actions = div.querySelector(".order-actions");
    const btnView = document.createElement("button");
    btnView.className = "btn ghost";
    btnView.textContent = "View";
    btnView.addEventListener("click", (ev) => { ev.stopPropagation(); selectOrder(o.orderId); });

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn";
    btnAccept.textContent = "Accept";
    btnAccept.addEventListener("click", (ev) => { ev.stopPropagation(); acceptOrder(o.orderId); });

    actions.appendChild(btnView);
    actions.appendChild(btnAccept);

    ordersListEl.appendChild(div);
  }
}

/* -------------------------
   Select + show order
   ------------------------- */
function selectOrder(orderId) {
  selectedOrderId = orderId;
  showSelectedOrder(orderId);
}

function showSelectedOrder(orderId) {
  const o = ordersState[orderId];
  if (!o) return;
  activeOrderEl.textContent = orderId;
  // update map markers if you maintain a map (map handled by rider-gps/init)
  // highlight selected card
  Array.from(document.querySelectorAll(".order-card")).forEach(el => {
    el.classList.toggle("selected", el.textContent.includes(orderId));
  });
}

/* -------------------------
   Accept / Start / Deliver
   ------------------------- */
async function acceptOrder(orderId) {
  if (!orderId) return alert("No order selected");
  try {
    await updateDoc(doc(db, "orders", orderId), {
      riderId,
      status: "accepted",
      acceptedAt: Date.now()
    });
    // notify via socket
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId, status: "accepted", timestamp: Date.now() });
    selectedOrderId = orderId;
    activeOrderEl.textContent = orderId;
  } catch (err) {
    console.error("acceptOrder error:", err);
    alert("Accept failed. Check console.");
  }
}

async function startTrip() {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "picked",
      pickedAt: Date.now()
    });
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "picked", timestamp: Date.now() });

    // mark rider activeOrder and set status online in rider doc
    await updateDoc(riderDocRef, { activeOrder: selectedOrderId, status: "online" }).catch(() => {});

    // start GPS sharing
    RIDER_GPS.start();
  } catch (err) {
    console.error("startTrip error:", err);
    alert("Start trip failed");
  }
}

async function markDelivered() {
  if (!selectedOrderId) return alert("Select an order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "delivered",
      deliveredAt: Date.now()
    });
    const s = getSocket();
    if (s && s.connected) s.emit("order:status", { orderId: selectedOrderId, status: "delivered", timestamp: Date.now() });

    // clear rider activeOrder
    await updateDoc(riderDocRef, { activeOrder: null, status: "online" }).catch(() => {});
    RIDER_GPS.stop();
    selectedOrderId = null;
    activeOrderEl.textContent = "—";
  } catch (err) {
    console.error("markDelivered error:", err);
    alert("Mark delivered failed");
  }
}

/* -------------------------
   Avatar upload
   ------------------------- */
async function uploadAvatar() {
  const file = photoFileInput.files[0];
  if (!file) return alert("Choose a file first");
  try {
    const path = `riders/${riderEmail}/avatar_${Date.now()}.${file.name.split(".").pop()}`;
    const ref = storageRef(storage, path);
    const snap = await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);

    // update rider doc
    await updateDoc(riderDocRef, { avatarUrl: url }).catch(() => {});
    avatarEl.src = url;
    alert("Avatar uploaded");
  } catch (err) {
    console.error("uploadAvatar error:", err);
    alert("Upload failed");
  }
}

/* -------------------------
   Rider online/offline helpers
   ------------------------- */
async function setRiderOnline(isOnline) {
  try {
    await updateDoc(riderDocRef, { status: isOnline ? "online" : "offline" });
    setOnlineUI(isOnline);
  } catch (err) {
    console.warn("setRiderOnline error:", err);
  }
}

async function updateLastSeen() {
  try {
    await updateDoc(riderDocRef, { lastSeen: Date.now(), status: "offline" });
    lastSeenEl.textContent = fmtTime(Date.now());
    setOnlineUI(false);
  } catch (err) {
    console.warn("updateLastSeen error:", err);
  }
}

/* -------------------------
   UI events
   ------------------------- */
btnAcceptSelected?.addEventListener("click", () => {
  if (!selectedOrderId) return alert("Select an order first");
  acceptOrder(selectedOrderId);
});
btnStartTrip?.addEventListener("click", startTrip);
btnDeliver?.addEventListener("click", markDelivered);
btnLogout?.addEventListener("click", async () => {
  try {
    // set offline & lastSeen
    await updateLastSeen();
  } catch {}
  localStorage.removeItem("sh_rider_email");
  localStorage.removeItem("sh_rider_id");
  localStorage.removeItem("sh_rider_name");
  window.location.href = "./login.html";
});
btnUpload?.addEventListener("click", uploadAvatar);

/* -------------------------
   Firestore rider snapshot (live updates)
   ------------------------- */
function subscribeRiderDoc() {
  try {
    onSnapshot(riderDocRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.name && d.name !== riderName) {
        riderName = d.name;
        riderNameEl.textContent = d.name;
      }
      if (d.email) riderEmailEl.textContent = d.email;
      if (d.riderId) riderIdBoxEl.textContent = d.riderId;
      if (d.avatarUrl) avatarEl.src = d.avatarUrl;
      if (d.status) setOnlineUI(d.status === "online");
      if (d.lastSeen) lastSeenEl.textContent = fmtTime(d.lastSeen);
      if (d.activeOrder) activeOrderEl.textContent = d.activeOrder;
    });
  } catch (err) {
    console.warn("subscribeRiderDoc error:", err);
  }
}

/* -------------------------
   Init
   ------------------------- */
(async function init() {
  try {
    // load profile
    await loadRiderProfile();

    // subscribe to rider doc changes
    subscribeRiderDoc();

    // subscribe to orders
    subscribeOrders();

    // connect socket
    await startSocket();

    // when page unload -> set last seen
    window.addEventListener("beforeunload", async () => {
      try {
        await updateLastSeen();
      } catch {}
    });

    // attempt to set initial online state
    await setRiderOnline(true);

  } catch (err) {
    console.error("init error:", err);
  }
})();
