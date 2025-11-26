/* Final script:
   - Add to cart + qty
   - fly-to-cart animation
   - search & category filter
   - cart modal above bottom nav (Material 3)
   - Cashfree checkout via your server
   - SERVER_URL set to your Render host
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; // your backend
const PRICE_DEFAULT = 10;

/* DOM helpers */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Toast */
function showToast(message, duration = 2200) {
  const container = $("#toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* Cart state */
let cart = [];
const findCartIndex = (id) => cart.findIndex(c => c.id === id);
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* small image map for cart thumbnails */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "tea": "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png"
};
function getImageFor(name) { return imageMap[name?.toLowerCase()] || ""; }

/* Render cart contents */
function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
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
    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
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
    container.appendChild(node);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();
  attachCartButtons();
}

/* Attach buttons in cart */
function attachCartButtons() {
  $$(".cart-dec").forEach(b => b.onclick = () => {
    const id = b.dataset.id; const idx = findCartIndex(id);
    if (idx >= 0) { cart[idx].qty = Math.max(1, cart[idx].qty - 1); renderCart(); }
  });
  $$(".cart-inc").forEach(b => b.onclick = () => {
    const id = b.dataset.id; const idx = findCartIndex(id);
    if (idx >= 0) { cart[idx].qty += 1; renderCart(); }
  });
  $$(".cart-remove").forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    cart = cart.filter(c => c.id !== id);
    renderCart();
  });
}

/* open / close modal */
function openModal() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  $("#cartModal").setAttribute("aria-hidden", "false");
  renderCart();
  // focus first interactive element for accessibility
  setTimeout(() => $("#checkoutBtn")?.focus(), 160);
}
function closeModal() {
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
  $("#cartModal").setAttribute("aria-hidden", "true");
}

/* Fly image animation */
function flyToCart(imgEl) {
  if (!imgEl) return;
  const rect = imgEl.getBoundingClientRect();
  const clone = imgEl.cloneNode(true);
  clone.style.position = "fixed";
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";
  clone.style.zIndex = 1200;
  clone.style.borderRadius = "10px";
  clone.style.objectFit = "cover";
  clone.style.transition = "transform .75s cubic-bezier(.12,.82,.36,1), opacity .75s";
  document.body.appendChild(clone);

  const target = $("#bottomCartBtn").getBoundingClientRect();
  setTimeout(() => {
    const dx = (target.left + target.width / 2) - (rect.left + rect.width / 2);
    const dy = (target.top + target.height / 2) - (rect.top + rect.height / 2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    clone.style.opacity = "0";
  }, 20);

  setTimeout(() => clone.remove(), 850);
}

/* DOM ready init */
document.addEventListener("DOMContentLoaded", () => {

  // attach menu handlers
  $$(".menu-item").forEach(itemEl => {
    const minus = itemEl.querySelector(".qty-btn.minus");
    const plus = itemEl.querySelector(".qty-btn.plus");
    const display = itemEl.querySelector(".qty-display");
    const addBtn = itemEl.querySelector(".add-cart-btn");

    let qty = 1;
    if (display) display.textContent = qty;

    minus?.addEventListener("click", () => { qty = Math.max(1, qty - 1); display.textContent = qty; });
    plus?.addEventListener("click", () => { qty++; display.textContent = qty; });

    addBtn?.addEventListener("click", () => {
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

      // reset qty to 1 and ensure content scrolls into view if necessary
      qty = 1; if (display) display.textContent = qty;

      // if add was near bottom, scroll slightly up so next controls aren't hidden
      setTimeout(() => {
        const bottom = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= bottom - 60) window.scrollBy({ top: -120, left: 0, behavior: "smooth" });
      }, 200);
    });
  });

  // search
  $("#menuSearch")?.addEventListener("input", (e) => {
    const val = (e.target.value || "").toLowerCase().trim();
    $$(".menu-item").forEach(it => {
      const name = it.dataset.item?.toLowerCase() || "";
      const desc = (it.querySelector(".menu-desc")?.textContent || "").toLowerCase();
      it.style.display = (name.includes(val) || desc.includes(val)) ? "flex" : "none";
    });
  });
  $(".search-btn")?.addEventListener("click", () => $("#menuSearch")?.focus());

  // category chips
  $$(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      $$(".menu-item").forEach(it => {
        it.style.display = (cat === "all" || it.dataset.cat === cat) ? "flex" : "none";
      });
      // if category reduces page height, ensure user can scroll again by resetting bottom padding (already handled by CSS)
    });
  });

  // bottom nav and modal controls
  $("#bottomCartBtn")?.addEventListener("click", openModal);
  $("#overlay")?.addEventListener("click", closeModal);
  $("#closeCart")?.addEventListener("click", closeModal);
  $("#closeOnlyBtn")?.addEventListener("click", closeModal);

  // clear cart
  $("#clearCart")?.addEventListener("click", () => { cart = []; renderCart(); });

  // CHECKOUT -> create-cashfree-order -> open cashfree modal -> verify
  $("#checkoutBtn")?.addEventListener("click", async () => {
    if (cart.length === 0) { showToast("Cart is empty"); return; }

    const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);

    showToast("Starting payment...");

    try {
      const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, items })
      });

      const data = await res.json();
      if (!data || !data.ok) {
        console.error("create-cashfree-order failed", data);
        showToast(data?.error || "Payment start failed");
        return;
      }

      const session = data.session || data.payment_session_id || data.data?.payment_session_id || data.data?.session;
      const orderId = data.orderId || data.order_id || data.data?.order_id || data.data?.order?.id;

      if (!session) { showToast("Payment session missing"); console.error("session missing", data); return; }

      // open Cashfree modal
      try {
        if (window.Cashfree && (window.Cashfree.checkout || typeof window.Cashfree === "function")) {
          if (window.Cashfree.checkout) {
            window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
          } else {
            const inst = window.Cashfree();
            inst.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
          }
        } else {
          showToast("Payment SDK not loaded");
          console.warn("Cashfree SDK not available");
          return;
        }
      } catch (err) {
        console.error("open cashfree error", err);
        showToast("Failed to open payment");
        return;
      }

      // listen once for message from Cashfree
      const handler = async (ev) => {
        try {
          const msg = ev.data || {};
          const success =
            msg.paymentStatus === "SUCCESS" ||
            (typeof msg === "string" && msg.toUpperCase().includes("SUCCESS")) ||
            msg.paymentMessage === "SUCCESS";
          const failed =
            msg.paymentStatus === "FAILED" ||
            (typeof msg === "string" && msg.toUpperCase().includes("FAILED")) ||
            msg.paymentMessage === "FAILED";

          if (success) {
            // verify with backend
            const verifyResp = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: orderId || session, items })
            });
            const vdata = await verifyResp.json();
            if (vdata && vdata.ok) {
              showToast("Payment successful 🎉");
              cart = [];
              renderCart();
              closeModal();
            } else {
              showToast(vdata?.error || "Verification failed");
              console.warn("verify failed", vdata);
            }
          } else if (failed) {
            showToast("Payment failed or cancelled");
          }
        } catch (err) {
          console.error("payment handler error", err);
          showToast("Payment verification error");
        } finally {
          window.removeEventListener("message", handler);
        }
      };

      window.addEventListener("message", handler, { once: true, passive: true });

    } catch (err) {
      console.error("checkout error", err);
      showToast("Payment error");
    }
  });

  // initial render
  renderCart();
});