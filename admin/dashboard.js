// dashboard.js - regenerated with live popup support

// -----------------------
// FIREBASE INIT
// -----------------------
const db = firebase.firestore();

// DOM elements
const ordersList = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const totalOrdersEl = document.getElementById("totalOrders");
const totalSalesEl = document.getElementById("totalSales");
const recentOrdersEl = document.getElementById("recentOrders");

const sound = document.getElementById("newOrderSound");

let hourChart, weekChart;
let ordersCache = [];

const hourCtx = document.getElementById("hourChart").getContext("2d");
const weekCtx = document.getElementById("weekChart").getContext("2d");

// -----------------------
// LIVE ORDER POPUP
// -----------------------
function showLiveOrderPopup(order) {
  const popup = document.getElementById("liveOrderPopup");
  const idEl = document.getElementById("popupOrderId");
  const itemsEl = document.getElementById("popupOrderItems");

  idEl.textContent = "Order ID: " + order.id;
  itemsEl.textContent = order.items.map(i => `${i.name} × ${i.qty}`).join(", ");

  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 8000);

  document.getElementById("popupClose").onclick = () => {
    popup.classList.remove("show");
  };
}

// -----------------------
// FORMAT HELPERS
// -----------------------
function formatTime(ts) {
  return new Date(ts).toLocaleString();
}

function rupee(v) {
  return "₹" + Number(v).toFixed(0);
}

// -----------------------
// RENDER ORDERS
// -----------------------
function renderOrders() {
  const keyword = searchInput.value.toLowerCase();
  const statusF = statusFilter.value;

  let filtered = ordersCache.filter(o =>
    (!statusF || o.status === statusF) &&
    (o.id.toLowerCase().includes(keyword) ||
      o.items.some(i => i.name.toLowerCase().includes(keyword)))
  );

  if (filtered.length === 0) {
    ordersList.innerHTML = `<p>No orders found...</p>`;
    return;
  }

  ordersList.innerHTML = filtered.map(o => `
    <div class="order-card">
      <div class="left">
        <h3>Order #${o.id}</h3>
        <p>${formatTime(o.createdAt)}</p>
        <ul>
          ${o.items.map(i => `<li>${i.name} × ${i.qty} — ₹${i.price}</li>`).join("")}
        </ul>
        <strong>Total: ${rupee(o.total)}</strong>
      </div>
      <div class="right">
        <select class="status" data-id="${o.id}">
          <option value="paid" ${o.status === "paid" ? "selected" : ""}>Paid</option>
          <option value="preparing" ${o.status === "preparing" ? "selected" : ""}>Preparing</option>
          <option value="on the way" ${o.status === "on the way" ? "selected" : ""}>On the way</option>
          <option value="completed" ${o.status === "completed" ? "selected" : ""}>Completed</option>
        </select>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".status").forEach(sel => {
    sel.onchange = async (e) => {
      let id = e.target.dataset.id;
      let newStatus = e.target.value;
      updateOrderStatus(id, newStatus);
    };
  });
}

// -----------------------
// FIREBASE REALTIME LISTENER (with popup)
// -----------------------
db.collection("orders")
  .orderBy("createdAt", "desc")
  .onSnapshot(snapshot => {
    let previousIds = new Set(ordersCache.map(o => o.id));

    ordersCache = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toMillis?.() || Date.now();
      const items = data.items || [];
      const total = data.total || 0;

      return {
        id: doc.id,
        items,
        total,
        status: data.status || "paid",
        createdAt
      };
    });

    // new order detection
    ordersCache.forEach(order => {
      if (!previousIds.has(order.id)) {
        sound.play().catch(() => {});
        showLiveOrderPopup(order);
      }
    });

    renderOrders();
    updateStats();
    updateCharts();
  });

// -----------------------
// UPDATE STATS
// -----------------------
function updateStats() {
  totalOrdersEl.textContent = ordersCache.length;

  const totalSales = ordersCache.reduce((sum, o) => sum + o.total, 0);
  totalSalesEl.textContent = rupee(totalSales);

  const oneHourAgo = Date.now() - 3600000;
  const recent = ordersCache.filter(o => o.createdAt >= oneHourAgo).length;
  recentOrdersEl.textContent = recent;
}

// -----------------------
// CHARTS
// -----------------------
function updateCharts() {
  // 24h chart
  let hours = Array(24).fill(0);
  ordersCache.forEach(o => {
    let h = new Date(o.createdAt).getHours();
    hours[h]++;
  });

  if (!hourChart) {
    hourChart = new Chart(hourCtx, {
      type: "bar",
      data: {
        labels: Array.from({ length: 24 }, (_, i) => i + ":00"),
        datasets: [{ label: "Orders", backgroundColor: "#e23744", data: hours }]
      }
    });
  } else {
    hourChart.data.datasets[0].data = hours;
    hourChart.update();
  }

  // Week chart
  let days = {};
  ordersCache.forEach(o => {
    let key = new Date(o.createdAt).toISOString().slice(0, 10);
    days[key] = (days[key] || 0) + o.total;
  });

  let labels = Object.keys(days).slice(-7);
  let values = labels.map(k => days[k]);

  if (!weekChart) {
    weekChart = new Chart(weekCtx, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Sales (₹)", borderColor: "#e23744", data: values, tension: 0.4 }]
      }
    });
  } else {
    weekChart.data.labels = labels;
    weekChart.data.datasets[0].data = values;
    weekChart.update();
  }
}

// -----------------------
// UPDATE ORDER STATUS (Admin)
// -----------------------
async function updateOrderStatus(orderId, newStatus) {
  const token = localStorage.getItem("admin_jwt");

  const res = await fetch("https://sh-thehungerpoint.onrender.com/admin/update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ orderId, status: newStatus })
  });

  const data = await res.json();
  if (!data.ok) alert("Failed to update status");
}

// -----------------------
// LOGOUT
// -----------------------
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("admin_jwt");
  window.location.href = "login.html";
});
