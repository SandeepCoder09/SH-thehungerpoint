/* script.js - frontend logic for SH The Hunger Point
   Preserves your existing Razorpay + backend flow.
   Adds cart management: add items, update qty, checkout.
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10; // fallback price

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Toast helper (keeps your old style)
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return alert(message);
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* -------------------------
   CART STATE
   ------------------------- */
let cart = []; // { id, name, price, qty }

function findCartIndex(id) {
  return cart.findIndex(c => c.id === id);
}

function updateCartCount() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartCount").textContent = count;
}

function updateCartUI() {
  const container = $("#cartItems");
  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateCartCount();
    return;
  }

  cart.forEach(item => {
    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
      <div class="meta">
        <div><strong>${item.name}</strong></div>
        <div>₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="decrease" data-id="${item.id}">−</button>
        <span>${item.qty}</span>
        <button class="increase" data-id="${item.id}">+</button>
        <button class="remove" data-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  // attach handlers
  container.querySelectorAll(".decrease").forEach(b => b.onclick = (e) => {
    const id = e.target.dataset.id;
    const idx = findCartIndex(id);
    if (idx >= 0) {
      cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      updateCartUI();
    }
  });
  container.querySelectorAll(".increase").forEach(b => b.onclick = (e) => {
    const id = e.target.dataset.id;
    const idx = findCartIndex(id);
    if (idx >= 0) {
      cart[idx].qty += 1;
      updateCartUI();
    }
  });
  container.querySelectorAll(".remove").forEach(b => b.onclick = (e) => {
    const id = e.target.dataset.id;
    cart = cart.filter(c => c.id !== id);
    updateCartUI();
  });
}

/* -------------------------
   UI: cart toggle + events
   ------------------------- */
function openCart() {
  const d = $("#cartDrawer");
  d.classList.remove("hidden");
  d.setAttribute("aria-hidden", "false");
  updateCartUI();
}
function closeCart() {
  const d = $("#cartDrawer");
  d.classList.add("hidden");
  d.setAttribute("aria-hidden", "true");
}
$("#cartToggle").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#clearCart").addEventListener("click", () => { cart = []; updateCartUI(); closeCart(); });

/* -------------------------
   Page tabs
   ------------------------- */
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $$(".page").forEach(p => p.classList.add("hidden"));
    const el = document.getElementById(tab);
    if (el) el.classList.remove("hidden");
  });
});

/* -------------------------
   Menu controls: qty + add
   ------------------------- */
$$(".menu-item").forEach((itemEl, idx) => {
  const qtyDisplay = itemEl.querySelector(".qty");
  const dec = itemEl.querySelector('[data-action="dec"]');
  const inc = itemEl.querySelector('[data-action="inc"]');
  const addBtn = itemEl.querySelector(".add-cart-btn");
  let qty = Number(qtyDisplay.textContent || 1);
  qty = isNaN(qty) ? 1 : Math.max(1, qty);
  qtyDisplay.textContent = qty;

  const setQty = (v) => {
    qty = Math.max(1, Math.floor(v));
    qtyDisplay.textContent = qty;
  };

  dec.addEventListener("click", () => setQty(qty - 1));
  inc.addEventListener("click", () => setQty(qty + 1));

  addBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const name = itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = `${name.replace(/\s+/g, "-").toLowerCase()}`;

    const idx = findCartIndex(id);
    if (idx >= 0) {
      cart[idx].qty += qty;
    } else {
      cart.push({ id, name, price, qty });
    }

    showToast(`${qty} × ${name} added to cart`, "success", 2200);
    updateCartUI();
  });
});

/* -------------------------
   Checkout flow (Razorpay) — uses your existing backend routes
   ------------------------- */

function setOrderButtonsDisabled(disabled) {
  $$(".add-cart-btn").forEach(b => { b.disabled = disabled; if(!disabled) b.classList.remove("processing"); });
}

async function createOrderOnServer(items, amount) {
  // same endpoint as before: /create-order
  const resp = await fetch(`${SERVER_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, items })
  });

  if (!resp.ok) throw new Error("Network error");
  const data = await resp.json();
  if (!data || !data.ok || !data.order) throw new Error(data?.error || "Order creation failed");
  return data;
}

function openRazorpay(data, items, amount) {
  if (!window.Razorpay) {
    showToast("Razorpay script not loaded.", "error");
    return;
  }

  const options = {
    key: data.key_id || data.key || "",
    amount: data.order.amount,
    currency: "INR",
    name: "SH — The Hunger Point",
    description: items.map(i => `${i.name}×${i.qty}`).join(", "),
    order_id: data.order.id,
    handler: async function (resp) {
      // verify with backend
      try {
        const verify = await fetch(`${SERVER_URL}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            items
          })
        });

        if (!verify.ok) throw new Error("Verify network error");
        const result = await verify.json();

        if (result.ok) {
          // Clear cart and show success UI
          cart = [];
          updateCartUI();
          closeCart();
          document.querySelector(".menu").style.display = "none"; // hide menu on success
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
        $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
      }
    },
    modal: {
      ondismiss: function () {
        // user closed checkout
        setOrderButtonsDisabled(false);
        $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* Checkout button */
$("#checkoutBtn").addEventListener("click", async () => {
  if (cart.length === 0) {
    showToast("Cart is empty", "info");
    return;
  }

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  // UI lock
  setOrderButtonsDisabled(true);
  $$(".add-cart-btn").forEach(b => { b.classList.add("processing"); b.textContent = "Processing..."; });

  try {
    const data = await createOrderOnServer(items, total);
    openRazorpay(data, items, total);
  } catch (err) {
    console.error(err);
    showToast("Server offline or error. Try again.", "error");
    setOrderButtonsDisabled(false);
    $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
  }
});

/* Quick ping to keep backend awake (optional) */
fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));

/* Init small UI defaults */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  updateCartUI();
});