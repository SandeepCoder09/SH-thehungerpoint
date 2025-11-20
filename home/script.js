/* /home/script.js — Cashfree Integrated Version */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;
const CASHFREE_MODE = "production"; // use "sandbox" for testing

// helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(message, duration = 2200) {
  const container = document.getElementById("toast-container");
  if (!container) { console.log("toast:", message); return; }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* CART STATE */
let cart = []; // items: { id, name, price, qty }

function findCartIndex(id) {
  return cart.findIndex(c => c.id === id);
}

function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

/* RENDER CART (modal) */
function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    const totalEl = $("#cartTotal");
    if (totalEl) totalEl.textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.qty * item.price;
    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
  <div class="meta">
    <div class="cart-item-name">${item.name}</div>
    <div>₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
  </div>

  <div class="cart-qty-wrap">
    <button class="cart-dec" data-id="${item.id}">−</button>
    <span class="cart-qty">${item.qty}</span>
    <button class="cart-inc" data-id="${item.id}">+</button>
  </div>

  <button class="cart-remove" data-id="${item.id}">✕</button>
`;
    container.appendChild(node);
  });

  const totalEl = $("#cartTotal");
  if (totalEl) totalEl.textContent = "₹" + total;
  updateCartCount();

  container.querySelectorAll(".cart-dec").forEach(b => {
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    });
  });

  container.querySelectorAll(".cart-inc").forEach(b => {
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty += 1;
        renderCart();
      }
    });
  });

  container.querySelectorAll(".cart-remove").forEach(b => {
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      cart = cart.filter(c => c.id !== id);
      renderCart();
    });
  });
}

/* MODAL open/close */
function openModal() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  renderCart();
}
function closeModal() {
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
}

$("#closeOnlyBtn")?.addEventListener("click", closeModal);
$("#cartToggle")?.addEventListener("click", openModal);
$("#overlay")?.addEventListener("click", closeModal);
$("#closeCart")?.addEventListener("click", closeModal);

$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
  closeModal();
});

/* Menu + Add to Cart */
$$(".menu-item").forEach(itemEl => {
  const qtyEl = itemEl.querySelector(".qty");
  let qty = Number(qtyEl.textContent);

  const setQty = (v) => {
    qty = Math.max(1, v);
    qtyEl.textContent = qty;
  };

  itemEl.querySelector(".qty-btn.minus")?.addEventListener("click", () => setQty(qty - 1));
  itemEl.querySelector(".qty-btn.plus")?.addEventListener("click", () => setQty(qty + 1));

  itemEl.querySelector(".add-cart-btn")?.addEventListener("click", () => {
    const name = itemEl.dataset.item;
    const price = Number(itemEl.dataset.price);
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const idx = findCartIndex(id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added to cart`);
    renderCart();
  });
});

/* TABS */
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $$(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(tab)?.classList.remove("hidden");
  });
});

/* Checkout Helpers */
function setOrderButtonsDisabled(disabled){
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    if(disabled) b.classList.add("processing");
    else b.classList.remove("processing");
  });
}

/* Create order on server */
async function createOrderOnServer(items, amount) {
  const resp = await fetch(`${SERVER_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, items })
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "Order creation failed");
  return data.data;
}

/* Load Cashfree SDK */
function loadCashfreeSdk() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree);
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => resolve(window.Cashfree);
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

/* Open Cashfree Checkout */
async function openCashfreeCheckout(cfData) {
  await loadCashfreeSdk();
  const cf = window.Cashfree({ mode: CASHFREE_MODE });

  const paymentSessionId =
    cfData.payment_session_id ||
    (cfData.order && cfData.order.payment_session_id);

  return new Promise((resolve, reject) => {
    cf.checkout({
      paymentSessionId,
      redirectTarget: "_self",
      onClose: () => resolve({ closed: true }),
      onSuccess: (result) => resolve(result),
      onError: (err) => reject(err),
    });
  });
}

/* Poll Server For Verification */
async function pollVerifyPayment(orderId, items) {
  for (let i = 0; i < 10; i++) {
    const resp = await fetch(`${SERVER_URL}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, items })
    });

    const data = await resp.json();
    if (data.ok) return data; 
    await new Promise(r => setTimeout(r, 2000));
  }
  return { ok: false };
}

/* Checkout Button */
$("#checkoutBtn")?.addEventListener("click", async () => {
  if (cart.length === 0) return showToast("Cart is empty");

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  setOrderButtonsDisabled(true);

  try {
    const cfData = await createOrderOnServer(items, total);
    const res = await openCashfreeCheckout(cfData);

    const orderId = cfData.order_id || cfData.order?.order_id;

    const verify = await pollVerifyPayment(orderId, items);

    if (verify.ok) {
      cart = [];
      renderCart();
      closeModal();
      $$(".menu").forEach(m => m.style.display = "none");
      $("#order-status").classList.remove("hidden");
      $("#eta-text").textContent = `Order #${verify.orderId} confirmed! ETA: 15 mins 🍴`;
      showToast("Order confirmed!", 3000);
    } else {
      showToast("Payment not verified.");
    }

  } catch (err) {
    showToast("Payment failed.");
  }

  setOrderButtonsDisabled(false);
});

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
});
