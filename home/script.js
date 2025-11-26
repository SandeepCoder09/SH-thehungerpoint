/* Final script: add-to-cart, search, filter, fly animation, checkout (Cashfree)
   SERVER_URL is set to your Render app below.
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; // <- your backend
const PRICE_DEFAULT = 10;

/* helpers */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(message, dur = 2500) {
  const out = $("#toast-container");
  if (!out) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  out.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

/* cart state */
let cart = [];
const findCartIndex = (id) => cart.findIndex(c => c.id === id);
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const n = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", n);
}

/* image map */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "tea": "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png"
};
function getImageFor(name){ return imageMap[name?.toLowerCase()] || ""; }

/* render cart */
function renderCart(){
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
        <button class="cart-dec" data-id="${item.id}">−</button>
        <span class="cart-qty">${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();
  attachCartButtons();
}

/* attach cart buttons */
function attachCartButtons(){
  $$(".cart-dec").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
      }
    };
  });
  $$(".cart-inc").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
      }
    };
  });
  $$(".cart-remove").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      cart = cart.filter(c => c.id !== id);
      renderCart();
    };
  });
}

/* open/close modal */
function openModal(){
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  renderCart();
}
function closeModal(){
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
}

/* fly animation */
function flyToCart(imgEl){
  if (!imgEl) return;
  const rect = imgEl.getBoundingClientRect();
  const clone = imgEl.cloneNode(true);
  clone.style.position = "fixed";
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";
  clone.style.zIndex = 9999;
  clone.style.borderRadius = "8px";
  clone.style.objectFit = "cover";
  clone.style.transition = "transform .7s cubic-bezier(.12,.82,.36,1), opacity .7s";
  document.body.appendChild(clone);

  const target = $("#bottomCartBtn").getBoundingClientRect();
  setTimeout(() => {
    const dx = (target.left + target.width/2) - (rect.left + rect.width/2);
    const dy = (target.top + target.height/2) - (rect.top + rect.height/2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    clone.style.opacity = "0";
  }, 20);

  setTimeout(()=> clone.remove(), 800);
}

/* init after DOM ready */
document.addEventListener("DOMContentLoaded", () => {

  // menu item handlers (qty + add)
  $$(".menu-item").forEach(itemEl => {
    const minus = itemEl.querySelector(".qty-btn.minus");
    const plus = itemEl.querySelector(".qty-btn.plus");
    const display = itemEl.querySelector(".qty-display");
    const addBtn = itemEl.querySelector(".add-cart-btn");

    let qty = 1;
    if (display) display.textContent = qty;

    minus?.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      display.textContent = qty;
    });

    plus?.addEventListener("click", () => {
      qty++;
      display.textContent = qty;
    });

    addBtn?.addEventListener("click", () => {
      // fly image
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
      // reset qty display to 1
      qty = 1;
      if (display) display.textContent = qty;
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
  $(".search-btn")?.addEventListener("click", ()=> $("#menuSearch")?.focus());

  // chips filter
  $$(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      $$(".menu-item").forEach(it => {
        it.style.display = (cat === "all" || it.dataset.cat === cat) ? "flex" : "none";
      });
    });
  });

  // bottom nav cart open
  $("#bottomCartBtn")?.addEventListener("click", openModal);
  $("#overlay")?.addEventListener("click", closeModal);
  $("#closeCart")?.addEventListener("click", closeModal);
  $("#closeOnlyBtn")?.addEventListener("click", closeModal);

  // clear cart
  $("#clearCart")?.addEventListener("click", () => {
    cart = [];
    renderCart();
  });

  // checkout flow (Cashfree)
  $("#checkoutBtn")?.addEventListener("click", async () => {
    if (cart.length === 0) { showToast("Cart is empty"); return; }

    const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
    const amount = cart.reduce((s,i)=> s + i.qty * i.price, 0);

    showToast("Starting payment...");

    try {
      const resp = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, items })
      });
      const data = await resp.json();
      if (!data || !data.ok) {
        console.error("create order failed", data);
        showToast(data?.error || "Payment start failed");
        return;
      }

      const session = data.session || data.payment_session_id || data.data?.payment_session_id || data.data?.session;
      const orderId = data.orderId || data.order_id || data.data?.order_id || data.data?.order?.id;

      if (!session) {
        console.error("no session", data);
        showToast("Payment session missing");
        return;
      }

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
          console.warn("Cashfree SDK not available");
          showToast("Payment SDK not loaded");
          return;
        }
      } catch (err) {
        console.error("open cashfree error", err);
        showToast("Payment failed to open");
        return;
      }

      // wait for message from Cashfree (once)
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
            // verify backend
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
              console.warn("verify not ok", vdata);
              showToast(vdata?.error || "Payment verification failed");
            }
          } else if (failed) {
            showToast("Payment failed or canceled");
          }
        } catch (err) {
          console.error("payment message handler error", err);
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

  // render initial
  renderCart();
});