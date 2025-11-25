// admin/index.js (module)
const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE.replace(/^http/, "ws");

// local image (from your uploaded file) — used as rider avatar fallback
const RIDER_IMG = "/mnt/data/Screenshot 2025-11-25 at 8.55.53 PM.png";

// DOM
const ordersListEl = document.getElementById("ordersList");
const orderDetailsEl = document.getElementById("orderDetails");
const sockStatusEl = document.getElementById("sockStatus");
const cardActive = document.getElementById("cardActive");
const cardDelivered = document.getElementById("cardDelivered");
const btnRefresh = document.getElementById("btnRefresh");
const btnShowMap = document.getElementById("btnShowMap");

// state
const orders = {}; // orderId -> order object (merged from API + socket)
let socket;

// utility
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - (ts)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  return `${Math.floor(diff/3600)}h`;
}

// render summary cards
function renderCards() {
  const all = Object.keys(orders).length;
  const delivered = Object.values(orders).filter(o => o.status === "delivered" || o.status === "completed").length;
  cardActive.textContent = String(all);
  cardDelivered.textContent = String(delivered);
}

// render orders list
function renderOrdersList() {
  const arr = Object.values(orders).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
  if (arr.length === 0) {
    ordersListEl.innerHTML = "<div class='muted'>No active orders</div>";
    orderDetailsEl.innerHTML = "<div class='muted'>Select an order to see details</div>";
    renderCards();
    return;
  }

  ordersListEl.innerHTML = "";
  for (const o of arr) {
    const row = document.createElement("div");
    row.className = "order-row";

    const img = document.createElement("img");
    img.className = "order-avatar";
    img.src = o.riderAvatar || RIDER_IMG;
    img.onerror = () => img.src = RIDER_IMG;

    const body = document.createElement("div");
    body.className = "order-body";

    const title = document.createElement("div");
    title.className = "order-title";
    title.textContent = `${o.orderId} • ${o.customerName || o.customerId || "Customer"}`;

    const meta = document.createElement("div");
    meta.className = "order-meta";
    const rpos = o.riderLoc ? `R: ${o.riderLoc.lat.toFixed(5)},${o.riderLoc.lng.toFixed(5)}` : "R: —";
    const cpos = o.customerLoc ? `C: ${o.customerLoc.lat.toFixed(5)},${o.customerLoc.lng.toFixed(5)}` : "C: —";
    meta.textContent = `${rpos} • ${cpos} • ${o.status || "unknown"} • ${timeAgo(o.updatedAt)}`;

    const actions = document.createElement("div");
    actions.className = "order-actions";

    const trackBtn = document.createElement("button");
    trackBtn.className = "btn";
    trackBtn.textContent = "Track";
    trackBtn.onclick = () => {
      const url = `/admin/track-rider.html?orderId=${encodeURIComponent(o.orderId)}`;
      window.open(url, "_blank");
    };

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn";
    detailsBtn.style.background = "#444";
    detailsBtn.textContent = "Details";
    detailsBtn.onclick = () => showOrderDetails(o.orderId);

    const statusEl = document.createElement("div");
    statusEl.className = "status " + (o.status || "");
    statusEl.textContent = (o.status || "unknown").toLowerCase();

    body.appendChild(title);
    body.appendChild(meta);

    row.appendChild(img);
    row.appendChild(body);
    row.appendChild(statusEl);
    row.appendChild(actions);
    actions.appendChild(trackBtn);
    actions.appendChild(detailsBtn);

    // click selects
    row.addEventListener("click", (ev) => {
      if (ev.target === trackBtn || ev.target === detailsBtn) return;
      showOrderDetails(o.orderId);
    });

    ordersListEl.appendChild(row);
  }

  renderCards();
}

// show detailed info
function showOrderDetails(orderId) {
  const o = orders[orderId];
  if (!o) return;
  orderDetailsEl.innerHTML = `
    <div class="row"><strong>Order:</strong> ${o.orderId}</div>
    <div class="row"><strong>Status:</strong> ${o.status || ''}</div>
    <div class="row"><strong>Rider:</strong> ${o.riderId || '—'}</div>
    <div class="row"><strong>Rider Loc:</strong> ${o.riderLoc ? `${o.riderLoc.lat}, ${o.riderLoc.lng}` : '—'}</div>
    <div class="row"><strong>Customer:</strong> ${o.customerName || o.customerId || '—'}</div>
    <div class="row"><strong>Customer Loc:</strong> ${o.customerLoc ? `${o.customerLoc.lat}, ${o.customerLoc.lng}` : '—'}</div>
    <div class="row"><strong>Last updated:</strong> ${o.updatedAt ? new Date(o.updatedAt).toLocaleString() : '—'}</div>
  `;
}

// fetch active orders (Option A expected API)
async function fetchActiveOrders() {
  try {
    const res = await fetch(API_BASE + "/admin/active-orders");
    if (!res.ok) {
      console.warn("active-orders API returned", res.status);
      return;
    }
    const list = await res.json();
    // expected: array of { orderId, riderId, customerId, status, riderLat, riderLng, customerLat, customerLng, customerName }
    for (const it of list) {
      orders[it.orderId] = orders[it.orderId] || {};
      orders[it.orderId].orderId = it.orderId;
      orders[it.orderId].riderId = it.riderId;
      orders[it.orderId].customerId = it.customerId;
      orders[it.orderId].customerName = it.customerName;
      orders[it.orderId].status = it.status;
      orders[it.orderId].riderLoc = it.riderLat && it.riderLng ? { lat: it.riderLat, lng: it.riderLng } : orders[it.orderId].riderLoc || null;
      orders[it.orderId].customerLoc = it.customerLat && it.customerLng ? { lat: it.customerLat, lng: it.customerLng } : orders[it.orderId].customerLoc || null;
      orders[it.orderId].updatedAt = Date.now();
    }
    renderOrdersList();
  } catch (e) {
    console.error("fetchActiveOrders error", e);
  }
}

// SOCKET: realtime updates
function connectSocket() {
  socket = io(SOCKET_URL, { transports: ["websocket"], reconnectionAttempts: 99 });

  socket.on("connect", () => {
    sockStatusEl.textContent = "connected";
    sockStatusEl.style.color = "lightgreen";
  });
  socket.on("disconnect", () => {
    sockStatusEl.textContent = "disconnected";
    sockStatusEl.style.color = "crimson";
  });
  socket.on("connect_error", (err) => {
    sockStatusEl.textContent = "error";
    sockStatusEl.style.color = "orange";
    console.warn("socket error", err);
  });

  socket.on("rider:location", (p) => {
    // p: { riderId, lat, lng, orderId?, timestamp }
    if (!p || !p.orderId) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.riderId = p.riderId || o.riderId;
    o.riderLoc = { lat: p.lat, lng: p.lng };
    o.updatedAt = p.timestamp || Date.now();
    renderOrdersList();
  });

  socket.on("order:location", (p) => {
    // p: { orderId, lat, lng, timestamp }
    if (!p) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.customerLoc = { lat: p.lat, lng: p.lng };
    o.updatedAt = p.timestamp || Date.now();
    renderOrdersList();
  });

  socket.on("order:status", (p) => {
    // p: { orderId, status }
    if (!p) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.status = p.status;
    o.updatedAt = Date.now();
    renderOrdersList();
  });
}

// simple UI hooks
btnRefresh?.addEventListener("click", () => fetchActiveOrders());
btnShowMap?.addEventListener("click", () => window.open("/admin/track-rider.html", "_blank"));

// init
(async function init() {
  renderOrdersList();
  await fetchActiveOrders();
  connectSocket();
})();
