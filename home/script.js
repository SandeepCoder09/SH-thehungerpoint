// /home/script.js
// SH — The Hunger Point
// Option A — Cashfree modal checkout (robust, tolerant parser)
// Preserves your UI + cart logic, fixes order/session detection, verification and cart reset.

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* -------------------------
   Toast helper
   ------------------------- */
function showToast(message, duration = 2500) {
  const container = $("#toast-container");
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

/* -------------------------
   CART STATE & UI
   ------------------------- */
let cart = []; // { id, name, price, qty }

const findCartIndex = (id) => cart.findIndex(c => c.id === id);

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
    const t = $("#cartTotal");
    if (t) t.textContent = "₹0";
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
        <div style="font-weight:700">${item.name}</div>
        <div>₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="cart-dec" data-id="${item.id}" aria-label="decrease">−</button>
        <span style="min-width:26px; text-align:center; display:inline-block;">${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}" aria-label="increase">+</button>
        <button class="cart-remove" data-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  const totalEl = $("#cartTotal");
  if (totalEl) totalEl.textContent = "₹" + total;
  updateCartCount();

  // attach item controls
  container.querySelectorAll(".cart-dec").forEach(b => {
    b.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    };
  });
  container.querySelectorAll(".cart-inc").forEach(b => {
    b.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty += 1;
        renderCart();
      }
    };
  });
  container.querySelectorAll(".cart-remove").forEach(b => {
    b.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      cart = cart.filter(c => c.id !== id);
      renderCart();
    };
  });
}

/* -------------------------
   Modal open/close
   ------------------------- */
function openModal() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  renderCart();
}
function closeModal() {
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
}

/* Hook modal triggers */
$("#cartToggle")?.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
$("#overlay")?.addEventListener("click", closeModal);
$("#closeCart")?.addEventListener("click", closeModal);
// Clear button should only clear cart if it's the "Clear All Items" button
$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
});

/* -------------------------
   Menu qty + add logic
   ------------------------- */
$$(".menu-item").forEach(itemEl => {
  const qtyEl = itemEl.querySelector(".qty");
  const dec = itemEl.querySelector(".qty-btn.minus");
  const inc = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  let qty = Number(qtyEl?.textContent) || 1;
  if (qtyEl) qtyEl.textContent = qty;

  const setQty = (v) => {
    qty = Math.max(1, Math.floor(v || 1));
    if (qtyEl) qtyEl.textContent = qty;
  };

  dec?.addEventListener("click", () => setQty(qty - 1));
  inc?.addEventListener("click", () => setQty(qty + 1));

  addBtn?.addEventListener("click", () => {
    const name = itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = ("" + name).toLowerCase().replace(/\s+/g, "-");

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
    const tab = btn.dataset.tab;
    $$(".page").forEach(p => p.classList.add("hidden"));
    const el = document.getElementById(tab);
    if (el) el.classList.remove("hidden");
  });
});

/* -------------------------
   Disable add buttons helper
   ------------------------- */
function setOrderButtonsDisabled(disabled) {
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    if (disabled) {
      b.classList.add("processing");
      b.textContent = "Processing...";
    } else {
      b.classList.remove("processing");
      b.textContent = "Add";
    }
  });
}

/* -------------------------
   Backend connectors
   ------------------------- */
async function createCashfreeOrder(amount, items, customer = {}) {
  const payload = {
    amount: Number(amount),
    items,
    phone: customer.phone || undefined,
    email: customer.email || undefined
  };
  const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function verifyCashfree(orderId, items) {
  const res = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, items })
  });
  return res.json();
}

/* -------------------------
   Cashfree SDK helpers (modal)
   ------------------------- */
let cashfreeInstance = null;
let cashfreeMode = "production"; // adjust if needed

function initCashfreeSDK() {
  try {
    if (window.Cashfree && typeof window.Cashfree === "function") {
      // v3-style: factory function
      cashfreeInstance = Cashfree({ mode: cashfreeMode });
      console.log("Cashfree v3 initialized via factory.");
    } else if (window.Cashfree && window.Cashfree.checkout) {
      // older SDK that exposes checkout
      cashfreeInstance = window.Cashfree;
      console.log("Cashfree fallback available.");
    } else {
      console.warn("Cashfree SDK not available yet.");
      cashfreeInstance = null;
    }
  } catch (err) {
    console.error("initCashfreeSDK error:", err);
    cashfreeInstance = null;
  }
}

/**
 * openCashfreeModal(paymentSessionId)
 * Accepts many response shapes and opens checkout safely.
 */
