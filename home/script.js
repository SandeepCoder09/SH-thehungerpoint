// ========== /home/script.js ==========
// Full script: menu qty + add-to-cart + cart modal + Cashfree checkout + toast
// Preserves your server integration and UX. Updated to match new menu layout.

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
   Cart state
   ------------------------- */
let cart = []; // items: { id, name, price, qty }

const findCartIndex = (id) => cart.findIndex(c => c.id === id);

function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

/* -------------------------
   Image map for menu + cart
   ------------------------- */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "fries": "/home/sh-french-fries.png",
  "tea": "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
  "bread-pakoda": "/home/sh-bread-pakoda.png"
};

function getImageFor(name){
  if(!name) return "";
  return imageMap[String(name).trim().toLowerCase()] || "";
}

/* -------------------------
   renderCart() — cart modal (compact with images)
   ------------------------- */
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

    const img = getImageFor(item.name);

    const node = document.createElement("div");
    node.className = "cart-item";

    node.innerHTML = `
      <img src="${img}" class="cart-img" alt="${item.name}" loading="lazy" />
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="cart-actions">
        <button class="cart-dec" data-id="${item.id}" aria-label="decrease">−</button>
        <span class="cart-qty" aria-live="polite">${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}" aria-label="increase">+</button>
        <button class="cart-remove" data-id="${item.id}" aria-label="remove">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  const totalEl = $("#cartTotal");
  if (totalEl) totalEl.textContent = "₹" + total;
  updateCartCount();

  // attach handlers
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
$("#closeOnlyBtn")?.addEventListener("click", closeModal);
$("#clearCart")?.addEventListener("click", () => { cart = []; renderCart(); });

/* -------------------------
   Menu qty + add-to-cart logic (matches new markup)
   ------------------------- */
$$(".menu-item").forEach(itemEl => {
  const qtyDisplay = itemEl.querySelector(".qty-display");
  const dec = itemEl.querySelector(".qty-btn.minus");
  const inc = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  // initialize qty
  let qty = Number(qtyDisplay?.textContent) || 1;
  if (qtyDisplay) qtyDisplay.textContent = qty;

  function setQty(v){
    qty = Math.max(1, Math.floor(v || 1));
    if (qtyDisplay) qtyDisplay.textContent = qty;
  }

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

/* -------------------------
   Tabs (unchanged)
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
   Backend connectors (same as original)
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
   Cashfree SDK init & modal open (kept original logic)
   ------------------------- */
let cashfreeInstance = null;
let cashfreeMode = "production";

function initCashfreeSDK() {
  try {
    if (window.Cashfree && typeof window.Cashfree === "function") {
      cashfreeInstance = Cashfree({ mode: cashfreeMode });
      console.log("Cashfree v3 initialized via factory.");
    } else if (window.Cashfree && window.Cashfree.checkout) {
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
    if (cashfreeInstance.checkout) {
      cashfreeInstance.checkout({ paymentSessionId, redirectTarget: "_modal" });
      return;
    }

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
   Checkout flow (unchanged logic)
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

    // robust parsing
    let session = null;
    let cfOrderId = null;
    session = session || createResp.session || createResp.payment_session_id || createResp.paymentSessionId || createResp.data?.payment_session_id || createResp.data?.session;
    cfOrderId = cfOrderId || createResp.orderId || createResp.order_id || createResp.data?.order_id || createResp.data?.orderId || createResp.data?.order?.id;
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

    openCashfreeModal(session);

    const onMessage = async (ev) => {
      try {
        const data = ev.data || {};
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
          const detectedCfOrderId = data.orderId || data.order_id || data.cashfree_order_id || cfOrderId;
          const verifyResp = await verifyCashfree(detectedCfOrderId || cfOrderId || session, items);

          if (verifyResp && verifyResp.ok) {
            cart = [];
            renderCart();
            closeModal();
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
        }
      } catch (err) {
        console.error("onMessage handler error:", err);
        showToast("Payment verification error");
      } finally {
        setOrderButtonsDisabled(false);
        window.removeEventListener("message", onMessage);
      }
    };

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

  setTimeout(() => { if (!cashfreeInstance) initCashfreeSDK(); }, 2000);
  setTimeout(() => { if (!cashfreeInstance) initCashfreeSDK(); }, 6000);

  // wake backend
  fetch(`${SERVER_URL}/ping`).catch(()=>console.log("Ping failed (ok)"));
});




// Hide Google Feedback Popup
setInterval(() => {
  // Hide Google popup iframe completely
  const frames = document.querySelectorAll(
    "iframe.goog-te-menu-frame, iframe.goog-te-balloon-frame"
  );
  frames.forEach(f => f.style.display = "none");
}, 300);
</script>