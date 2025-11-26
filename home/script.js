/* /home/script.js - FINAL (copy/paste)
   Features:
   - Cart state + render
   - Fly-to-cart animation
   - Bottom cart modal (centered)
   - Search + category filtering
   - Checkout -> call backend -> Cashfree modal -> verify
   - No swipe-to-delete
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; // update if needed
const PRICE_DEFAULT = 10;

/* DOM helpers */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* Toast */
function showToast(msg, duration = 2200) {
  const container = $("#toast-container");
  if (!container) {
    console.log("TOAST:", msg);
    return;
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* --- CART STATE --- */
let cart = [];
const findCartIndex = (id) => cart.findIndex(c => c.id === id);

const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "hot tea": "/home/sh-hot-tea.png",
  "tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png"
};
function getImageFor(name) {
  if (!name) return "";
  return imageMap[String(name).trim().toLowerCase()] || "/home/SH-Favicon.png";
}

/* --- RENDER CART --- */
function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal") && ($("#cartTotal").textContent = "₹0");
    updateCartCount();
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.qty * item.price;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.dataset.id = item.id;
    div.innerHTML = `
      <img class="cart-img" src="${getImageFor(item.name)}" alt="${item.name}">
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
    container.appendChild(div);
  });

  $("#cartTotal") && ($("#cartTotal").textContent = "₹" + total);
  updateCartCount();
  attachCartButtons();
}

/* Update small count (we use attribute for possible styling) */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.dataset.count = total;
}

/* Attach buttons inside cart */
function attachCartButtons() {
  $$(".cart-dec").forEach(b => {
    b.onclick = (e) => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) { cart[idx].qty = Math.max(1, cart[idx].qty - 1); renderCart(); }
    };
  });
  $$(".cart-inc").forEach(b => {
    b.onclick = (e) => {
      const id = b.dataset.id;
      const idx = findCartIndex(id);
      if (idx >= 0) { cart[idx].qty += 1; renderCart(); }
    };
  });
  $$(".cart-remove").forEach(b => {
    b.onclick = (e) => {
      const id = b.dataset.id;
      cart = cart.filter(c => c.id !== id);
      renderCart();
    };
  });
}

/* --- MODAL OPEN/CLOSE --- */
function openModal() {
  const overlay = $("#overlay");
  const modal = $("#cartModal");
  if (overlay) overlay.classList.remove("hidden");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  // prevent background scroll
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  renderCart();
  // focus checkout for accessibility
  setTimeout(() => $("#checkoutBtn")?.focus(), 160);
}
function closeModal() {
  const overlay = $("#overlay");
  const modal = $("#cartModal");
  if (overlay) overlay.classList.add("hidden");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

/* --- FLY-TO-CART ANIMATION --- */
function flyToCart(imgEl) {
  if (!imgEl) return;
  try {
    const rect = imgEl.getBoundingClientRect();
    const clone = imgEl.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    clone.style.zIndex = 12000;
    clone.style.borderRadius = "10px";
    clone.style.objectFit = "cover";
    clone.style.transition = "transform .75s cubic-bezier(.12,.82,.36,1), opacity .75s";
    document.body.appendChild(clone);

    const target = $("#bottomCartBtn").getBoundingClientRect();
    // center points
    const dx = (target.left + target.width / 2) - (rect.left + rect.width / 2);
    const dy = (target.top + target.height / 2) - (rect.top + rect.height / 2);

    // small delay to allow append
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.18)`;
      clone.style.opacity = "0";
    });
    setTimeout(() => clone.remove(), 800);
  } catch (err) {
    console.warn("flyToCart error", err);
  }
}

/* --- MENU HANDLERS (qty + add) --- */
function initMenu() {
  $$(".menu-item").forEach(itemEl => {
    const minus = itemEl.querySelector(".qty-btn.minus");
    const plus = itemEl.querySelector(".qty-btn.plus");
    const display = itemEl.querySelector(".qty-display");
    const addBtn = itemEl.querySelector(".add-cart-btn");

    let qty = 1;
    if (display) display.textContent = qty;

    minus?.addEventListener("click", (e) => {
      qty = Math.max(1, qty - 1);
      if (display) display.textContent = qty;
    });

    plus?.addEventListener("click", (e) => {
      qty += 1;
      if (display) display.textContent = qty;
    });

    addBtn?.addEventListener("click", (e) => {
      const img = itemEl.querySelector(".menu-img");
      flyToCart(img);

      const name = itemEl.dataset.item || itemEl.querySelector(".menu-title")?.textContent || "Item";
      const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
      const id = name.toLowerCase().replace(/\s+/g, "-");

      const idx = findCartIndex(id);
      if (idx >= 0) cart[idx].qty += qty;
      else cart.push({ id, name, price, qty });

      showToast(`${qty} × ${name} added`);
      renderCart();

      // reset qty and display
      qty = 1;
      if (display) display.textContent = qty;

      // ensure content isn't hidden beneath nav after add: nudge scroll up if near bottom
      setTimeout(() => {
        const nearBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 40);
        if (nearBottom) window.scrollBy({ top: -140, left: 0, behavior: "smooth" });
      }, 220);
    });
  });
}

