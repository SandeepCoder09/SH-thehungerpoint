/* ----------------------------
   Firebase Init
----------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const ordersList = document.getElementById("ordersList");
const testBtn = document.getElementById("createTestOrder");

// ---------------------------------------
// Load Orders
// ---------------------------------------
async function loadOrders() {
  ordersList.innerHTML = `<p class="loading">Loading orders…</p>`;

  const snap = await db.collection("orders")
    .orderBy("createdAt", "desc")
    .get();

  if (snap.empty) {
    ordersList.innerHTML = `<p style="opacity:0.6">No orders yet</p>`;
    return;
  }

  ordersList.innerHTML = "";

  snap.forEach(doc => {
    const o = doc.data();
    const id = doc.id;

    let statusClass =
      o.status === "preparing" ? "st-preparing" :
      o.status === "out" ? "st-out" :
      "st-delivered";

    const itemsText = o.items.map(i => `${i.qty} × ${i.name}`).join(", ");

    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-row-1">
        <span>Order #${id.slice(0,6)}</span>
        <span class="order-status ${statusClass}">${o.status}</span>
      </div>

      <div class="order-items">${itemsText}</div>

      <button class="track-btn" data-id="${id}">
        Track Order
      </button>
    `;

    ordersList.appendChild(card);
  });

  document.querySelectorAll(".track-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      window.location.href = `track-order.html?orderId=${id}`;
    });
  });
}

loadOrders();

// ---------------------------------------
// Create Test Order
// ---------------------------------------
testBtn.addEventListener("click", async () => {
  const id = "test_" + Date.now();

  await db.collection("orders").doc(id).set({
    items: [
      { name: "Momo", qty: 1, price: 10 },
      { name: "Hot Tea", qty: 1, price: 10 }
    ],
    total: 20,
    status: "out",
    createdAt: firebase.firestore.Timestamp.now()
  });

  alert("Test order created!");
  loadOrders();
});