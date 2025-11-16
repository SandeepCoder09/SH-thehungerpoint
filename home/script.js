// home/script.js — FINAL (cleanly formatted)
// Includes: cart UI, qty controls, tabs, Razorpay flow (create-order + verify-payment), toasts
// Preserves your original endpoints and handlers. Drop this into home/script.js

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10; // fallback price

// small DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* -------------------------
   TOAST
   ------------------------- */
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return console.log("TOAST:", message);

  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);

  setTimeout(() => t.remove(), duration);
}

/* -------------------------
   CART STATE & HELPERS
   ------------------------- */
let cart = []; // { id, name, price, qty }

function findCartIndex(id) {
  return cart.findIndex((c) => c.id === id);
}

function updateCartCount() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = count;
}

function formatINR(n) {
  return `₹${n}`;
}

/* -------------------------
   CART UI RENDER
   ------------------------- */
function updateCartUI() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    const t = document.getElementById("cartTotal");
    if (t) t.textContent = formatINR(0);
    updateCartCount();
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.qty;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="meta">
        <div><strong>${item.name}</strong></div>
        <div>₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="decrease" data-id="${item.id}">−</button>
        <span class="cart-qty">${item.qty}</span>
        <button class="increase" data-id="${item.id}">+</button>
        <button class="remove" data-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
    container.appendChild(row);
  });

  const t = document.getElementById("cartTotal");
  if (t) t.textContent = formatINR(total);
  updateCartCount();

  // attach handlers
  container.querySelectorAll(".decrease").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        if (cart[idx].qty > 1) cart[idx].qty -= 1;
        else cart.splice(idx, 1);
        updateCartUI();
      }
    };
  });

  container.querySelectorAll(".increase").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty += 1;
        updateCartUI();
      }
    };
  });

  container.querySelectorAll(".remove").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      cart = cart.filter((c) => c.id !== id);
      updateCartUI();
    };
  });
}

/* -------------------------
   OPEN / CLOSE CART (CENTERED)
   ------------------------- */
function openCart() {
  const d = document.getElementById("cartDrawer");
  if (!d) return;
  d.classList.remove("hidden");
  d.setAttribute("aria-hidden", "false");
  // reinforce centering (CSS should handle most)
  d.style.left = "50%";
  d.style.top = "50%";
  d.style.transform = "translate(-50%, -50%) scale(1)";
  updateCartUI();
}

function closeCart() {
  const d = document.getElementById("cartDrawer");
  if (!d) return;
  d.classList.add("hidden");
  d.setAttribute("aria-hidden", "true");
}

/* -------------------------
   ADD TO CART / MENU BINDINGS
   ------------------------- */
function addToCart(name, price, qty) {
  const id = name.toLowerCase().replace(/\s+/g, "-");
  const idx = findCartIndex(id);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ id, name, price, qty });
  updateCartUI();
}

function initMenuBindings() {
  $$(".menu-item").forEach((itemEl) => {
    const qtyDisplay = itemEl.querySelector(".qty");
    const dec = itemEl.querySelector('[data-action="dec"]');
    const inc = itemEl.querySelector('[data-action="inc"]');
    const addBtn = itemEl.querySelector(".add-cart-btn");

    let qty = Number(qtyDisplay?.textContent) || 1;
    if (qty < 1) qty = 1;
    if (qtyDisplay) qtyDisplay.textContent = qty;

    const setQty = (v) => {
      qty = Math.max(1, Math.floor(v));
      if (qtyDisplay) qtyDisplay.textContent = qty;
    };

    dec && dec.addEventListener("click", () => setQty(qty - 1));
    inc && inc.addEventListener("click", () => setQty(qty + 1));

    addBtn &&
      addBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const name =
          itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
        const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
        addToCart(name, price, qty);
        showToast(`${qty} × ${name} added to cart`, "success");

        // small UI pulse on cart icon
        const ct = document.getElementById("cartToggle");
        if (ct) {
          ct.animate(
            [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
            { duration: 180 }
          );
        }
      });
  });
}

/* -------------------------
   TABS
   ------------------------- */
function initTabs() {
  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      $$(".page").forEach((p) => p.classList.add("hidden"));
      const el = document.getElementById(tab);
      if (el) el.classList.remove("hidden");
    });
  });
}

/* -------------------------
   BACKEND / RAZORPAY FLOW
   ------------------------- */
function setOrderButtonsDisabled(disabled) {
  $$(".add-cart-btn").forEach((b) => {
    b.disabled = disabled;
    if (!disabled) b.classList.remove("processing");
  });
}

async function createOrderOnServer(items, amount) {
  const resp = await fetch(`${SERVER_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, items }),
  });

  if (!resp.ok) throw new Error("Network error");
  return resp.json();
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
    description: items.map((i) => `${i.name}×${i.qty}`).join(", "),
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
            items,
          }),
        });

        if (!verify.ok) throw new Error("Verify network error");
        const result = await verify.json();

        if (result.ok) {
          cart = [];
          updateCartUI();
          closeCart();

          // hide menus (keeps your previous behavior)
          document.querySelectorAll(".menu").forEach((el) => (el.style.display = "none"));

          const status = document.getElementById("order-status");
          if (status) {
            status.classList.remove("hidden");
            const eta = document.getElementById("eta-text");
            if (eta) eta.textContent = `Order #${result.orderId} confirmed! ETA: 15 mins 🍴`;
          }

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
        $$(".add-cart-btn").forEach((b) => {
          b.classList.remove("processing");
          b.textContent = "Add";
        });
      }
    },
    modal: {
      ondismiss: function () {
        // user closed checkout
        setOrderButtonsDisabled(false);
        $$(".add-cart-btn").forEach((b) => {
          b.classList.remove("processing");
          b.textContent = "Add";
        });
      },
    },
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* -------------------------
   CHECKOUT BUTTON HANDLER
   ------------------------- */
async function handleCheckoutClick() {
  if (cart.length === 0) {
    showToast("Cart is empty", "info");
    return;
  }

  const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  setOrderButtonsDisabled(true);
  $$(".add-cart-btn").forEach((b) => {
    b.classList.add("processing");
    b.textContent = "Processing...";
  });

  try {
    const data = await createOrderOnServer(items, total);
    openRazorpay(data, items, total);
  } catch (err) {
    console.error(err);
    showToast("Server offline or error. Try again.", "error");
    setOrderButtonsDisabled(false);
    $$(".add-cart-btn").forEach((b) => {
      b.classList.remove("processing");
      b.textContent = "Add";
    });
  }
}

/* -------------------------
   INIT
   ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMenuBindings();
  initTabs();
  updateCartCount();
  updateCartUI();

  // bind cart open/close
  const ct = document.getElementById("cartToggle");
  if (ct) ct.addEventListener("click", openCart);

  const closeBtn = document.getElementById("closeCart");
  if (closeBtn) closeBtn.addEventListener("click", closeCart);

  const clearBtn = document.getElementById("clearCart");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    cart = [];
    updateCartUI();
    closeCart();
  });

  // checkout
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", handleCheckoutClick);

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });

  // quick ping
  fetch(`${SERVER_URL}/ping`).catch(() => console.log("Ping failed (ok)"));
});

// backward compatible small helpers (kept intentionally)
function openCheckout() {
  const m = document.getElementById("checkoutModal");
  if (m) m.classList.remove("hidden");
}

const closeModalBtn = document.getElementById("closeModalBtn");
if (closeModalBtn)
  closeModalBtn.onclick = () => {
    const m = document.getElementById("checkoutModal");
    if (m) m.classList.add("hidden");
  };

/* End of final script */