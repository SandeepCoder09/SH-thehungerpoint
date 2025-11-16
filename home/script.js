/* script.js - SH The Hunger Point Frontend
   Works with updated backend + live admin dashboard
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE = 10;

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Toast
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return alert(message);

  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);

  setTimeout(() => t.remove(), duration);
}

// Init quantity controls + ping
function init() {
  $$(".menu-item").forEach((item) => {
    const qtyDisplay = item.querySelector(".qty");
    const dec = item.querySelector('[data-action="dec"]');
    const inc = item.querySelector('[data-action="inc"]');
    const orderBtn = item.querySelector(".order-btn");

    let qty = Number(qtyDisplay.textContent || 1);
    qty = isNaN(qty) ? 1 : Math.max(1, qty);
    qtyDisplay.textContent = qty;

    const setQty = (v) => {
      qty = Math.max(1, Math.floor(v));
      qtyDisplay.textContent = qty;
    };

    dec.addEventListener("click", () => setQty(qty - 1));
    inc.addEventListener("click", () => setQty(qty + 1));

    orderBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await handleOrder(item, qty, orderBtn);
    });
  });

  fetch(`${SERVER_URL}/ping`).catch(() => {});
}

function setOrderButtonsDisabled(disabled) {
  $$(".order-btn").forEach((b) => {
    b.disabled = disabled;
    if (!disabled) b.classList.remove("processing");
  });
}

async function handleOrder(itemEl, qty, orderBtn) {
  const name =
    itemEl.dataset.item ||
    itemEl.querySelector("h3")?.textContent ||
    "Item";

  const total = qty * PRICE;

  // UI lock
  setOrderButtonsDisabled(true);
  orderBtn.classList.add("processing");
  const prevText = orderBtn.textContent;
  orderBtn.textContent = "Processing...";

  try {
    const resp = await fetch(`${SERVER_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: total,
        items: [{ name, qty, price: PRICE }],
      }),
    });

    if (!resp.ok) throw new Error("Network error");

    const data = await resp.json();
    if (!data || !data.ok || !data.order) {
      console.error("Order creation failed:", data);
      throw new Error("Order creation failed");
    }

    openRazorpay(data, name, qty, total);
  } catch (err) {
    console.error(err);
    showToast("Server offline or error. Try again.", "error");
    setOrderButtonsDisabled(false);
    orderBtn.classList.remove("processing");
    orderBtn.textContent = prevText;
  }
}

// Razorpay Checkout
function openRazorpay(data, name, qty, total) {
  if (!window.Razorpay) {
    showToast("Razorpay script not loaded.", "error");
    setOrderButtonsDisabled(false);
    return;
  }

  const options = {
    key: data.key_id || data.key || "",
    amount: data.order.amount,
    currency: "INR",
    name: "SH — The Hunger Point",
    description: `${name} × ${qty}`,
    order_id: data.order.id,

    handler: async function (resp) {
      try {
        const verify = await fetch(`${SERVER_URL}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            items: [{ name, qty, price: PRICE }],
            total: total  // IMPORTANT FIX
          }),
        });

        if (!verify.ok) throw new Error("Verify network error");
        const result = await verify.json();

        if (result.ok) {
          document.querySelector(".menu").style.display = "none";
          const status = document.getElementById("order-status");
          status.classList.remove("hidden");

          $("#eta-text").textContent = `Order #${result.orderId} confirmed! ETA: 15 mins 🍴`;

          showToast("Order confirmed! Enjoy your meal 🍽️", "success");
        } else {
          console.error("Verification failed:", result);
          showToast("Payment verification failed.", "error");
          setOrderButtonsDisabled(false);
        }
      } catch (err) {
        console.error(err);
        showToast("Verification failed. Try later.", "error");
        setOrderButtonsDisabled(false);
      } finally {
        $$(".order-btn").forEach((b) => {
          b.classList.remove("processing");
          b.textContent = "Order Now";
        });
      }
    },

    modal: {
      ondismiss: function () {
        setOrderButtonsDisabled(false);
        $$(".order-btn").forEach((b) => {
          b.classList.remove("processing");
          b.textContent = "Order Now";
        });
      },
    },
  };

  new Razorpay(options).open();
}

document.addEventListener("DOMContentLoaded", init);
