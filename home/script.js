/* SH — The Hunger Point
   Option-1 Cashfree Modal Checkout
   Fully updated to replace Razorpay
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

// Helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(message, duration = 2200) {
  const container = document.getElementById("toast-container");
  if (!container) return console.log("toast:", message);

  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* CART STATE */
let cart = []; // { id, name, price, qty }

/* Cart Helpers */
function findCartIndex(id) {
  return cart.findIndex(c => c.id === id);
}

function updateCartCount() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

/* Render Cart */
function renderCart() {
  const container = $("#cartItems");
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.qty * item.price;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
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
    container.appendChild(div);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  // Cart button controls
  container.querySelectorAll(".cart-dec").forEach(b =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    })
  );

  container.querySelectorAll(".cart-inc").forEach(b =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty++;
        renderCart();
      }
    })
  );

  container.querySelectorAll(".cart-remove").forEach(b =>
    b.addEventListener("click", () => {
      cart = cart.filter(i => i.id !== b.dataset.id);
      renderCart();
    })
  );
}

/* Modal */
function openModal() {
  $("#overlay").classList.remove("hidden");
  $("#cartModal").classList.remove("hidden");
  renderCart();
}

function closeModal() {
  $("#overlay").classList.add("hidden");
  $("#cartModal").classList.add("hidden");
}

$("#closeOnlyBtn").addEventListener("click", closeModal);
$("#cartToggle").addEventListener("click", openModal);
$("#overlay").addEventListener("click", closeModal);
$("#closeCart").addEventListener("click", closeModal);

$("#clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
  closeModal();
});

/* Menu Add-to-Cart Controls */
$$(".menu-item").forEach(item => {
  const qtyDisplay = item.querySelector(".qty");
  const minus = item.querySelector(".qty-btn.minus");
  const plus = item.querySelector(".qty-btn.plus");
  const addBtn = item.querySelector(".add-cart-btn");

  let qty = Number(qtyDisplay.textContent) || 1;

  const setQty = (v) => {
    qty = Math.max(1, v);
    qtyDisplay.textContent = qty;
  };

  minus.addEventListener("click", () => setQty(qty - 1));
  plus.addEventListener("click", () => setQty(qty + 1));

  addBtn.addEventListener("click", () => {
    const name = item.dataset.item;
    const price = Number(item.dataset.price) || PRICE_DEFAULT;
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const idx = findCartIndex(id);

    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added`);
    renderCart();
  });
});

/* Tabs */
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $$(".page").forEach(p => p.classList.add("hidden"));

    if (tab) $("#" + tab).classList.remove("hidden");
  });
});

/* DISABLE ADD BUTTONS */
function lockButtons(disabled) {
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    b.textContent = disabled ? "Processing…" : "Add";
  });
}

/* Create Order (BACKEND) */
async function createCashfreeOrder(amount, items) {
  const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      items,
      phone: "9999999999",
      email: "guest@email.com",
    }),
  });

  return res.json();
}

/* Verify Order */
async function verifyCashfree(orderId, items) {
  const res = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, items }),
  });

  return res.json();
}

/* Checkout */
$("#checkoutBtn").addEventListener("click", async () => {
  if (cart.length === 0) return showToast("Cart is empty");

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  lockButtons(true);

  try {
    const cf = await createCashfreeOrder(total, items);

    if (!cf.ok) {
      showToast("Server error");
      lockButtons(false);
      return;
    }

    // OPEN CASHFREE MODAL
    Cashfree.checkout({
      paymentSessionId: cf.session,
      redirectTarget: "_modal",
    });

    // Listen for Cashfree events
    window.addEventListener("message", async (ev) => {
      if (ev.data?.paymentMessage === "SUCCESS") {
        const v = await verifyCashfree(cf.orderId, items);

        if (v.ok) {
          cart = [];
          renderCart();
          closeModal();

          $$(".menu").forEach(m => (m.style.display = "none"));
          $("#order-status").classList.remove("hidden");
          $("#eta-text").textContent = `Order #${v.orderId} confirmed! ETA 15 mins 🍽️`;

          showToast("Order Confirmed!");
        } else {
          showToast("Verification failed");
        }
      }
    });

  } catch (err) {
    console.error(err);
    showToast("Checkout failed");
  } finally {
    lockButtons(false);
  }
});

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
});
