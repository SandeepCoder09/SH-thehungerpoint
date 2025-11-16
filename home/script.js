/* /home/script.js
   Option A (wide boxes). Preserves existing server + Razorpay flow.
   - Cart modal centered
   - Qty buttons fixed and identical style
   - Tabs, add-to-cart, checkout preserved
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; // keep your backend
const PRICE_DEFAULT = 10; // fallback price

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Toast helper
function showToast(message, duration = 2500) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log("toast:", message);
    return;
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ---------------------------
   CART state & helpers
   --------------------------- */
let cart = []; // { id, name, price, qty }

function findCartIndex(id) {
  return cart.findIndex(c => c.id === id);
}

function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
      <div class="meta">
        <div><strong>${item.name}</strong></div>
        <div>₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="cart-dec" data-id="${item.id}">−</button>
        <span>${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  // attach handlers
  container.querySelectorAll(".cart-dec").forEach(b => b.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const idx = findCartIndex(id);
    if (idx >= 0) {
      cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      renderCart();
    }
  }));

  container.querySelectorAll(".cart-inc").forEach(b => b.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const idx = findCartIndex(id);
    if (idx >= 0) {
      cart[idx].qty += 1;
      renderCart();
    }
  }));

  container.querySelectorAll(".cart-remove").forEach(b => b.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    cart = cart.filter(c => c.id !== id);
    renderCart();
  }));
}

/* ---------------------------
   Cart modal open/close
   --------------------------- */
const overlay = $("#cartOverlay");
const modal = $("#cartModal");

function openCart() {
  if (overlay) overlay.classList.remove("hidden");
  if (modal) modal.classList.remove("hidden");
  renderCart();
}
function closeCart() {
  if (overlay) overlay.classList.add("hidden");
  if (modal) modal.classList.add("hidden");
}

$("#cartToggle")?.addEventListener("click", openCart);
$("#closeCart")?.addEventListener("click", closeCart);
overlay?.addEventListener("click", closeCart);

// Clear cart
$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
  closeCart();
});

/* ---------------------------
   Tabs
   --------------------------- */
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

/* ---------------------------
   Menu qty & add button (preserve your old code)
   --------------------------- */
$$(".menu-item").forEach(itemEl => {
  const qtyEl = itemEl.querySelector(".qty");
  const dec = itemEl.querySelector(".qty-btn.minus");
  const inc = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  let qty = Number(qtyEl?.textContent) || 1;
  if (qtyEl) qtyEl.textContent = qty;

  const setQty = v => {
    qty = Math.max(1, Math.floor(v));
    if (qtyEl) qtyEl.textContent = qty;
  };

  dec?.addEventListener("click", () => setQty(qty - 1));
  inc?.addEventListener("click", () => setQty(qty + 1));

  addBtn?.addEventListener("click", () => {
    const name = itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = (name || "").toLowerCase().replace(/\s+/g, "-");

    const idx = findCartIndex(id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added to cart`);
    renderCart();
  });
});

/* ---------------------------
   Checkout flow (Razorpay) — preserved
   --------------------------- */

function setOrderButtonsDisabled(disabled) {
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    if (!disabled) b.classList.remove("processing");
  });
}

async function createOrderOnServer(items, amount) {
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

function openRazorpay(data, items) {
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
          // success UI — preserve your behavior
          cart = [];
          renderCart();
          closeCart();
          document.querySelectorAll(".menu").forEach(m => m.style.display = "none");
          const status = document.getElementById("order-status");
          status.classList.remove("hidden");
          document.getElementById("eta-text").textContent = `Order #${result.orderId} confirmed! ETA: 15 mins 🍴`;
          showToast("Order confirmed! Enjoy your meal 🍽️");
        } else {
          console.error("Verification failed:", result);
          showToast("Payment verification failed.");
          setOrderButtonsDisabled(false);
        }
      } catch (err) {
        console.error(err);
        showToast("Verification failed. Try later.");
        setOrderButtonsDisabled(false);
      } finally {
        $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
      }
    },
    modal: {
      ondismiss: function () {
        setOrderButtonsDisabled(false);
        $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* Checkout button */
$("#checkoutBtn")?.addEventListener("click", async () => {
  if (cart.length === 0) {
    showToast("Cart is empty");
    return;
  }

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  // UI lock
  setOrderButtonsDisabled(true);
  $$(".add-cart-btn").forEach(b => { b.classList.add("processing"); b.textContent = "Processing..."; });

  try {
    const data = await createOrderOnServer(items, total);
    openRazorpay(data, items);
  } catch (err) {
    console.error(err);
    showToast("Server offline or error. Try again.");
    setOrderButtonsDisabled(false);
    $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
  }
});

/* Quick ping to keep backend awake (optional) */
fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
});