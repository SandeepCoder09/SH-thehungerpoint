/* home/script.js
   SH — The Hunger Point
   Option A — Cashfree v3 compatible script
   Backend routes used:
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
  if (!container) { console.log("toast:", message); return; }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* CART STATE */
let cart = []; // { id, name, price, qty }
const findCartIndex = (id) => cart.findIndex(c => c.id === id);

function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

/* Render Cart */
function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    const tEl = $("#cartTotal");
    if (tEl) tEl.textContent = "₹0";
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

  const totalEl = $("#cartTotal");
  if (totalEl) totalEl.textContent = "₹" + total;
  updateCartCount();

  // controls
  container.querySelectorAll(".cart-dec").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    }, { passive: true });
  });

  container.querySelectorAll(".cart-inc").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty += 1;
        renderCart();
      }
    }, { passive: true });
  });

  container.querySelectorAll(".cart-remove").forEach(b => {
    b.addEventListener("click", () => {
      cart = cart.filter(i => i.id !== b.dataset.id);
      renderCart();
    });
  });
}

/* Modal */
function openModal() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  renderCart();
}
function closeModal() {
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
}

/* hook modal & buttons safely */
document.getElementById("closeOnlyBtn")?.addEventListener("click", closeModal);
$("#cartToggle")?.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
$("#overlay")?.addEventListener("click", closeModal);
$("#closeCart")?.addEventListener("click", closeModal);
$("#clearCart")?.addEventListener("click", () => { cart = []; renderCart(); closeModal(); });

/* Menu Add to Cart */
$$(".menu-item").forEach(item => {
  const qtyDisplay = item.querySelector(".qty");
  const minus = item.querySelector(".qty-btn.minus");
  const plus = item.querySelector(".qty-btn.plus");
  const addBtn = item.querySelector(".add-cart-btn");

  let qty = Number(qtyDisplay?.textContent) || 1;
  if (qtyDisplay) qtyDisplay.textContent = qty;

  const setQty = (v) => {
    qty = Math.max(1, Math.floor(v));
    if (qtyDisplay) qtyDisplay.textContent = qty;
  };

  minus?.addEventListener("click", () => setQty(qty - 1));
  plus?.addEventListener("click", () => setQty(qty + 1));

  addBtn?.addEventListener("click", () => {
    const name = item.dataset.item || item.querySelector("h3")?.textContent || "Item";
    const price = Number(item.dataset.price) || PRICE_DEFAULT;
    const id = (""+name).toLowerCase().replace(/\s+/g,"-");
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
    $$(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    $$(".page").forEach(p => p.classList.add("hidden"));
    const tab = btn.dataset.tab;
    if (tab) document.getElementById(tab)?.classList.remove("hidden");
  });
});

/* Disable add buttons during checkout */
function setOrderButtonsDisabled(disabled) {
  $$(".add-cart-btn").forEach(b => {
    b.disabled = disabled;
    b.textContent = disabled ? "Processing…" : "Add";
    if (!disabled) b.classList.remove("processing");
  });
}

/* Backend API helpers (routes already present on your server) */
async function createCashfreeOrder(amount, items) {
  const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, items, phone: "9999999999", email: "guest@example.com" }),
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

/* -------------------------
   Cashfree v3 SDK handling
   ------------------------- */
let cashfree = null;
let cashfreeMode = "production"; // change to "test" if using Cashfree test keys

// Attempt to initialize Cashfree SDK once the page loads.
// Cashfree v3 exposes a top-level `Cashfree` factory function.
function initCashfreeSDK() {
  if (window.Cashfree && typeof window.Cashfree === "function") {
    try {
      cashfree = Cashfree({ mode: cashfreeMode });
      console.log("Cashfree SDK initialized (v3).");
    } catch (err) {
      console.error("Error creating Cashfree instance:", err);
      cashfree = null;
    }
  } else if (window.Cashfree && typeof window.Cashfree.checkout === "function") {
    // fallback: if older version exposes checkout directly
    cashfree = window.Cashfree;
    console.warn("Using fallback Cashfree object (older SDK style).");
  } else {
    console.warn("Cashfree SDK not found on window (sdk script may not have loaded).");
    cashfree = null;
  }
}