function openCashfreeModal(paymentSessionId) {
  if (!paymentSessionId) {
    showToast("Payment session missing");
    return;
  }

  if (!cashfreeInstance) initCashfreeSDK();
  if (!cashfreeInstance) {
    showToast("Payment SDK not loaded");
    return;
  }

  try {
    // Preferred v3 API
    if (cashfreeInstance.checkout) {
      cashfreeInstance.checkout({ paymentSessionId, redirectTarget: "_modal" });
      return;
    }

    // If cashfreeInstance is a function (factory), create instance and call checkout
    if (typeof cashfreeInstance === "function") {
      const inst = cashfreeInstance({ mode: cashfreeMode });
      if (inst.checkout) {
        inst.checkout({ paymentSessionId, redirectTarget: "_modal" });
        return;
      }
    }

    showToast("Payment SDK incompatible");
    console.error("Unsupported Cashfree instance:", cashfreeInstance);
  } catch (err) {
    console.error("openCashfreeModal error:", err);
    showToast("Failed to open payment");
  }
}

/* -------------------------
   Checkout flow (modal)
   ------------------------- */
$("#checkoutBtn")?.addEventListener("click", async () => {
  if (cart.length === 0) {
    showToast("Cart is empty");
    return;
  }

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  setOrderButtonsDisabled(true);

  try {
    const createResp = await createCashfreeOrder(total, items);

    if (!createResp || createResp.ok === false) {
      console.error("create order failed:", createResp);
      showToast(createResp?.error || "Server error creating order");
      setOrderButtonsDisabled(false);
      return;
    }

    // Robust parsing of response shapes
    let session = null;
    let cfOrderId = null;

    // common keys
    session = session || createResp.session || createResp.payment_session_id || createResp.paymentSessionId || createResp.data?.payment_session_id || createResp.data?.session;
    cfOrderId = cfOrderId || createResp.orderId || createResp.order_id || createResp.data?.order_id || createResp.data?.orderId || createResp.data?.order?.id;

    // some APIs return under raw.data.order or raw.order
    if (!session) {
      const raw = createResp.raw || createResp.data || createResp;
      if (raw) {
        session = session || raw.payment_session_id || raw.paymentSessionId || raw.session || raw.data?.payment_session_id || raw.order?.payment_session_id;
        cfOrderId = cfOrderId || raw.order_id || raw.orderId || raw.order?.id || raw.order?.order_id;
      }
    }

    if (!session) {
      console.error("No payment session found in create order response:", createResp);
      showToast("Payment session missing from server");
      setOrderButtonsDisabled(false);
      return;
    }

    // Open Cashfree modal
    openCashfreeModal(session);

    // Single-use message listener to capture Cashfree postMessage
    const onMessage = async (ev) => {
      try {
        const data = ev.data || {};
        // Cashfree uses several different event shapes; check for success signals
        const success =
          data.paymentMessage === "SUCCESS" ||
          data.paymentStatus === "SUCCESS" ||
          (typeof data === "string" && data.toUpperCase().includes("SUCCESS"));

        const failed =
          data.paymentMessage === "FAILED" ||
          data.paymentMessage === "CANCELLED" ||
          data.paymentStatus === "FAILED" ||
          (typeof data === "string" && data.toUpperCase().includes("FAILED"));

        if (success) {
          // Determine cf order id from event or fallback to value previously parsed
          const detectedCfOrderId = data.orderId || data.order_id || data.cashfree_order_id || cfOrderId;

          // If we still don't have an external CF order id, server verify will try to look it up via create response (server should accept)
          const verifyResp = await verifyCashfree(detectedCfOrderId || cfOrderId || session, items);

          if (verifyResp && verifyResp.ok) {
            // success path - clear cart + UI
            cart = [];
            renderCart();
            closeModal();

            // hide menu (your existing UX)
            $$(".menu").forEach(m => m.style.display = "none");

            const status = $("#order-status");
            if (status) {
              status.classList.remove("hidden");
              $("#eta-text").textContent = `Order #${verifyResp.orderId || verifyResp.order_id || "N/A"} confirmed! ETA: 15 mins 🍴`;
            }

            showToast("Order confirmed! Enjoy your meal 🍽️", 3200);
          } else {
            console.error("Verify returned not ok:", verifyResp);
            showToast(verifyResp?.error || "Payment verification failed");
          }
        } else if (failed) {
          showToast("Payment cancelled or failed");
        } else {
          // unrelated message: ignore
        }
      } catch (err) {
        console.error("onMessage handler error:", err);
        showToast("Payment verification error");
      } finally {
        setOrderButtonsDisabled(false);
        window.removeEventListener("message", onMessage);
      }
    };

    // listen once (cleanup done inside handler)
    window.addEventListener("message", onMessage, { once: true, passive: true });

  } catch (err) {
    console.error("Checkout error:", err);
    showToast("Checkout error. Try again.");
    setOrderButtonsDisabled(false);
  }
});

/* -------------------------
   Init
   ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
  initCashfreeSDK();

  // retry init if SDK loads late
  setTimeout(() => { if (!cashfreeInstance) initCashfreeSDK(); }, 2000);
  setTimeout(() => { if (!cashfreeInstance) initCashfreeSDK(); }, 6000);

  // optional ping to wake backend
  fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));
});