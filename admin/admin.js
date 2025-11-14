// Fetch orders in real time
const ordersContainer = document.getElementById("orders");

function renderOrders(snapshot) {
  ordersContainer.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    const card = document.createElement("div");
    card.className = "order-card";

    // Convert timestamp
    const time = new Date(data.timestamp).toLocaleString();

    card.innerHTML = `
      <h3>Order ID: ${doc.id}</h3>

      <div><strong>Payment ID:</strong> ${data.payment_id}</div>

      <div class="items-list">
        <strong>Items:</strong>
        <ul>
          ${data.items.map(item => `
            <li>${item.name} — Qty: ${item.qty} — ₹${item.price}</li>
          `).join("")}
        </ul>
      </div>

      <div class="timestamp">Placed on: ${time}</div>

      <label><strong>Status:</strong></label>
      <select class="status-select" data-id="${doc.id}">
        <option ${data.status === "paid" ? "selected" : ""}>paid</option>
        <option ${data.status === "preparing" ? "selected" : ""}>preparing</option>
        <option ${data.status === "on the way" ? "selected" : ""}>on the way</option>
        <option ${data.status === "completed" ? "selected" : ""}>completed</option>
      </select>
    `;

    ordersContainer.appendChild(card);
  });

  // Attach status change listeners
  document.querySelectorAll(".status-select").forEach(select => {
    select.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;

      await db.collection("orders").doc(id).update({ status: newStatus });

      alert(`Status updated to ${newStatus}`);
    });
  });
}

// Real-time Firebase listener
db.collection("orders")
  .orderBy("timestamp", "desc")
  .onSnapshot(renderOrders);
