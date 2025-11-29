// admin/admin.js (module)
// Merged original admin logic + auth guard + token headers

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE.replace(/^http/, "ws");

// local fallback rider image
const RIDER_IMG = "/mnt/data/Screenshot 2025-11-25 at 8.55.53 PM.png";

// DOM
const ordersListEl = document.getElementById("ordersList");
const orderDetailsEl = document.getElementById("orderDetails");
const sockStatusEl = document.getElementById("sockStatus");
const cardActive = document.getElementById("cardActive");
const cardDelivered = document.getElementById("cardDelivered");
const btnRefresh = document.getElementById("btnRefresh");
const btnShowMap = document.getElementById("btnShowMap");
const btnTestOrder = document.getElementById("btnTestOrder");
const btnLogout = document.getElementById("btnLogout");

// state
const orders = {}; // orderId -> order object
let socket;

// util
function authHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: "Bearer " + token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - (ts)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
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
    statusEl.textContent = (o.status || "unknown").toUpperCase();

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

// fetch active orders (with auth header)
async function fetchActiveOrders() {
  try {
    const res = await fetch(API_BASE + "/admin/active-orders", {
      headers: authHeaders()
    });
    if (!res.ok) {
      console.warn("active-orders API returned", res.status);
      if (res.status === 401) { handleUnauthorized(); }
      return;
    }
    const list = await res.json();
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
    if (!p || !p.orderId) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.riderId = p.riderId || o.riderId;
    o.riderLoc = { lat: p.lat, lng: p.lng };
    o.updatedAt = p.timestamp || Date.now();
    renderOrdersList();
  });

  socket.on("order:location", (p) => {
    if (!p) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.customerLoc = { lat: p.lat, lng: p.lng };
    o.updatedAt = p.timestamp || Date.now();
    renderOrdersList();
  });

  socket.on("order:status", (p) => {
    if (!p) return;
    const o = orders[p.orderId] = orders[p.orderId] || { orderId: p.orderId };
    o.status = p.status;
    o.updatedAt = Date.now();
    renderOrdersList();
  });
}

// handle unauthorized
function handleUnauthorized() {
  // token invalid/expired: clear and goto login
  localStorage.removeItem("adminToken");
  alert("Session expired. Redirecting to login.");
  window.location.href = "/admin/login.html";
}

/* ------------------------------------------
   ADMIN PANEL — CREATE TEST ORDER
   (calls server route with auth header)
------------------------------------------ */
async function createTestOrder() {
  try {
    if (!btnTestOrder) return;
    btnTestOrder.disabled = true;
    btnTestOrder.textContent = "Creating...";

    const res = await fetch(API_BASE + "/create-test-order", {
      method: "POST",
      headers: authHeaders()
    });

    const data = await res.json();
    if (!res.ok || data.ok === false) {
      alert("Failed to create test order: " + (data.error || res.status));
      if (res.status === 401) handleUnauthorized();
      btnTestOrder.disabled = false;
      btnTestOrder.textContent = "➕ Create Test Order";
      return;
    }

    const orderId = data.orderId;
    alert("Test Order Created!\nOrder ID: " + orderId);

    orders[orderId] = {
      orderId,
      status: "preparing",
      customerName: "Test User",
      updatedAt: Date.now()
    };
    renderOrdersList();

    btnTestOrder.disabled = false;
    btnTestOrder.textContent = "➕ Create Test Order";
  } catch (err) {
    console.error("Test order error:", err);
    alert("Error creating test order");
    btnTestOrder.disabled = false;
    btnTestOrder.textContent = "➕ Create Test Order";
  }
}

// =============================================================
// SH — Sort Orders New → Old by Time
// Automatically re-sorts whenever orders update
// =============================================================

function sortOrdersByTime() {
  const list = document.getElementById("ordersList");
  if (!list) return;

  // Convert NodeList to array
  const rows = Array.from(list.querySelectorAll(".order-row"));

  rows.sort((a, b) => {
    const ta = new Date(a.dataset.time).getTime();   // stored order time
    const tb = new Date(b.dataset.time).getTime();

    // NEW → OLD (latest first)
    return tb - ta;
  });

  // Re-append rows in sorted order
  rows.forEach(row => list.appendChild(row));
}

// -------------------------------------------------------------
// Call this function whenever orders load or update
// -------------------------------------------------------------
document.addEventListener("orders-updated", sortOrdersByTime);

// Optional: Auto-sort every 2 seconds (in case live updates push items)
setInterval(sortOrdersByTime, 2000);

// attach event
btnTestOrder?.addEventListener("click", createTestOrder);

/* ------------------------------------------
   LOGOUT
------------------------------------------ */
btnLogout?.addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
});

/* ------------------------------------------
   UI BUTTONS
------------------------------------------ */
btnRefresh?.addEventListener("click", () => fetchActiveOrders());
btnShowMap?.addEventListener("click", () => window.open("/admin/track-rider.html", "_blank"));

/* ------------------------------------------
   VERIFY TOKEN (on init) -> then start
------------------------------------------ */
async function verifyTokenAndStart() {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/admin/verify", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      handleUnauthorized();
      return;
    }

    // token valid: start
    renderOrdersList();
    await fetchActiveOrders();
    connectSocket();
  } catch (err) {
    console.error("verify token error", err);
    handleUnauthorized();
  }
}

/* -----------------------------
   INIT
----------------------------- */
verifyTokenAndStart();