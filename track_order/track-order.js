/**
 * track-order.js
 * - Connects to Firestore and reads order details
 * - Connects to socket.io server to receive `order:riderLocation`
 * - Updates Leaflet map markers, ETA and timeline
 *
 * Requires:
 * - Firebase v8 loaded (global firebase)
 * - Socket.IO client library loaded
 * - Leaflet loaded
 *
 * Server socket: https://sh-thehungerpoint.onrender.com
 */

const SERVER_SOCKET = "https://sh-thehungerpoint.onrender.com";
const params = new URLSearchParams(window.location.search);
const ORDER_ID = params.get("orderId") || null;

// Defensive: ensure firebase is available
if (typeof firebase === "undefined") {
  console.warn("Firebase not loaded - track page may still work for socket updates.");
}

// Initialize firebase if not already (small check - won't reinit if already initialized)
try {
  if (typeof firebase !== "undefined" && !firebase.apps?.length) {
    // NOTE: we expect home/firebase-config.js to run in other pages.
    // If you prefer, you can paste your firebaseConfig block here.
    // For safety we do not attempt to init here if config missing.
    console.log("Firebase present but not initialized here. If you see errors, ensure firebase-config is loaded.");
  }
} catch (e) {
  console.warn("Firebase init check error", e);
}

/* ---- Map & markers ---- */
let map = null;
let riderMarker = null;
let userMarker = null;

function initMap() {
  try {
    map = L.map("map", { zoomControl: true }).setView([25.15, 82.58], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: ""
    }).addTo(map);
  } catch (err) {
    console.error("Leaflet init error", err);
    document.getElementById("map").style.background = "#ddd";
  }
}

function addOrMoveRider(lat, lng) {
  if (!map) return;
  if (!riderMarker) {
    riderMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
        iconSize: [40, 40]
      })
    }).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }
  map.panTo([lat, lng], { animate: true, duration: 0.5 });
}

function addOrMoveUser(lat, lng) {
  if (!map) return;
  if (!userMarker) {
    userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [34, 34]
      })
    }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

/* ---- UI helpers ---- */
function setStatus(status, eta) {
  const st = (status || "preparing").toString().toLowerCase();
  const statusEl = document.getElementById("orderStatus");
  const etaEl = document.getElementById("etaText");

  if (st === "out_for_delivery" || st === "out" || st === "on_the_way") {
    statusEl.textContent = "Out for Delivery";
    activateStep(2);
  } else if (st === "delivered" || st === "completed") {
    statusEl.textContent = "Delivered";
    activateStep(3);
  } else {
    statusEl.textContent = "Preparing";
    activateStep(1);
  }

  if (typeof eta !== "undefined" && eta !== null && eta !== "") {
    etaEl.textContent = `${eta} min`;
  } else {
    etaEl.textContent = "—";
  }
}

function activateStep(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById("step" + i);
    if (!el) return;
    if (i <= n) el.classList.add("active");
    else el.classList.remove("active");
  });
}

/* ---- Load order from Firestore (if available) ---- */
async function loadOrderFromFirestore(orderId) {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.warn("Firestore not available - skipping order load");
    return;
  }
  try {
    const doc = await firebase.firestore().collection("orders").doc(orderId).get();
    if (!doc.exists) {
      console.warn("Order not found in Firestore:", orderId);
      document.getElementById("itemsList").textContent = "Order data unavailable";
      return;
    }
    const data = doc.data();

    // items
    const items = data.items || data.orderItems || [];
    document.getElementById("itemsList").innerHTML =
      (items.length ? items.map(i => `${i.name} × ${i.qty}`).join("<br>") : "No items");

    // status & eta
    const status = data.status || data.order_status || "";
    const eta = data.eta || data.ETA || data.estimatedTime || null;
    setStatus(status, eta);

    // user location
    if (data.userLocation && data.userLocation.lat && data.userLocation.lng) {
      addOrMoveUser(Number(data.userLocation.lat), Number(data.userLocation.lng));
      // adjust map view to show markers if rider exists later
      if (map && !riderMarker) map.setView([Number(data.userLocation.lat), Number(data.userLocation.lng)], 13);
    }
  } catch (err) {
    console.error("Failed to load order from Firestore", err);
  }
}

/* ---- Socket: subscribe to rider location for this order ---- */
function startSocket(orderId) {
  try {
    if (!orderId) return console.warn("orderId missing - socket not started");
    const socket = io(SERVER_SOCKET, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      socket.emit("order:join", { orderId });
    });

    socket.on("order:riderLocation", (data) => {
      if (!data) return;
      // server may send { orderId, lat, lng, status, eta }
      if (data.orderId && String(data.orderId) !== String(orderId)) return;
      if (data.lat && data.lng) addOrMoveRider(Number(data.lat), Number(data.lng));
      if (data.status) setStatus(data.status, data.eta || data.ETA);
      if (data.userLocation && data.userLocation.lat && data.userLocation.lng) {
        addOrMoveUser(Number(data.userLocation.lat), Number(data.userLocation.lng));
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connect error", err);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  } catch (err) {
    console.warn("Socket failed to start", err);
  }
}

/* ---- initialization ---- */
document.addEventListener("DOMContentLoaded", () => {
  initMap();

  // validate order id
  if (!ORDER_ID) {
    document.getElementById("itemsList").textContent = "No orderId provided in URL.";
    setStatus("preparing", null);
    return;
  }

  // attempt to load order from Firestore
  loadOrderFromFirestore(ORDER_ID);

  // connect to socket server for live updates
  startSocket(ORDER_ID);

  // actions
  document.getElementById("callBtn").onclick = () => {
    window.location.href = "tel:+911234567890";
  };
  document.getElementById("helpBtn").onclick = () => {
    alert("Contact support at +91 12345 67890");
  };
});