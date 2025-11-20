// admin/modern/dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Firebase config file must exist at /firebase-config.js and define window.__FIREBASE_CONFIG
if (!window.__FIREBASE_CONFIG) {
  console.error("Missing firebase config (window.__FIREBASE_CONFIG). Provide /firebase-config.js");
}
const app = initializeApp(window.__FIREBASE_CONFIG);
const db = getFirestore(app);

const ordersList = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const totalOrdersEl = document.getElementById("totalOrders");
const totalSalesEl = document.getElementById("totalSales");
const recentOrdersEl = document.getElementById("recentOrders");
const sound = document.getElementById("newOrderSound");
const popup = document.getElementById("liveOrderPopup");
const popupOrderId = document.getElementById("popupOrderId");
const popupOrderItems = document.getElementById("popupOrderItems");
const popupClose = document.getElementById("popupClose");

let ordersCache = [];
let hourChart = null, weekChart = null;
const hourCtx = document.getElementById("hourChart").getContext("2d");
const weekCtx = document.getElementById("weekChart").getContext("2d");

function formatTime(ts) { return new Date(ts).toLocaleString(); }
function ₹(n) { return "₹" + Number(n).toFixed(0); }

function showLiveOrderPopup(order) {
  popupOrderId.textContent = `Order ID: ${order.id}`;
  popupOrderItems.textContent = order.items.map(i => `${i.name} × ${i.qty}`).join(", ");
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 8000);
}
popupClose.addEventListener("click", () => popup.classList.remove("show"));

function renderOrders() {
  const keyword = (searchInput.value || "").toLowerCase();
  const statusVal = statusFilter.value;
  const filtered = ordersCache.filter(o => {
    if (statusVal && o.status !== statusVal) return false;
    if (!keyword) return true;
    if (o.id.toLowerCase().includes(keyword)) return true;
    return o.items.some(i => (i.name || "").toLowerCase().includes(keyword));
  });

  if (filtered.length === 0) { ordersList.innerHTML = "<p>No orders</p>"; return; }

  ordersList.innerHTML = filtered.map(o => {
    return `<div class="order-card">
      <div class="left">
        <h3>Order #${o.id}</h3>
        <p>${formatTime(o.createdAt)}</p>
        <ul>${o.items.map(it => `<li>${it.name} × ${it.qty} — ₹${it.price || it.amount || 0}</li>`).join("")}</ul>
        <strong>Total: ${₹(o.total)}</strong>
      </div>
      <div class="right">
        <select class="status" data-id="${o.id}">
          <option value="paid" ${o.status==="paid"?"selected":""}>Paid</option>
          <option value="preparing" ${o.status==="preparing"?"selected":""}>Preparing</option>
          <option value="on the way" ${o.status==="on the way"?"selected":""}>On the way</option>
          <option value="completed" ${o.status==="completed"?"selected":""}>Completed</option>
        </select>
      </div>
    </div>`;
  }).join("");

  document.querySelectorAll(".status").forEach(sel => {
    sel.onchange = async (e) => {
      const token = localStorage.getItem("admin_jwt");
      const orderId = e.target.dataset.id, status = e.target.value;
      try {
        const r = await fetch("https://sh-thehungerpoint.onrender.com/admin/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ orderId, status })
        });
        const j = await r.json();
        if (!j.ok) alert("Update failed");
      } catch (err) { alert("Network error"); }
    };
  });
}

function updateStats() {
  totalOrdersEl.textContent = ordersCache.length;
  totalSalesEl.textContent = ₹(ordersCache.reduce((s,o)=>s+o.total,0));
  const oneHourAgo = Date.now() - 3600000;
  recentOrdersEl.textContent = ordersCache.filter(o=>o.createdAt >= oneHourAgo).length;
}

function updateCharts() {
  // 24 hour
  const hours = Array(24).fill(0);
  ordersCache.forEach(o => hours[new Date(o.createdAt).getHours()]++);
  if (!hourChart) {
    hourChart = new Chart(hourCtx, { type: "bar", data: { labels: Array.from({length:24},(_,i)=>i+":00"), datasets:[{label:"Orders", data:hours, backgroundColor:"#e23744"}] }});
  } else { hourChart.data.datasets[0].data = hours; hourChart.update(); }

  // weekly sales
  const days = {};
  ordersCache.forEach(o => {
    const k = new Date(o.createdAt).toISOString().slice(0,10);
    days[k] = (days[k] || 0) + o.total;
  });
  const labels = Object.keys(days).slice(-7);
  const values = labels.map(d => days[d] || 0);
  if (!weekChart) {
    weekChart = new Chart(weekCtx, { type: "line", data: { labels, datasets:[{label:"Sales (₹)", data:values, borderColor:"#e23744", tension:0.4}] }});
  } else { weekChart.data.labels = labels; weekChart.data.datasets[0].data = values; weekChart.update(); }
}

// real-time listener
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, snapshot => {
  const oldIds = new Set(ordersCache.map(o=>o.id));
  ordersCache = snapshot.docs.map(doc => {
    const d = doc.data();
    const createdAt = d.createdAt?.toMillis?.() || (d.createdAt && d.createdAt.seconds ? d.createdAt.seconds*1000 : Date.now());
    const items = d.items || [];
    const total = Number(d.total || d.amount || items.reduce((s,it)=>s + (Number(it.price||it.amount||0) * Number(it.qty||1)),0));
    return { id: doc.id, items, total, status: d.status || "paid", createdAt };
  }).sort((a,b)=>b.createdAt - a.createdAt);

  // play sound + popup for new orders
  ordersCache.forEach(o => { if (!oldIds.has(o.id)) { sound.play().catch(()=>{}); showLiveOrderPopup(o); }});

  renderOrders();
  updateStats();
  updateCharts();
});

// UI listeners
searchInput.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);

document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.removeItem("admin_jwt"); window.location.href = "/admin/modern/login.html"; });
