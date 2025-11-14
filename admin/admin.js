// admin/admin.js

// simple protection — redirect to login if not authenticated locally
if (localStorage.getItem("sh_admin_auth") !== "1") {
  window.location.href = "login.html";
}

const db = firebase.firestore();
const ordersList = document.getElementById("ordersList");
const logoutBtn = document.getElementById("logoutBtn");

// helper to render single order
function renderOrder(docData) {
  // assume docData contains: orderId, items (array), amount, createdAt, status
  const created = docData.createdAt ? new Date(docData.createdAt) : new Date();
  const items = Array.isArray(docData.items) ? docData.items : [];
  const first = items[0] || {};
  return `
    <div class="orderBox">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div><strong>Order #${docData.orderId || docData.id || '—'}</strong></div>
          <small class="muted">${created.toLocaleString()}</small>
        </div>
        <div style="text-align:right">
          <div><strong>₹${docData.amount ?? 0}</strong></div>
          <small class="muted">${docData.status ?? 'pending'}</small>
        </div>
      </div>

      <div style="margin-top:10px" class="orderRow">
        <div><b>Item:</b> ${first.name ?? '—'}</div>
        <div><b>Qty:</b> ${first.qty ?? '—'}</div>
        <div><b>Price:</b> ₹${first.price ?? '—'}</div>
      </div>
    </div>
  `;
}

// realtime listener — orders collection
db.collection("orders")
  .orderBy("createdAt", "desc")
  .onSnapshot(snap => {
    if (snap.empty) {
      ordersList.innerHTML = "<div class='orderBox'>No orders yet.</div>";
      return;
    }
    ordersList.innerHTML = "";
    snap.forEach(d => {
      ordersList.innerHTML += renderOrder(d.data());
    });
  }, err => {
    ordersList.innerHTML = `<div class="orderBox">Error loading orders: ${err.message}</div>`;
  });

// logout
logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("sh_admin_auth");
  window.location.href = "login.html";
});
