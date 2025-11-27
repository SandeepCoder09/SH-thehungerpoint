import { 
  db, collection, onSnapshot, doc, updateDoc 
} from "/rider/firebase.js";

import { connectSocket, getSocket } from "/rider/socket-client.js";
import RIDER_GPS from "/rider/rider-gps.js";

const riderId = localStorage.getItem("sh_rider_id");
const token = localStorage.getItem("sh_rider_token");
if (!riderId || !token) window.location.href = "/rider/login.html";

// DOM
const riderName = document.getElementById("riderName");
const riderEmail = document.getElementById("riderEmail");
const riderStatus = document.getElementById("riderStatus");
const riderPhoto = document.getElementById("riderPhoto");

const connStatus = document.getElementById("connStatus");
const lastSeen = document.getElementById("lastSeen");
const ordersList = document.getElementById("ordersList");
const activeOrderSpan = document.getElementById("activeOrder");

const btnAcceptSelected = document.getElementById("btnAcceptSelected");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnDeliver = document.getElementById("btnDeliver");
const btnLogout = document.getElementById("btnLogout");

let selectedOrderId = null;
let ordersState = {};

// Load rider profile from Firestore
import { getDoc } from "/rider/firebase.js";
(async function loadProfile() {
  const snap = await getDoc(doc(db, "riders", riderId));
  if (snap.exists()) {
    const d = snap.data();
    riderName.textContent = d.name || "Rider";
    riderEmail.textContent = d.email || riderEmail.textContent;
    if (d.photoURL) riderPhoto.src = d.photoURL;
  }
})();


// ---------------- MAP ---------------- //
const map = L.map("map").setView([25, 82], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let riderMarker = null;
let customerMarkers = new Map();

function setRiderMarker(lat, lng) {
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng]).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }
}

function setCustomerMarker(orderId, lat, lng) {
  if (customerMarkers.has(orderId)) {
    customerMarkers.get(orderId).setLatLng([lat, lng]);
  } else {
    customerMarkers.set(orderId, L.marker([lat, lng]).addTo(map));
  }
}


// ---------------- SOCKET ---------------- //
let socket;

async function startSocket() {
  socket = await connectSocket({ token, riderId });

  connStatus.textContent = "connected";
  connStatus.style.color = "lime";

  socket.on("order:riderLocation", (p) => {
    if (p.riderId === riderId) {
      setRiderMarker(p.lat, p.lng);
    }
  });
}

startSocket();


// ---------------- FIRESTORE LIVE ORDERS ---------------- //
onSnapshot(collection(db, "orders"), (snap) => {
  snap.docChanges().forEach(ch => {
    const id = ch.doc.id;
    const data = ch.doc.data();
    ordersState[id] = { orderId: id, ...data };
  });

  renderOrders();
});


// ---------------- RENDER ORDER CARDS ---------------- //
function renderOrders() {
  ordersList.innerHTML = "";

  const arr = Object.values(ordersState)
    .sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));

  if (!arr.length) {
    ordersList.innerHTML = `<div class='small'>No orders</div>`;
    return;
  }

  for (const o of arr) {
    const card = document.createElement("div");
    card.className = "order-card";

    card.innerHTML = `
      <div>
        <div><b>${o.orderId}</b></div>
        <div class="small">${o.status || "new"}</div>
      </div>
      <div>
        <button class="btn" data-view="${o.orderId}">View</button>
        <button class="btn red" data-accept="${o.orderId}">Accept</button>
      </div>
    `;

    card.querySelector("[data-view]")
      .onclick = (ev)=> viewOrder(ev.target.dataset.view);

    card.querySelector("[data-accept]")
      .onclick = (ev)=> acceptOrder(ev.target.dataset.accept);

    ordersList.appendChild(card);
  }
}


// ---------------- ORDER ACTIONS ---------------- //

function viewOrder(orderId) {
  selectedOrderId = orderId;
  activeOrderSpan.textContent = orderId;
}

async function acceptOrder(orderId) {
  await updateDoc(doc(db,"orders",orderId),{
    riderId,
    status:"accepted"
  });

  const s = getSocket();
  s?.emit("order:status", { orderId, status:"accepted" });

  selectedOrderId = orderId;
  activeOrderSpan.textContent = orderId;
}

btnStartTrip.onclick = () => {
  if (!selectedOrderId) return alert("Select order first");
  updateDoc(doc(db,"orders",selectedOrderId),{ status:"picked" });
  getSocket()?.emit("order:status", { orderId:selectedOrderId, status:"picked" });
  RIDER_GPS.start();
};

btnDeliver.onclick = () => {
  if (!selectedOrderId) return alert("Select order first");

  updateDoc(doc(db,"orders",selectedOrderId),{ status:"delivered" });
  getSocket()?.emit("order:status", { orderId:selectedOrderId, status:"delivered" });

  RIDER_GPS.stop();
};

btnLogout.onclick = () => {
  localStorage.removeItem("sh_rider_token");
  localStorage.removeItem("sh_rider_id");
  window.location.href="/rider/login.html";
};