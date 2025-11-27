/* =======================================================
   SH — ORDERS PAGE (FINAL)
======================================================= */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

/* INIT FIREBASE */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* DOM */
const ordersList = document.getElementById("ordersList");
const emptyState = document.getElementById("emptyState");
const testBtn = document.getElementById("createTestOrder");

/* LOAD ORDERS */
async function loadOrders() {
  try {
    const snap = await db
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    ordersList.innerHTML = "";

    if (snap.empty) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    snap.forEach((doc) => {
      const o = doc.data();
      const id = doc.id;

      const itemCount = o.items?.reduce((s, i) => s + i.qty, 0) || 0;
      const status = o.status || "preparing";
      const price = o.totalAmount || 0;

      const card = document.createElement("div");
      card.className = "order-card";
      card.dataset.id = id;

      card.innerHTML = `
        <div class="order-row">
          <div>
            <div class="order-id">#${id.slice(0, 6)}</div>
            <div class="order-items">${itemCount} items • ₹${price}</div>
          </div>

          <div class="order-right">
            <span class="order-status ${status}">
              ${status}
            </span>
            <span class="order-arrow">›</span>
          </div>
        </div>

        <div class="order-time">
          ${o.createdAt?.toDate().toLocaleString()}
        </div>
      `;

      card.addEventListener("click", () => {
        window.location.href = `/track/track-order.html?orderId=${id}`;
      });

      ordersList.appendChild(card);
    });
  } catch (err) {
    console.error("Load Orders Error:", err);
  }
}

/* CREATE TEST ORDER */
testBtn?.addEventListener("click", async () => {
  try {
    testBtn.disabled = true;
    testBtn.textContent = "Creating...";

    const res = await fetch(`${SERVER_URL}/create-test-order`, {
      method: "POST"
    });

    const data = await res.json();

    if (!data.ok) {
      alert("Failed: " + data.error);
    } else {
      alert("Test Order Created: " + data.orderId);
      loadOrders();
    }

  } catch (err) {
    alert("Server Error: " + err.message);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Create Test Order";
  }
});

/* REFRESH EVERY 10s */
setInterval(loadOrders, 10000);
loadOrders();