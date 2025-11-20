/* SH — The Hunger Point
   Option A — Cashfree integration that talks to:
     POST /create-order
     POST /verify-payment

   Robust parsing for multiple possible server response shapes.
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

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

  // hook cart controls
  container.querySelectorAll(".cart-dec").forEach(b => {
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        renderCart();
      }
    }, { passive: true });
  });
  container.querySelectorAll(".cart-inc").forEach(b => {
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) {
        cart[idx].qty += 1;
        renderCart();
      }
    }, { passive: true });
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
  const overlay = $("#overlay");
  const modal = $("#cartModal");
  if (overlay) overlay.classList.remove("hidden");
  if (modal) modal.classList.remove("hidden");
  renderCart();
}
function closeModal() {
  const overlay = $("#overlay");
  const modal = $("#cartModal");
  if (overlay) overlay.classList.add("hidden");
  if (modal) modal.classList.add("hidden");
}

// Close-only button (does NOT clear cart)
document.getElementById("closeOnlyBtn")?.addEventListener("click", () => {
    closeModal();
});

/* hook cart icon */
$("#cartToggle")?.addEventListener("click", (e) => {
  e.preventDefault();
  openModal();
});

/* overlay click closes modal */
$("#overlay")?.addEventListener("click", closeModal);

/* close button in modal */
$("#closeCart")?.addEventListener("click", closeModal);

/* clear cart button (also close) */
$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
  closeModal();
});

/* Menu: qty controls + add */
$$(".menu-item").forEach(itemEl => {
  const qtyEl = itemEl.querySelector(".qty");
  const dec = itemEl.querySelector(".qty-btn.minus");
  const inc = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  let qty = Number(qtyEl?.textContent) || 1;
  if (qtyEl) qtyEl.textContent = qty;

  const setQty = (v) => {
    qty = Math.max(1, Math.floor(v));
    if (qtyEl) qtyEl.textContent = qty;
  };

  dec?.addEventListener("click", () => setQty(qty - 1));
  inc?.addEventListener("click", () => setQty(qty + 1));

  addBtn?.addEventListener("click", () => {
    const name = itemEl.dataset.item || itemEl.querySelector("h3")?.textContent || "Item";
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = (""+name).toLowerCase().replace(/\s+/g,"-");

    const idx = findCartIndex(id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added to cart`);
    renderCart();
  });
});

/* Tabs switch */
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

/* Checkout helpers */
function setOrderButtonsDisabled(disabled){
  $$(".add-cart-btn").forEach(b => { b.disabled = disabled; if(!disabled) b.classList.remove("processing"); });
}

async function createOrderOnServer(items, amount) {
  const resp = await fetch(`${SERVER_URL}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, items })
  });
  const data = await resp.json();
  return data;
}

function parseCreateOrderResponse(data) {
  // Support a few possible response shapes:
  // 1) { ok: true, orderId: "...", session: "..." }
  // 2) { ok: true, data: { order_id: "...", payment_session_id: "..." } }
  // 3) { ok: true, data: { order_id: "...", session: "..." } }
  // 4) { ok: true, order_id: "...", payment_session_id: "..." }
  // 5) legacy: { ok: true, data: { ... } } where fields may be inside data

  if (!data || !data.ok) return null;

  // try top-level session/order
  let session = data.session || data.payment_session_id || data.paymentSessionId || data.payment_session;
  let orderId = data.orderId || data.order_id || data.orderId || data.order;

  // try inside data
  if ((!session || !orderId) && data.data) {
    session = session || data.data.payment_session_id || data.data.session || data.data.paymentSessionId || data.data.payment_session;
    orderId = orderId || data.data.order_id || data.data.orderId || data.data.order;
  }

  // try nested 'order' object (some APIs return order: { id, payment_session_id })
  if ((!session || !orderId) && data.data && data.data.order) {
    const od = data.data.order;
    session = session || od.payment_session_id || od.session || od.paymentSessionId;
    orderId = orderId || od.id || od.order_id;
  }

  if (session && orderId) return { session, orderId };
  return null;
}

function openCashfreeModal(sessionId) {
  if (!window.Cashfree) {
    showToast("Cashfree SDK not loaded");
    return;
  }
  try {
    Cashfree.checkout({
      paymentSessionId: sessionId,
      redirectTarget: "_modal"
    });
  } catch (err) {
    console.error("Cashfree open error:", err);
    showToast("Failed to open payment");
  }
}

/* Checkout button in modal */
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

    const parsed = parseCreateOrderResponse(data);
    if (!parsed) {
      console.error("Create order unexpected response:", data);
      showToast("Server error. Try again.");
      setOrderButtonsDisabled(false);
      return;
    }

    // open CF modal
    openCashfreeModal(parsed.session);

    // handle message — once only
    const onMessage = async (ev) => {
      try {
        if (ev.data?.paymentMessage === "SUCCESS" || ev.data?.paymentStatus === "SUCCESS") {
          // Try to determine orderId: prefer parsed.orderId, else check event payload
          const cfOrderId = parsed.orderId || ev.data?.orderId || ev.data?.order_id || ev.data?.cashfree_order_id;
          // call verify endpoint with whatever we have
          const verifyResp = await fetch(`${SERVER_URL}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: cfOrderId, items })
          });
          const verifyJson = await verifyResp.json();
          if (verifyJson.ok) {
            cart = [];
            renderCart();
            closeModal();
            $$(".menu").forEach(m => m.style.display = "none");
            const status = document.getElementById("order-status");
            if (status) {
              status.classList.remove("hidden");
              $("#eta-text").textContent = `Order #${verifyJson.orderId || verifyJson.order_id || "N/A"} confirmed! ETA: 15 mins 🍴`;
            }
            showToast("Order confirmed! Enjoy your meal 🍽️", 3000);
          } else {
            console.error("Verify returned:", verifyJson);
            showToast("Payment verification failed.");
          }
        } else if (ev.data?.paymentMessage === "FAILED" || ev.data?.paymentMessage === "CANCELLED") {
          showToast("Payment cancelled.");
        }
      } catch (err) {
        console.error("Payment message handler error:", err);
        showToast("Verification failed. Try later.");
      } finally {
        // cleanup UI and remove listener
        setOrderButtonsDisabled(false);
        $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
        window.removeEventListener("message", onMessage);
      }
    };

    window.addEventListener("message", onMessage, { once: true });

  } catch (err) {
    console.error(err);
    showToast("Server error. Try again.");
    setOrderButtonsDisabled(false);
    $$(".add-cart-btn").forEach(b => { b.classList.remove("processing"); b.textContent = "Add"; });
  }
});

/* Quick server ping (optional) */
fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));

/* init */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateCartCount();
});
