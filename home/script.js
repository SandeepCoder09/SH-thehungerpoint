const PRICE = 10;
const SERVER_URL = "https://sh-hunger-server.onrender.com"; // Render backend URL

document.querySelectorAll(".menu-item").forEach(item => {
  const qtyDisplay = item.querySelector(".qty");
  let qty = 1;

  // Increase & decrease quantity
  item.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      qty = btn.dataset.action === "inc" ? qty + 1 : Math.max(1, qty - 1);
      qtyDisplay.textContent = qty;
    });
  });

  // ORDER NOW button
  item.querySelector(".order-btn").addEventListener("click", async () => {
    const name = item.dataset.item;
    const total = qty * PRICE;

    try {
      const res = await fetch(`${SERVER_URL}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          items: [{ name, qty, price: PRICE }]
        })
      });

      const order = await res.json();

      if (!order.id) {
        alert("Order creation failed.");
        return;
      }

      openRazorpay(order, name, qty, total);

    } catch (err) {
      console.error(err);
      alert("Server offline. Try again.");
    }
  });
});


// ⭐ Razorpay Checkout Popup
function openRazorpay(order, name, qty, total) {
  const options = {
    key: "rzp_live_ReGVGeh54mE9R9",       // PUBLIC KEY
    amount: order.amount,
    currency: "INR",
    name: "SH The Hunger Point",
    description: `${name} × ${qty}`,
    order_id: order.id,

    handler: function (response) {
      // UI Update after successful payment
      document.querySelector(".menu").style.display = "none";
      const status = document.getElementById("order-status");
      status.classList.remove("hidden");

      document.getElementById("eta-text").textContent =
        `Order confirmed! Your food will reach in 15 minutes 🍴`;
    }
  };

  new Razorpay(options).open();
}
