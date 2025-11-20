/* SH — The Hunger Point
   Cashfree (Option A) — Full Working Version
   Uses:
     POST /create-cashfree-order
     POST /verify-cashfree-payment
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

// Shortcuts
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(message, duration = 2200) {
  const container = $("#toast-container");
  if (!container) return console.log("toast:", message);

  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* CART */
let cart = [];

const findCartIndex = (id) => cart.findIndex(i => i.id === id);

function updateCartCount() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

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

  cart.forEach(item => {
    total += item.qty * item.price;

    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
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

    box.appendChild(row);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  // Minus
  box.querySelectorAll(".cart-dec").forEach(btn =>
    btn.addEventListener("click", () => {
      const idx = findCartIndex(btn.dataset.id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    })
  );

  // Plus
  box.querySelectorAll(".cart-inc").forEach(btn =>
    btn.addEventListener("click", () => {
      const idx = findCartIndex(btn.dataset.id);
      if (idx >= 0) {
        cart[idx].qty++;
        renderCart();
      }
    })
  );

  // Remove
  box.querySelectorAll(".cart-remove").forEach(btn =>
    btn.addEventListener("click", () => {
      cart = cart.filter(i => i.id !== btn.dataset.id);
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

$("#cartToggle").addEventListener("click", openModal);
$("#overlay").addEventListener("click", closeModal);
$("#closeCart").addEventListener("click", closeModal);
$("#closeOnlyBtn").addEventListener("click", closeModal);

$("#clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
  closeModal();
});

/* Menu Items Add to Cart */
$$(".menu-item").forEach(item => {
  const qtyEl = item.querySelector(".qty");
  const minus = item.querySelector(".qty-btn.minus");
  const plus = item.querySelector(".qty-btn.plus");
  const addBtn = item.querySelector(".add-cart-btn");

  let qty = Number(qtyEl.textContent) || 1;

  const setQty = (v) => {
    qty = Math.max(1, v);
    qtyEl.textContent = qty;
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

    showToast(`${qty} × ${name} added to cart`);
    renderCart();
  });
});

/* Tabs */
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tabName = btn.dataset.tab;
    $$(".page").forEach(p => p.classList.add("hidden"));
    if (tabName) $("#" + tabName).classList.remove("hidden");
  });
});

/* Disable add buttons during checkout */
function lockButtons(disabled) {
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    b.textContent = disabled ? "Processing…" : "Add";
  });
}

/* Backend API calls */
async function createCashfreeOrder(amount, items) {
  const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      items,
      phone: "9999999999",
      email: "guest@example.com",
    }),
  });

  return res.json();
}

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

    // Open Cashfree modal
    Cashfree.checkout({
      paymentSessionId: cf.session,
      redirectTarget: "_modal",
    });

    // Listen for payment result
    const onMsg = async (ev) => {
      try {
        if (ev.data?.paymentMessage === "SUCCESS") {
          const verify = await verifyCashfree(cf.orderId, items);

          if (verify.ok) {
            cart = [];
            renderCart();
            closeModal();

            $$(".menu").forEach(m => (m.style.display = "none"));
            $("#order-status").classList.remove("hidden");
            $("#eta-text").textContent = `Order #${verify.orderId} confirmed! ETA 15 mins 🍽️`;

            showToast("Order Confirmed!");
          } else {
            showToast("Verification failed");
          }
        }
      } catch {
        showToast("Verification failed");
      } finally {
        window.removeEventListener("message", onMsg);
        lockButtons(false);
      }
    };

    window.addEventListener("message", onMsg);
  } catch (err) {
    console.error(err);
    showToast("Checkout error");
  } finally {
    lockButtons(false);
  }
});

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
});