/* Nice wrapper that tries both v3 instance and older checkout signature */
function openCashfreeModal(paymentSessionId) {
  if (!paymentSessionId) {
    showToast("Missing payment session");
    return;
  }

  if (!cashfree) {
    // try to initialize again (maybe SDK finished loading)
    initCashfreeSDK();
    if (!cashfree) {
      showToast("Payment SDK failed to load");
      return;
    }
  }

  try {
    // Preferred v3 usage: cashfree.checkout({ paymentSessionId, redirectTarget })
    if (typeof cashfree === "function" || (cashfree && cashfree.checkout && typeof cashfree.checkout === "function")) {
      // cashfree might be the factory function or the instance depending on how we set it above
      // If cashfree is the factory function, we created an instance earlier and overrwrote `cashfree`.
      // Call checkout on instance.
      if (cashfree.checkout) {
        cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });
      } else {
        // if somehow cashfree is the factory function (rare here), create instance now
        const inst = Cashfree({ mode: cashfreeMode });
        inst.checkout({ paymentSessionId, redirectTarget: "_modal" });
      }
    } else {
      showToast("Payment SDK incompatible");
      console.error("Unsupported cashfree object:", cashfree);
    }
  } catch (err) {
    console.error("Failed to open Cashfree checkout:", err);
    showToast("Failed to open payment");
  }
}

/* Checkout flow */
$("#checkoutBtn")?.addEventListener("click", async () => {
  if (cart.length === 0) return showToast("Cart is empty");

  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  // UI lock
  setOrderButtonsDisabled(true);

  try {
    const createResp = await createCashfreeOrder(total, items);

    // server should return ok: true and at least session + order id (various shapes handled)
    if (!createResp || !createResp.ok) {
      console.error("Create order returned:", createResp);
      showToast(createResp?.error || "Server error");
      setOrderButtonsDisabled(false);
      return;
    }

    // Parse possible response shapes
    // prefer top-level session/order; fallback to data.*
    let session = createResp.session || createResp.payment_session_id || createResp.paymentSessionId;
    let cfOrderId = createResp.orderId || createResp.order_id || createResp.orderId;

    if (createResp.data) {
      session = session || createResp.data.payment_session_id || createResp.data.session || createResp.data.paymentSessionId;
      cfOrderId = cfOrderId || createResp.data.order_id || createResp.data.orderId || createResp.data.order;
      if (!session && createResp.data.order && (createResp.data.order.payment_session_id || createResp.data.order.session)) {
        session = createResp.data.order.payment_session_id || createResp.data.order.session;
      }
    }

    if (!session) {
      console.error("No session in create order response:", createResp);
      showToast("Payment session missing");
      setOrderButtonsDisabled(false);
      return;
    }

    // open Cashfree modal
    openCashfreeModal(session);

    // Listen once for the postMessage from Cashfree (v3 still uses postMessage)
    const onMessage = async (ev) => {
      try {
        // Cashfree may send different fields; check common ones
        const okPayment = ev.data?.paymentMessage === "SUCCESS" || ev.data?.paymentStatus === "SUCCESS";
        const failedPayment = ev.data?.paymentMessage === "FAILED" || ev.data?.paymentMessage === "CANCELLED" || ev.data?.paymentStatus === "FAILED";

        if (okPayment) {
          // if event includes cf order id, use it; else use server-provided cfOrderId
          const detectedCfOrderId = ev.data?.orderId || ev.data?.order_id || ev.data?.cashfree_order_id || cfOrderId;

          // Verify with backend
          const v = await verifyCashfree(detectedCfOrderId, items);

          if (v.ok) {
            cart = [];
            renderCart();
            closeModal();

            // Hide menu and show order status
            $$(".menu").forEach(m => (m.style.display = "none"));
            const status = $("#order-status");
            if (status) {
              status.classList.remove("hidden");
              $("#eta-text").textContent = `Order #${v.orderId || v.order_id || "N/A"} confirmed! ETA 15 mins 🍴`;
            }

            showToast("Order confirmed! Enjoy your meal 🍽️", 3000);
          } else {
            console.error("Verify response:", v);
            showToast("Payment verification failed");
          }
        } else if (failedPayment) {
          showToast("Payment was cancelled/failed");
        } else {
          // unrelated message — ignore
        }
      } catch (err) {
        console.error("Payment message handler error:", err);
        showToast("Verification error");
      } finally {
        // restore UI & cleanup
        setOrderButtonsDisabled(false);
        window.removeEventListener("message", onMessage);
      }
    };

    window.addEventListener("message", onMessage, { once: true, passive: true });

  } catch (err) {
    console.error("Checkout error:", err);
    showToast("Checkout error");
    setOrderButtonsDisabled(false);
  }
});

/* Quick server ping (optional) */
fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));

/* Init on DOM ready */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();

  // Try initialize Cashfree SDK (SDK script is loaded with defer, so it should be available)
  initCashfreeSDK();

  // If SDK loads later, also attempt init again shortly (helps if network delay)
  setTimeout(() => { if (!cashfree) initCashfreeSDK(); }, 2000);
  setTimeout(() => { if (!cashfree) initCashfreeSDK(); }, 5000);
});
