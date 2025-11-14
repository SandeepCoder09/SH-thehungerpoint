// admin.js
// Ensure firebase-config.js exists and initializes `firebase`

// Protect: redirect to login if not authenticated locally
if (localStorage.getItem("sh_admin_auth") !== "1") {
  window.location.href = "login.html";
}

// Firestore
const db = firebase.firestore();

// DOM
const ordersListEl = document.getElementById("ordersList");
const statOrdersEl = document.getElementById("statOrders");
const statSalesEl = document.getElementById("statSales");
const statRecentEl = document.getElementById("statRecent");
const ordersChartCtx = document.getElementById("ordersChart").getContext("2d");
const salesChartCtx = document.getElementById("salesChart").getContext("2d");
const pingAudio = document.getElementById("pingAudio");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const darkToggle = document.getElementById("darkToggle");

let ordersCache = new Map();
let ordersChart, salesChart;
let lastSnapshotIds = new Set();

// Helpers
function formatCurrency(x){ return "₹" + (Number(x)||0); }
function timeAgo(ts){ return ts ? new Date(ts).toLocaleString() : "-" }

// Render single order card
function renderOrderCard(id, data){
  const itemsHtml = (data.items || []).map(i => `<li>${i.name} — x${i.qty} — ₹${i.price}</li>`).join("");
  const total = data.amount ?? ((data.items||[]).reduce((s,it)=>s + (it.qty*it.price),0));
  return `
    <div class="orderItem" data-id="${id}">
      <div class="order-left">
        <div class="order-item-title">Order #${id}</div>
        <div class="order-meta">Payment: ${data.razorpay_payment_id||'—'} • ${timeAgo(data.createdAt)}</div>
        <ul class="items-list">${itemsHtml}</ul>
        <div class="order-meta"><strong>Total:</strong> ${formatCurrency(total)}</div>
      </div>

      <div class="order-right">
        <div><strong>${formatCurrency(total)}</strong></div>
        <div style="margin-top:8px">
          <select class="status-select" data-id="${id}">
            <option value="paid"${data.status==="paid"?" selected":""}>paid</option>
            <option value="preparing"${data.status==="preparing"?" selected":""}>preparing</option>
            <option value="on the way"${data.status==="on the way"?" selected":""}>on the way</option>
            <option value="completed"${data.status==="completed"?" selected":""}>completed</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

// Render list (apply filters/search)
function renderOrdersList(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const statusF = statusFilter.value;
  const arr = Array.from(ordersCache.entries())
    .map(([id,data]) => ({id, ...data}))
    .sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  const filtered = arr.filter(o=>{
    if (statusF && o.status !== statusF) return false;
    if (!q) return true;
    return (o.id && o.id.toLowerCase().includes(q)) ||
           (o.items && o.items.some(it=> (it.name||"").toLowerCase().includes(q)));
  });

  if (!filtered.length){
    ordersListEl.innerHTML = `<div class="emptyMsg">No orders found.</div>`;
    return;
  }

  ordersListEl.innerHTML = filtered.map(o => renderOrderCard(o.id,o)).join("");
  // attach status listeners
  document.querySelectorAll(".status-select").forEach(sel=>{
    sel.addEventListener("change", async (e)=>{
      const id = e.target.dataset.id;
      const newStatus = e.target.value;
      try {
        await db.collection("orders").doc(id).update({ status: newStatus });
      } catch(err){ console.error("Status update:", err); alert("Failed to update status") }
    });
  });
}

// Compute analytics and update stats + charts
function computeAnalytics(){
  const arr = Array.from(ordersCache.values());
  const totalOrders = arr.length;
  const totalSales = arr.reduce((s,o)=> s + (o.amount || (o.items||[]).reduce((ss,it)=> ss + (it.qty*it.price),0)), 0);
  const oneHour = Date.now() - (1000*60*60);
  const recentCount = arr.filter(o => (o.createdAt || 0) >= oneHour).length;

  statOrdersEl.textContent = totalOrders;
  statSalesEl.textContent = formatCurrency(totalSales);
  statRecentEl.textContent = recentCount;

  // Orders per hour (last 24 hours)
  const hours = new Array(24).fill(0);
  const salesPerDay = {};
  for (const o of arr){
    const d = new Date(o.createdAt || Date.now());
    const hr = d.getHours();
    hours[hr] += 1;
    const dayKey = d.toISOString().slice(0,10);
    salesPerDay[dayKey] = (salesPerDay[dayKey] || 0) + (o.amount || (o.items||[]).reduce((ss,it)=> ss + (it.qty*it.price),0));
  }

  // update charts
  const labels = Array.from({length:24}, (_,i)=> `${i}:00`);
  const ordersData = hours;
  updateOrdersChart(labels, ordersData);

  const last7days = Object.keys(salesPerDay).sort().slice(-7);
  const salesData = last7days.map(k=> salesPerDay[k] || 0);
  updateSalesChart(last7days, salesData);
}

// Chart initializations
function initCharts(){
  ordersChart = new Chart(ordersChartCtx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label:'Orders', data:[], backgroundColor: 'rgba(226,55,68,0.9)'}] },
    options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}}}
  });
  salesChart = new Chart(salesChartCtx, {
    type:'line',
    data:{ labels:[], datasets:[{ label:'Sales (₹)', data:[], borderColor:'#e23744', backgroundColor:'rgba(226,55,68,0.08)', tension:0.3 }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}} }
  });
}

function updateOrdersChart(labels,data){
  if (!ordersChart) return;
  ordersChart.data.labels = labels;
  ordersChart.data.datasets[0].data = data;
  ordersChart.update();
}
function updateSalesChart(labels,data){
  if (!salesChart) return;
  salesChart.data.labels = labels;
  salesChart.data.datasets[0].data = data;
  salesChart.update();
}

// Real-time listener for orders collection
function subscribeOrders(){
  db.collection("orders").orderBy("createdAt","desc").onSnapshot(snapshot=>{
    let newIdFound = false;
    snapshot.docChanges().forEach(change=>{
      const id = change.doc.id;
      const data = change.doc.data();
      // ensure numeric timestamp (if Firestore Timestamp)
      if (data.createdAt && data.createdAt.toMillis) data.createdAt = data.createdAt.toMillis();
      if (change.type === "added"){
        if (!ordersCache.has(id)) newIdFound = true;
      }
      if (change.type === "removed"){
        ordersCache.delete(id);
      } else {
        ordersCache.set(id, {...data});
      }
    });

    // Play sound only when a truly new id appears
    const incomingIds = snapshot.docs.map(d=>d.id);
    const newly = incomingIds.filter(i => !lastSnapshotIds.has(i));
    if (newly.length) {
      // mark new ids
      newly.forEach(i=> lastSnapshotIds.add(i));
      // play sound & highlight last one
      pingAudio.play().catch(()=>{});
    }

    renderOrdersList();
    computeAnalytics();
  }, err=>{
    console.error("Orders subscription error:", err);
    ordersListEl.innerHTML = `<div class="emptyMsg">Error loading orders: ${err.message}</div>`;
  });
}

// UI events
searchInput.addEventListener("input", () => renderOrdersList());
statusFilter.addEventListener("change", () => renderOrdersList());
refreshBtn.addEventListener("click", () => { computeAnalytics(); renderOrdersList(); });

// Logout
logoutBtn.addEventListener("click", ()=> {
  localStorage.removeItem("sh_admin_auth");
  window.location.href = "login.html";
});

// Dark mode toggle
darkToggle.addEventListener("change", (e)=>{
  if (e.target.checked) {
    document.body.classList.add("dark");
    localStorage.setItem("sh_admin_dark","1");
  } else {
    document.body.classList.remove("dark");
    localStorage.removeItem("sh_admin_dark");
  }
});

// restore dark
if (localStorage.getItem("sh_admin_dark")==="1"){
  darkToggle.checked = true;
  document.body.classList.add("dark");
}

// Init
initCharts();
subscribeOrders();
computeAnalytics();
