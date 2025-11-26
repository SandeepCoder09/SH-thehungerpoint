/* SH The Hunger Point — Orders Page */

const dbRef = firebase.firestore().collection("orders");

/* Get all orders */
async function loadOrders() {
  const snap = await dbRef.orderBy("createdAt", "desc").get();

  const ongoingOrderCard = document.getElementById("ongoingOrder");
  const pastOrdersBox = document.getElementById("pastOrders");

  let ongoing = null;
  let past = [];

  snap.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    if (data.status !== "delivered" && data.status !== "cancelled") {
      if (!ongoing) ongoing = { id, ...data };
    } else {
      past.push({ id, ...data });
    }
  });

  renderOngoing(ongoing);
  renderPast(past);
}

/* Render Ongoing Order */
function renderOngoing(order) {
  const card = document.getElementById("ongoingOrder");

  if (!order) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  document.getElementById("ongoingStatus").textContent =
    order.status === "out_for_delivery"
      ? "Out for Delivery 🚴‍♂️"
      : order.status === "preparing"
      ? "Preparing 🔥"
      : order.status;

  document.getElementById("ongoingETA").textContent = order.eta
    ? `ETA: ${order.eta} min`
    : "";

  document.getElementById("ongoingTotal").textContent = "₹" + order.totalAmount;

  // Items
  const itemsBox = document.getElementById("ongoingItems");
  itemsBox.innerHTML = "";
  order.items.forEach(i => {
    itemsBox.innerHTML += `${i.name} × ${i.qty}<br>`;
  });

  // Track Order Button
  document.getElementById("trackButton").onclick = () => {
    window.location.href = `/orders/track-order.html?orderId=${order.orderId}`;
  };
}

/* Render Past Orders */
function renderPast(list) {
  const box = document.getElementById("pastOrders");
  box.innerHTML = "";

  list.forEach(o => {
    const card = document.createElement("div");
    card.className = "order-card";

    card.innerHTML = `
      <div class="order-row">
        <strong>${o.items.map(i => i.name).join(", ")}</strong>
        <span>₹${o.totalAmount}</span>
      </div>

      <div class="order-time">
        Delivered in ${o.deliveryTime || "N/A"} min
      </div>

      <button class="reorder-btn">Reorder</button>
    `;

    // Reorder button
    card.querySelector(".reorder-btn").onclick = () => {
      localStorage.setItem("reorderItems", JSON.stringify(o.items));
      window.location.href = "/home/index.html";
    };

    box.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", loadOrders);

// --- Create Test Order ---
document.getElementById("createTestOrder").addEventListener("click", async () => {
  const testOrder = {
    status: "out_for_delivery",
    createdAt: new Date(),
    totalAmount: 40,
    items: [
      { name: "Momo", qty: 1, price: 10 },
      { name: "Hot Tea", qty: 1, price: 10 },
      { name: "Bread Pakoda", qty: 1, price: 10 },
      { name: "Finger", qty: 1, price: 10 }
    ],
    userLocation: { lat: 25.140, lng: 82.570 },
    riderLocation: { lat: 25.145, lng: 82.575 },
    eta: 12
  };

  const id = "order_" + Date.now();

  await firebase.firestore().collection("orders").doc(id).set(testOrder);

  alert("Test Order Created ✔ Now refresh Orders Page");
  loadOrders();
});