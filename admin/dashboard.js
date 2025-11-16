// dashboard.js — Clean modern admin panel logic (fresh, fixed)
// - Uses Firestore real-time listener
// - Plays sound only for newly arrived orders
// - Correctly handles status updates (uses orderId)
// - Updates charts and stats efficiently
// - Robust error handling and JWT usage for protected endpoints

const db = firebase.firestore();

// DOM refs (defensive)
const ordersList = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const totalOrdersEl = document.getElementById("totalOrders");
const totalSalesEl = document.getElementById("totalSales");
const recentOrdersEl = document.getElementById("recentOrders");
const sound = document.getElementById("newOrderSound");

let ordersCache = [];
let knownOrderIds = new Set(); // to detect newly added orders
let hourChart = null;
let weekChart = null;

function formatCurrency(n) {
  return "₹" + Number(n || 0).toFixed(0);
}

function formatTime(ts) {
  return new Date(ts).toLocaleString();
}

// Render orders based on search & filter
function renderOrders() {
  if (!ordersList) return;
  const keyword = (searchInput?.value || "").toLowerCase();
  const statusF = statusFilter?.value || "";

  const filtered = ordersCache.filter(o => {
    const matchesStatus = !statusF || o.status === statusF;
    const matchesKeyword = !keyword || o.id.toLowerCase().includes(keyword) || o.items.some(i => (i.name || "").toLowerCase().includes(keyword));
    return matchesStatus && matchesKeyword;
  });

  if (filtered.length === 0) {
    ordersList.innerHTML = `<p class=\"emptyMsg\">No orders found…</p>`;
    return;
  }

  ordersList.innerHTML = filtered.map(o => {
    const itemsHtml = (o.items || []).map(i => `<li>${i.name} × ${i.qty} — ${formatCurrency(i.price)}</li>`).join("");
    return `
      <div class=\"order-card\"> 
        <div class=\"left\"> 
          <h3>Order #${o.id}</h3>
          <p class=\"meta\">${formatTime(o.createdAt)}</p>
          <ul class=\"items-list\">${itemsHtml}</ul>
          <strong>Total: ${formatCurrency(o.total)}</strong>
        </div>
        <div class=\"right\"> 
          <select class=\"status\" data-id=\"${o.id}\"> 
            <option value=\"paid\" ${o.status==="paid"?"selected":""}>Paid</option>
            <option value=\"preparing\" ${o.status==="preparing"?"selected":""}>Preparing</option>
            <option value=\"on the way\" ${o.status==="on the way"?"selected":""}>On the way</option>
            <option value=\"completed\" ${o.status==="completed"?"selected":""}>Completed</option>
          </select>
        </div>
      </div>
    `;
  }).join("");

  // attach change listeners
  document.querySelectorAll(".status").forEach(sel => {
    sel.onchange = async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;
      await updateOrderStatus(id, newStatus);
    };
  });
}

// Update order status (call backend)
async function updateOrderStatus(orderId, newStatus) {
  try {
    const token = localStorage.getItem("admin_jwt");
    if (!token) throw new Error("Not authenticated");

    const res = await fetch("https://sh-thehungerpoint.onrender.com/admin/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ orderId, status: newStatus })
    });

    const data = await res.json();
    if (!data.ok) {
      alert(data.error || "Failed to update");
      // revert UI: reload orders from cache
      renderOrders();
    }
  } catch (err) {
    console.error("updateOrderStatus:", err);
    alert("Unable to update order status. Try again.");
    renderOrders();
  }
}

// Firestore listener — keeps ordersCache updated
function startRealtimeListener() {
  if (!db) return console.error("Firestore not initialized");

  db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    const updated = [];
    let playSound = false;

    snapshot.forEach(doc => {
      const d = doc.data();
      const createdAt = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
      const items = d.items || [];
      const total = d.amount || items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);

      updated.push({
        id: doc.id,
        items,
        total,
        status: d.status || "paid",
        createdAt
      });

      if (!knownOrderIds.has(doc.id)) {
        playSound = true;
      }
    });

    // update known ids set
    knownOrderIds = new Set(updated.map(o => o.id));

    ordersCache = updated;

    if (playSound) {
      sound?.play().catch(()=>{});
    }

    renderOrders();
    updateStats();
    updateCharts();
  }, err => {
    console.error("Orders listener error:", err);
  });
}

// Stats
function updateStats() {
  totalOrdersEl && (totalOrdersEl.textContent = ordersCache.length);
  const total = ordersCache.reduce((s, o) => s + Number(o.total || 0), 0);
  totalSalesEl && (totalSalesEl.textContent = formatCurrency(total));
  const oneHourAgo = Date.now() - 3600000;
  recentOrdersEl && (recentOrdersEl.textContent = ordersCache.filter(o => o.createdAt >= oneHourAgo).length);
}

// Charts
function updateCharts() {
  updateHourChart();
  updateWeekChart();
}

function updateHourChart() {
  const hours = Array(24).fill(0);
  ordersCache.forEach(o => { const h = new Date(o.createdAt).getHours(); hours[h]++; });

  const labels = Array.from({length:24}, (_,i)=>i+":00");
  if (!hourChart) {
    const ctx = document.getElementById("hourChart");
    if (!ctx) return;
    hourChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Orders', data: hours, backgroundColor: '#e23744' }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } else {
    hourChart.data.datasets[0].data = hours;
    hourChart.update();
  }
}

function updateWeekChart() {
  const map = {};
  ordersCache.forEach(o => {
    const k = new Date(o.createdAt).toISOString().slice(0,10);
    map[k] = (map[k] || 0) + Number(o.total || 0);
  });
  const keys = Object.keys(map).slice(-7);
  const values = keys.map(k => map[k]);

  const ctx = document.getElementById("weekChart");
  if (!ctx) return;

  if (!weekChart) {
    weekChart = new Chart(ctx, {
      type: 'line',
      data: { labels: keys, datasets: [{ label: 'Sales (₹)', data: values, borderColor: '#e23744', tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } else {
    weekChart.data.labels = keys;
    weekChart.data.datasets[0].data = values;
    weekChart.update();
  }
}

// Search & filter
searchInput && (searchInput.oninput = renderOrders);
statusFilter && (statusFilter.onchange = renderOrders);

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn && (logoutBtn.onclick = () => { localStorage.removeItem("admin_jwt"); window.location.href = "login.html"; });

// Start
startRealtimeListener();

// LOGOUT BUTTON
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("admin_jwt");   // remove token
    window.location.href = "login.html";     // go to admin/login.html
  });
}