/* --- SEARCH & CATEGORY --- */
function initFilters() {
  const searchInput = $("#menuSearch");
  searchInput?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase().trim();
    $$(".menu-item").forEach(it => {
      const name = (it.dataset.item || "").toLowerCase();
      const desc = (it.querySelector(".menu-desc")?.textContent || "").toLowerCase();
      it.style.display = (name.includes(q) || desc.includes(q)) ? "flex" : "none";
    });
  });

  $$(".chip").forEach(ch => {
    ch.addEventListener("click", () => {
      $$(".chip").forEach(x => x.classList.remove("active"));
      ch.classList.add("active");
      const cat = ch.dataset.cat;
      $$(".menu-item").forEach(it => {
        it.style.display = (cat === "all" || it.dataset.cat === cat) ? "flex" : "none";
      });
      // fix: if page becomes short, ensure scroll is fine
      setTimeout(() => window.scrollTo({ top: window.scrollY - 20 }), 120);
    });
  });

  $(".search-btn")?.addEventListener("click", () => $("#menuSearch")?.focus());
}

/* --- BOTTOM NAV + overlay actions --- */
function initNavAndOverlay() {
  $("#bottomCartBtn")?.addEventListener("click", openModal);
  $("#overlay")?.addEventListener("click", closeModal);
  $("#closeCart")?.addEventListener("click", closeModal);
  $("#closeOnlyBtn")?.addEventListener("click", closeModal);

  $("#clearCart")?.addEventListener("click", () => {
    cart = [];
    renderCart();
    showToast("Cart cleared");
  });
}

/* --- CHECKOUT: create order -> open Cashfree -> verify --- */
async function startCheckoutFlow() {
  if (cart.length === 0) { showToast("Cart is empty"); return; }
  try {
    // Prepare payload
    const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);

    showToast("Creating payment session...");
    const resp = await fetch(`${SERVER_URL}/create-cashfree-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, items })
    });

    const data = await resp.json();
    if (!data || (data.ok === false && !data.session)) {
      console.error("create-cashfree-order error", data);
      showToast(data?.error || "Payment start failed");
      return;
    }

    const session = data.session || data.payment_session_id || data.data?.payment_session_id || data.data?.session;
    const orderId = data.orderId || data.order_id || data.data?.order_id || data.data?.order?.id || session;

    if (!session) {
      console.error("No payment session from server", data);
      showToast("Payment session missing");
      return;
    }

    // Open Cashfree checkout
    if (window.Cashfree && (window.Cashfree.checkout || typeof window.Cashfree === "function")) {
      try {
        if (window.Cashfree.checkout) {
          window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
        } else {
          const inst = window.Cashfree();
          inst.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
        }
      } catch (err) {
        console.error("Cashfree open error", err);
        showToast("Failed to open payment");
        return;
      }
    } else {
      console.warn("Cashfree SDK missing");
      showToast("Payment SDK not loaded");
      return;
    }

    // Handler for Cashfree result via postMessage
    const handler = async (ev) => {
      try {
        const msg = ev.data || {};
        const ok =
          msg.paymentStatus === "SUCCESS" ||
          msg.paymentMessage === "SUCCESS" ||
          (typeof msg === "string" && msg.toUpperCase().includes("SUCCESS"));
        const failed =
          msg.paymentStatus === "FAILED" ||
          msg.paymentMessage === "FAILED" ||
          (typeof msg === "string" && msg.toUpperCase().includes("FAILED"));

        if (ok) {
          showToast("Payment success — verifying...");
          // verify with server
          const verifyResp = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: orderId || session, items })
          });
          const vdata = await verifyResp.json();
          if (vdata && vdata.ok) {
            showToast("Order confirmed 🎉");
            cart = [];
            renderCart();
            closeModal();
          } else {
            console.warn("verify response", vdata);
            showToast(vdata?.error || "Verification failed");
          }
        } else if (failed) {
          showToast("Payment failed or cancelled");
        }
      } catch (err) {
        console.error("Payment handler error", err);
        showToast("Payment verification error");
      } finally {
        window.removeEventListener("message", handler);
      }
    };

    window.addEventListener("message", handler, { once: true, passive: true });

  } catch (err) {
    console.error("checkout error", err);
    showToast("Checkout error");
  }
}

/* --- INIT: wire everything --- */
document.addEventListener("DOMContentLoaded", () => {
  // hook UI
  initMenu();
  initFilters();
  initNavAndOverlay();

  // Checkout button
  $("#checkoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    startCheckoutFlow();
  });

  // Make sure cartTotal element exists (sometimes templates differ)
  if (!$("#cartTotal")) {
    const el = document.createElement("span");
    el.id = "cartTotal";
    document.body.appendChild(el);
  }

  // Initial render
  renderCart();

  // helpful console status
  console.info("SH UI script loaded — cart ready");
});