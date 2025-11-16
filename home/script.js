/* ---------------------------------------------------
   SH — The Hunger Point
   script.js (Final Version — Option A Center Modal)
   Cart + Qty + Tabs + Razorpay Integrated
--------------------------------------------------- */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

// Shortcuts
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ---------------------------------------------------
   TOAST
--------------------------------------------------- */
function showToast(msg, duration = 2200) {
  const box = $("#toast-container");
  if (!box) return console.log("Toast:", msg);

  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ---------------------------------------------------
   CART STATE
--------------------------------------------------- */
let cart = [];

function findCartIndex(id) {
  return cart.findIndex((c) => c.id === id);
}

function updateCartCount() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

/* ---------------------------------------------------
   RENDER CART MODAL
--------------------------------------------------- */
function renderCart() {
  const box = $("#cartItems");
  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    total += item.qty * item.price;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="meta">
        <strong>${item.name}</strong>
        <div>₹${item.price} × ${item.qty} = ₹${item.qty * item.price}</div>
      </div>

      <div class="qty-controls">
        <button class="cart-dec" data-id="${item.id}">−</button>
        <span>${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}">✕</button>
      </div>
    `;
    box.appendChild(row);
  });

  $("#cartTotal").textContent = `₹${total}`;
  updateCartCount();

  // CART DEC
  box.querySelectorAll(".cart-dec").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    })
  );

  // CART INC
  box.querySelectorAll(".cart-inc").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty++;
        renderCart();
      }
    })
  );

  // REMOVE ITEM
  box.querySelectorAll(".cart-remove").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      cart = cart.filter((c) => c.id !== id);
      renderCart();
    })
  );
}

/* ---------------------------------------------------
   CART MODAL OPEN / CLOSE
--------------------------------------------------- */
function openCartModal() {
  $("#overlay").classList.remove("hidden");
  $("#cartModal").classList.remove("hidden");
  renderCart();
}

function closeCartModal() {
  $("#overlay").classList.add("hidden");
  $("#cartModal").classList.add("hidden");
}

$("#cartToggle").addEventListener("click", openCartModal);
$("#closeCart").addEventListener("click", closeCartModal);
$("#overlay")?.addEventListener("click", closeCartModal);
$("#clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
  closeCartModal();
});

/* ---------------------------------------------------
   TABS (HOME / ORDERS / PROFILE / OFFERS)
--------------------------------------------------- */
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $$(".page").forEach((p) => p.classList.add("hidden"));
    $("#" + tab).classList.remove("hidden");
  });
});

/* ---------------------------------------------------
   MENU ITEMS (QTY + ADD)
--------------------------------------------------- */
$$(".menu-item").forEach((item) => {
  const qtyEl = item.querySelector(".qty");
  const dec = item.querySelector(".qty-btn.minus");
  const inc = item.querySelector(".qty-btn.plus");
  const addBtn = item.querySelector(".add-cart-btn");

  let qty = Number(qtyEl.textContent) || 1;

  const setQty = (v) => {
    qty = Math.max(1, v);
    qtyEl.textContent = qty;
  };

  dec.addEventListener("click", () => setQty(qty - 1));
  inc.addEventListener("click", () => setQty(qty + 1));

  addBtn.addEventListener("click", () => {
    const name = item.dataset.item;
    const price = Number(item.dataset.price) || PRICE_DEFAULT;
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const idx = findCartIndex(id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added to cart`);
    renderCart();
  });
});

/* ---------------------------------------------------
   RAZORPAY CHECKOUT FLOW
--------------------------------------------------- */
async function createOrderOnServer(items, total) {
  const res = await fetch(`${SERVER_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, amount: total }),
  });

  if (!res.ok) throw new Error("Network error");
  return res.json();
}

function openRazorpay(data, items, total) {
  const options = {
    key: data.key_id || "",
    amount: data.order.amount,
    currency: "INR",
    name: "SH — The Hunger Point",
    description: items.map((i) => `${i.name}×${i.qty}`).join(", "),
    order_id: data.order.id,

    handler: async function (resp) {
      const verifyRes = await fetch(`${SERVER_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
          items,
        }),
      });

      const result = await verifyRes.json();

      if (result.ok) {
        cart = [];
        renderCart();
        closeCartModal();
        $("#order-status").classList.remove("hidden");
        $("#eta-text").textContent = `Order #${result.orderId} confirmed! ETA: 15 mins 🍴`;
        showToast("Order confirmed 🍽️");
      } else {
        showToast("Payment verification failed");
      }
    },

    modal: {
      ondismiss: () => {
        showToast("Checkout cancelled");
      },
    },
  };

  new Razorpay(options).open();
}

$("#checkoutBtn").addEventListener("click", async () => {
  if (cart.length === 0) {
    showToast("Cart is empty");
    return;
  }

  const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  try {
    const orderData = await createOrderOnServer(items, total);
    openRazorpay(orderData, items, total);
  } catch (err) {
    console.error(err);
    showToast("Server error — try again later");
  }
});

/* ---------------------------------------------------
   INIT
--------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  renderCart();
  fetch(`${SERVER_URL}/ping`).catch(() => {});
});