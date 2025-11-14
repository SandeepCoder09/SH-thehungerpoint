// Replace alerts with beautiful toast messages
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return alert(message);

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/* script.js
   Frontend logic for SH The Hunger Point
   - Sends create-order and verify-payment requests to backend
   - Opens Razorpay checkout
   - Shows simple success/failure UI updates
*/

// CHANGE THIS to your server URL if different
const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

const PRICE = 10; // price per unit (INR)

// helper: show alert-style message (using alert for simplicity)
function showMessage(message) {
  alert(message);
}

// helper: small DOM helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// init quantity controls
function initControls() {
  $$(".menu-item").forEach(item => {
    const qtyDisplay = item.querySelector(".qty");
    const decBtn = item.querySelector('[data-action="dec"]');
    const incBtn = item.querySelector('[data-action="inc"]');
    const orderBtn = item.querySelector(".order-btn");

    let qty = Number(qtyDisplay.textContent || 1);
    qty = isNaN(qty) ? 1 : Math.max(1, qty);
    qtyDisplay.textContent = qty;

    const setQty = (newQty) => {
      qty = Math.max(1, Math.floor(newQty));
      qtyDisplay.textContent = qty;
    };

    decBtn.addEventListener("click", () => setQty(qty - 1));
    incBtn.addEventListener("click", () => setQty(qty + 1));

    orderBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleOrder(item, qty, orderBtn);
    });
  });
}

// disable/enable all order buttons (prevents duplicates)
function setOrderButtonsDisabled(disabled) {
  $$(".order-btn").forEach(b => b.disabled = disabled);
}

// main order flow
async function handleOrder(itemEl, qty, orderBtn) {
  const name = itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
  const total = qty * PRICE;

  // UI: disable order buttons while in progress
  setOrderButtonsDisabled(true);
  orderBtn.textContent = "Processing...";

  try {
    // 1) create order on server
    const createResp = await fetch(`${SERVER_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total })
    });

    if (!createResp.ok) {
      throw new Error("Network response was not ok");
    }

    const createData = await createResp.json();
    if (!createData || !createData.ok || !createData.order) {
      // server returned JSON but order creation failed
      console.error("create-order failed:", createData);
      throw new Error(createData.error || "Order creation failed");
    }

    // 2) open Razorpay checkout
    openRazorpay(createData, name, qty, total);

  } catch (err) {
    console.error("Order flow error:", err);
    showMessage("Server offline or error. Try again.");
    setOrderButtonsDisabled(false);
    orderBtn.textContent = "Order Now";
  }
}

// opens Razorpay checkout with the order returned from backend
function openRazorpay(data, name, qty, total) {
  if (!window.Razorpay) {
    showMessage("Razorpay checkout script not loaded.");
    setOrderButtonsDisabled(false);
    return;
  }

  const options = {
    key: data.key_id || "",                // supplied by backend
    amount: data.order.amount,            // amount in paise (server already sets this)
    currency: "INR",
    name: "SH The Hunger Point",
    description: `${name} × ${qty}`,
    order_id: data.order.id,
    handler: async function (response) {
      // called when payment is completed in checkout
      try {
        // verify payment with backend
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

        if (!verify.ok) throw new Error("Verify network error");
        const verified = await verify.json();

        if (verified.ok) {
          // success: show confirmation UI
          document.querySelector(".menu").style.display = "none";
          const status = document.getElementById("order-status");
          if (status) {
            status.classList.remove("hidden");
            const etaText = document.getElementById("eta-text");
            if (etaText) etaText.textContent = `Order #${verified.orderId} confirmed! ETA: 15 mins 🍴`;
          } else {
            showMessage("Order confirmed! ETA ~15 mins.");
          }
        } else {
          console.error("Payment verification failed:", verified);
          showMessage("Payment verification failed. Contact support.");
          setOrderButtonsDisabled(false);
        }
      } catch (err) {
        console.error("Verify error:", err);
        showMessage("Verification failed or server offline.");
        setOrderButtonsDisabled(false);
      } finally {
        // restore state of buttons (if not hidden)
        $$(".order-btn").forEach(b => b.textContent = "Order Now");
      }
    },
    modal: {
      ondismiss: function() {
        // user closed the checkout window
        setOrderButtonsDisabled(false);
        $$(".order-btn").forEach(b => b.textContent = "Order Now");
      }
    }
  };

  // open checkout
  const rzp = new Razorpay(options);
  rzp.open();
}

// on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initControls();

  // quick offline check: ping server /ping (not required but friendlier)
  fetch(`${SERVER_URL}/ping`, { method: "GET" })
    .then(r => {
      if (!r.ok) throw new Error("ping failed");
      return r.text();
    })
    .then(txt => console.log("Server ping:", txt))
    .catch(err => {
      console.warn("Server ping failed:", err);
      // don't block UI — show only when user tries to order
    });
});