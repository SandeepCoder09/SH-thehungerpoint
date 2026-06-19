const STATUS_STEPS = ["placed", "preparing", "on-the-way", "delivered"];
const STATUS_LABELS = {
  placed: "Placed",
  preparing: "Preparing",
  "on-the-way": "On Way",
  delivered: "Delivered",
};
const STATUS_BADGE = {
  placed: "badge-blue",
  preparing: "badge-orange",
  "on-the-way": "badge-orange",
  delivered: "badge-green",
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return new Date(iso).toLocaleDateString();
}

function stepsHtml(status) {
  const cur = STATUS_STEPS.indexOf(status);
  let html = '<div class="status-steps">';
  STATUS_STEPS.forEach((s, i) => {
    const cls = i < cur ? "done" : i === cur ? "active" : "pending";
    const icon = i < cur ? "✓" : i === cur ? "●" : "";
    html += `<div class="step ${cls}"><div class="step-dot">${icon}</div><div class="step-label">${STATUS_LABELS[s]}</div></div>`;
    if (i < STATUS_STEPS.length - 1) {
      const lineCls = i < cur ? "done" : i === cur ? "active" : "pending";
      html += `<div class="step-line ${lineCls}"></div>`;
    }
  });
  html += "</div>";
  return html;
}

function renderOrders(filter = "all") {
  const list = document.getElementById("ordersList");
  let orders = JSON.parse(localStorage.getItem("sh_orders") || "[]");

  // Demo seed
  if (!orders.length) {
    orders = [
      {
        id: "SH001",
        items: [
          { name: "Momo", emoji: "🥟", price: 10, qty: 2 },
          { name: "Hot Tea", emoji: "🍵", price: 10, qty: 1 },
        ],
        total: 30,
        status: "delivered",
        time: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "SH002",
        items: [{ name: "Combo Plate", emoji: "🍱", price: 40, qty: 1 }],
        total: 40,
        status: "preparing",
        time: new Date(Date.now() - 600000).toISOString(),
      },
    ];
    localStorage.setItem("sh_orders", JSON.stringify(orders));
  }

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);
  document.getElementById("orderCount").textContent =
    filtered.length + " order" + (filtered.length !== 1 ? "s" : "");

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No orders yet</h3><p>Your orders will appear here once you place them.</p><a href="../home/index.html" class="btn btn-red btn-sm" style="margin-top:8px;text-decoration:none">Browse Menu</a></div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (o) => `
    <div class="order-card fade-up">
      <div class="order-head">
        <div>
          <div class="order-id">#${o.id}</div>
          <div class="order-time">${timeAgo(o.time)}</div>
        </div>
        <span class="badge ${STATUS_BADGE[o.status] || "badge-blue"}">${STATUS_LABELS[o.status] || o.status}</span>
      </div>
      ${stepsHtml(o.status)}
      <div class="order-items-list">
        ${o.items.map((i) => `<div class="order-item-row"><span>${i.emoji} ${i.name} ×${i.qty}</span><span>₹${i.price * i.qty}</span></div>`).join("")}
      </div>
      <div class="order-footer">
        <div class="order-total">Total: ₹${o.total}</div>
        <div class="order-actions">
          ${o.status !== "delivered" ? `<button class="order-btn order-btn-track" onclick="window.location.href='../track/index.html?id=${o.id}'">Track</button>` : ""}
          <button class="order-btn order-btn-reorder" onclick="reorder('${o.id}')">Reorder</button>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function filterOrders(filter, btn) {
  document
    .querySelectorAll(".filter-tab")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderOrders(filter);
}

function reorder(id) {
  const orders = JSON.parse(localStorage.getItem("sh_orders") || "[]");
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  let cart = JSON.parse(localStorage.getItem("sh_cart") || "[]");
  o.items.forEach((item) => {
    const ex = cart.find((c) => c.name === item.name);
    if (ex) ex.qty += item.qty;
    else cart.push({ ...item });
  });
  localStorage.setItem("sh_cart", JSON.stringify(cart));
  window.location.href = "../home/index.html";
}

renderOrders();
