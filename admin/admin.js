// ------------------ PUSH NOTIFICATIONS ------------------
(async function () {
  const VAPID_KEY =
    "BL2JfJOy_iHaa_nsMU_aeY3mXO4QtNJrPTs2Qebq-SGgKMjd2uMDJdNZoQgs56_pVNBkILNctiyKIrBOETb8oCk";

  if (!("serviceWorker" in navigator)) {
    console.log("Service Worker not supported");
    return;
  }
  if (!("Notification" in window)) {
    console.log("Notifications not supported");
    return;
  }

  try {
    // Register SW (GitHub Pages correct path)
    const sw = await navigator.serviceWorker.register(
      "/SH-thehungerpoint/firebase-messaging-sw.js"
    );

    console.log("SW registered:", sw);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return;
    }

    const messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (!token) {
      console.warn("FCM token not generated");
      return;
    }

    console.log("Admin FCM Token:", token);

    document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("admin_jwt");
  window.location.href = "login.html";
});

    // Save token for alerts
    await firebase.firestore()
      .collection("adminTokens")
      .doc(token)
      .set({
        token,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    // Foreground notifications (when admin panel is open)
    messaging.onMessage((payload) => {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/SH-thehungerpoint/home/assets-img/icon-192.png"
      });
    });

  } catch (e) {
    console.error("Push Notification Error:", e);
  }
})();

// LOGIN PROTECTION
if (!localStorage.getItem("adminLoggedIn")) {
    window.location.href = "login.html";
}

const db = firebase.firestore();

const ordersList = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const totalOrdersEl = document.getElementById("totalOrders");
const totalSalesEl = document.getElementById("totalSales");
const recentOrdersEl = document.getElementById("recentOrders");

const sound = document.getElementById("newOrderSound");

// CHART CONTEXTS
let hourChart, weekChart;
const hourCtx = document.getElementById("hourChart").getContext("2d");
const weekCtx = document.getElementById("weekChart").getContext("2d");

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("adminLoggedIn");
  window.location.href = "login.html";
});

// Helper: Currency
function ₹(number) {
  return "₹" + Number(number).toFixed(0);
}

// Helper: time ago
function formatTime(ts) {
  return new Date(ts).toLocaleString();
}

let ordersCache = [];

// RENDER ORDERS LIST
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
        <strong>Total: ${₹(o.total)}</strong>
      </div>

      <div class="right">
        <select class="status" data-id="${o.id}">
          <option value="paid" ${o.status=="paid"?"selected":""}>Paid</option>
          <option value="preparing" ${o.status=="preparing"?"selected":""}>Preparing</option>
          <option value="on the way" ${o.status=="on the way"?"selected":""}>On the way</option>
          <option value="completed" ${o.status=="completed"?"selected":""}>Completed</option>
        </select>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".status").forEach(sel => {
    sel.onchange = async (e) => {
      let id = e.target.dataset.id;
      let newStatus = e.target.value;
      await updateOrderStatus(order.id, "completed") // or whatever status
    };
  });
}

// FIREBASE REAL-TIME LISTENER
db.collection("orders")
  .orderBy("createdAt", "desc")
  .onSnapshot(snapshot => {
    
    let newOrders = [];

    ordersCache = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
      const items = data.items || [];
      const total = data.amount || items.reduce((s, it) => s + it.qty * it.price, 0);

      if (!ordersCache.find(o => o.id === doc.id)) {
        sound.play().catch(()=>{});
      }

      return {
        id: doc.id,
        items,
        total,
        status: data.status || "paid",
        createdAt
      };
    });

    renderOrders();
    updateStats();
    updateCharts();
});

// UPDATE TOP STATS
function updateStats() {
  totalOrdersEl.textContent = ordersCache.length;

  const totalSales = ordersCache.reduce((s, o) => s + o.total, 0);
  totalSalesEl.textContent = ₹(totalSales);

  const oneHourAgo = Date.now() - 3600000;
  const recent = ordersCache.filter(o => o.createdAt >= oneHourAgo).length;
  recentOrdersEl.textContent = recent;
}

// CHARTS
function updateCharts() {
  // Hours (24)
  let hours = Array(24).fill(0);
  ordersCache.forEach(o => {
    let h = new Date(o.createdAt).getHours();
    hours[h]++;
  });

  if (!hourChart) {
    hourChart = new Chart(hourCtx, {
      type: "bar",
      data: {
        labels: Array.from({length:24}, (_,i)=>i+":00"),
        datasets: [{
          label: "Orders",
          backgroundColor: "#e23744",
          data: hours
        }]
      }
    });
  } else {
    hourChart.data.datasets[0].data = hours;
    hourChart.update();
  }

  // 7-day sales
  let days = {};
  ordersCache.forEach(o => {
    let key = new Date(o.createdAt).toISOString().slice(0,10);
    days[key] = (days[key] || 0) + o.total;
  });

  let keys = Object.keys(days).slice(-7);
  let values = keys.map(k => days[k]);

  if (!weekChart) {
    weekChart = new Chart(weekCtx, {
      type: "line",
      data: {
        labels: keys,
        datasets: [{
          label: "Sales (₹)",
          borderColor: "#e23744",
          data: values,
          tension: 0.4
        }]
      }
    });
  } else {
    weekChart.data.labels = keys;
    weekChart.data.datasets[0].data = values;
    weekChart.update();
  }
}

// SEARCH + FILTER
searchInput.oninput = renderOrders;
statusFilter.onchange = renderOrders;

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
  if (!data.ok) {
    alert("Failed to update");
  }
}

