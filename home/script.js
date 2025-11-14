const PRICE = 10;
const SERVER_URL = "https://sh-hunger-server.onrender.com";

document.querySelectorAll(".menu-item").forEach(item => {
  const qtyDisplay = item.querySelector(".qty");
  let qty = 1;
  item.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      qty = btn.dataset.action === "inc" ? qty + 1 : Math.max(1, qty - 1);
      qtyDisplay.textContent = qty;
    });
  });

  item.querySelector(".order-btn").addEventListener("click", async () => {
    const name = item.dataset.item;
    const total = qty * PRICE;
    const res = await fetch(`${SERVER_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total })
    });
    const data = await res.json();
    if (data.ok) openRazorpay(data, name, qty, total);
  });
});

function openRazorpay(data, name, qty, total) {
  const options = {
    key: data.key_id,
    amount: data.order.amount,
    currency: "INR",
    name: "SH The Hunger Point",
    description: `${name} × ${qty}`,
    order_id: data.order.id,
    handler: async function (response) {
      const verify = await fetch(`${SERVER_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          items: [{ name, qty, price: PRICE }]
        })
      });
      const verified = await verify.json();
      if (verified.ok) {
        document.querySelector(".menu").style.display = "none";
        const status = document.getElementById("order-status");
        status.classList.remove("hidden");
        document.getElementById("eta-text").textContent = `Order #${verified.orderId} confirmed! ETA: 15 mins 🍴`;
      }
    }
  };
  new Razorpay(options).open();
}
