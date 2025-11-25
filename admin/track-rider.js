// admin/track-rider.js
// Map-based admin live tracking (Leaflet). Works without map keys.

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const MAP_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// marker icon (uses uploaded image path from your workspace)
// Dev note: runtime will transform the local path into a usable URL.
const RIDER_ICON_URL = "/mnt/data/Screenshot 2025-11-25 at 8.55.53 PM.png";

// create map
const map = L.map("map", { zoomControl: true }).setView([26.8467, 80.9462], 12);
L.tileLayer(MAP_TILE, { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);

// custom icons
const riderIcon = L.icon({
  iconUrl: RIDER_ICON_URL,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -36]
});

const customerIcon = L.divIcon({
  html: `<div style="background:#2ecc71;width:18px;height:18px;border-radius:50%;border:2px solid #fff;"></div>`,
  className: ""
});

// internal storage
const riders = {};      // riderId -> { marker, polyline, last }
const customers = {};   // orderId -> { marker, last }
const orders = {};      // orderId -> { riderId, status }

// UI refs
const trackList = document.getElementById("trackList");
const sockState = document.getElementById("sockState");

// socket
let socket;
function connectSocket() {
  const SOCKET_URL = API_BASE.replace(/^http/, "ws");
  socket = io(SOCKET_URL, { transports: ["websocket"], reconnectionAttempts: 999 });

  socket.on("connect", () => {
    sockState.textContent = "connected";
    sockState.style.color = "lightgreen";
    console.log("Admin socket connected", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect_error", err && err.message);
    sockState.textContent = "error";
    sockState.style.color = "orange";
  });

  socket.on("disconnect", (reason) => {
    sockState.textContent = "disconnected";
    sockState.style.color = "crimson";
    console.log("Socket disconnected:", reason);
  });

  // rider location (expected payload: { riderId, lat, lng, orderId?, timestamp })
  socket.on("rider:location", (p) => {
    if (!p || !p.riderId || !p.lat || !p.lng) return;
    upsertRiderLocation(p);
  });

  // customer/order location (optional) supports either event names
  socket.on("order:location", (p) => {
    if (!p || !p.orderId || !p.lat || !p.lng) return;
    upsertCustomerLocation(p);
  });
  socket.on("customer:location", (p) => {
    if (!p || !p.orderId || !p.lat || !p.lng) return;
    upsertCustomerLocation(p);
  });

  // order status - stop tracking if delivered
  socket.on("order:status", (p) => {
    if (!p || !p.orderId) return;
    orders[p.orderId] = orders[p.orderId] || {};
    orders[p.orderId].status = p.status;
    if (p.status === "delivered" || p.status === "completed") {
      // optionally remove markers for that order after a small delay
      stopTrackingOrder(p.orderId);
    }
    renderTrackList();
  });
}

function upsertRiderLocation(payload) {
  const { riderId, lat, lng, orderId = null, timestamp } = payload;
  const key = riderId;

  // create if missing
  if (!riders[key]) {
    const marker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
    const poly = L.polyline([[lat, lng]], { color: "#1978c8", weight: 4 }).addTo(map);
    riders[key] = { marker, polyline: poly, last: { lat, lng, timestamp }, orderId };
  } else {
    const r = riders[key];
    r.last = { lat, lng, timestamp };
    r.orderId = orderId || r.orderId;
    r.marker.setLatLng([lat, lng]);
    r.polyline.addLatLng([lat, lng]);
  }

  // auto-pan when first point arrives
  if (!map._userMoved) {
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }

  // auto-expand / update UI list
  orders[orderId] = orders[orderId] || {};
  orders[orderId].riderId = riderId;
  renderTrackList();
}

function upsertCustomerLocation(payload) {
  const { orderId, lat, lng, timestamp } = payload;
  if (!orderId) return;
  if (!customers[orderId]) {
    const marker = L.marker([lat, lng], { icon: customerIcon }).addTo(map);
    customers[orderId] = { marker, last: { lat, lng, timestamp } };
  } else {
    const c = customers[orderId];
    c.last = { lat, lng, timestamp };
    c.marker.setLatLng([lat, lng]);
  }
  renderTrackList();
}

function stopTrackingOrder(orderId) {
  // visually mark as delivered, remove markers after 12s
  const o = orders[orderId];
  if (!o) return;
  o.status = "delivered";
  renderTrackList();

  setTimeout(() => {
    // remove customer marker
    if (customers[orderId]) {
      map.removeLayer(customers[orderId].marker);
      delete customers[orderId];
    }
    // if rider is not assigned to any other active order, optionally remove rider marker
    const riderId = o.riderId;
    if (riderId && riders[riderId]) {
      // remove rider polyline and marker if you want, or keep for history
      // map.removeLayer(riders[riderId].marker);
      // map.removeLayer(riders[riderId].polyline);
      // delete riders[riderId];
    }
    renderTrackList();
  }, 12000);
}

function renderTrackList() {
  const entries = [];

  // gather orders with rider/customer if present
  for (const oid of Object.keys(orders)) {
    const o = orders[oid] || {};
    const rId = o.riderId || "";
    const riderObj = rId ? riders[rId] : null;
    const custObj = customers[oid] || null;
    entries.push({ orderId: oid, riderId: rId, riderObj, custObj, status: o.status || "assigned" });
  }

  // also show riders not tied to an order
  for (const rId of Object.keys(riders)) {
    const r = riders[rId];
    // skip if already listed by order
    const found = entries.find(e => e.riderId === rId);
    if (!found) entries.push({ orderId: null, riderId: rId, riderObj: r, custObj: null, status: "idle" });
  }

  // render
  if (entries.length === 0) {
    trackList.innerHTML = "<div class='muted'>No active trackers</div>";
    return;
  }

  trackList.innerHTML = "";
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "tracker-row";

    const img = document.createElement("img");
    img.src = RIDER_ICON_URL;
    img.alt = "rider";

    const body = document.createElement("div");
    body.className = "tracker-body";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = e.riderId ? `${e.riderId}` : `Order ${e.orderId}`;

    const meta = document.createElement("div");
    meta.className = "meta";

    let coordsText = "";
    if (e.riderObj && e.riderObj.last) {
      coordsText = `R: ${e.riderObj.last.lat.toFixed(5)}, ${e.riderObj.last.lng.toFixed(5)}`;
    }
    if (e.custObj && e.custObj.last) {
      coordsText += (coordsText ? " • " : "") + `C: ${e.custObj.last.lat.toFixed(5)}, ${e.custObj.last.lng.toFixed(5)}`;
    }
    meta.textContent = coordsText || "no location yet";

    const status = document.createElement("div");
    status.className = "status-badge";
    status.textContent = e.status || "active";

    // actions
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "8px";
    btns.style.marginLeft = "8px";

    const centerBtn = document.createElement("button");
    centerBtn.className = "btn-small";
    centerBtn.textContent = "Center";
    centerBtn.onclick = () => {
      if (e.riderObj && e.riderObj.last) {
        map.setView([e.riderObj.last.lat, e.riderObj.last.lng], 15);
      } else if (e.custObj && e.custObj.last) {
        map.setView([e.custObj.last.lat, e.custObj.last.lng], 15);
      }
    };

    btns.appendChild(centerBtn);

    body.appendChild(title);
    body.appendChild(meta);

    row.appendChild(img);
    row.appendChild(body);
    row.appendChild(status);
    row.appendChild(btns);

    trackList.appendChild(row);
  }
}

// wire up a lightweight REST sync (optional)
// fetch active orders to populate list on page load (if your backend supports it)
async function fetchActiveOrders() {
  try {
    const res = await fetch(API_BASE + "/admin/active-orders", { method: "GET" });
    if (!res.ok) return;
    const list = await res.json();
    // expected: [{ orderId, riderId, status }]
    for (const o of list) {
      orders[o.orderId] = orders[o.orderId] || {};
      orders[o.orderId].riderId = o.riderId || null;
      orders[o.orderId].status = o.status || "assigned";
    }
    renderTrackList();
  } catch (e) { /* ignore */ }
}

// init
(async function init() {
  connectSocket();
  await fetchActiveOrders();
  renderTrackList();

  // when admin pans the map manually, avoid auto-pan
  map.on("movestart", () => { map._userMoved = true; });
})();
