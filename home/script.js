/* Final Bottom-sheet script (B1) */
/* Replace file: /home/script.js
   - drag-down-to-close
   - overlay & close handlers
   - add-to-cart, qty, fly animation
   - checkout via server -> Cashfree
*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; // keep your render url
const PRICE_DEFAULT = 10;

/* DOM helpers */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* Toast */
function showToast(msg, d=2000) {
  const c = $("#toast-container");
  if (!c) { console.log(msg); return; }
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; c.appendChild(t);
  setTimeout(()=> t.remove(), d);
}

/* Cart state */
let cart = [];
const findCartIndex = id => cart.findIndex(c => c.id === id);
function updateSheetCount() {
  const txt = $("#cartCountText");
  if (!txt) return;
  const total = cart.reduce((s,i)=> s + i.qty, 0);
  txt.textContent = `${total} items`;
}

/* image map */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "hot tea": "/home/sh-hot-tea.png",
  "tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png"
};
function getImageFor(name){ return imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png"; }

/* render cart */
function renderCart() {
  const container = $("#cartItems");
  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = `<p class="muted">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateSheetCount();
    return;
  }
  let total = 0;
  cart.forEach(item => {
    total += item.qty * item.price;
    const node = document.createElement("div");
    node.className = "cart-item";
    node.dataset.id = item.id;
    node.innerHTML = `
      <img class="cart-img" src="${getImageFor(item.name)}" alt="${item.name}">
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${item.price*item.qty}</div>
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
  updateSheetCount();
  attachCartButtons();
}

/* attach cart buttons */
function attachCartButtons() {
  $$(".cart-dec").forEach(b => b.onclick = () => {
    const id = b.dataset.id; const idx = findCartIndex(id);
    if (idx>=0) { cart[idx].qty = Math.max(1, cart[idx].qty-1); renderCart(); }
  });
  $$(".cart-inc").forEach(b => b.onclick = () => {
    const id = b.dataset.id; const idx = findCartIndex(id);
    if (idx>=0) { cart[idx].qty += 1; renderCart(); }
  });
  $$(".cart-remove").forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    cart = cart.filter(c => c.id !== id);
    renderCart();
  });
}

/* open & close sheet */
function openSheet() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartSheet")?.classList.remove("hidden");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  renderCart();
}
function closeSheet() {
  $("#overlay")?.classList.add("hidden");
  $("#cartSheet")?.classList.add("hidden");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

/* overlay & control hooks */
function initOverlayControls() {
  $("#openCartBtn")?.addEventListener("click", () => openSheet());
  $("#overlay")?.addEventListener("click", () => closeSheet());
  $("#closeSheet")?.addEventListener("click", () => closeSheet());
  $("#clearCart")?.addEventListener("click", () => { cart = []; renderCart(); showToast("Cart cleared"); });
}

/* fly animation */
function flyToCart(imgEl) {
  if (!imgEl) return;
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
  clone.style.transition = "transform .7s cubic-bezier(.12,.82,.36,1), opacity .7s";
  document.body.appendChild(clone);
  const target = $("#openCartBtn").getBoundingClientRect();
  const dx = (target.left + target.width/2) - (rect.left + rect.width/2);
  const dy = (target.top + target.height/2) - (rect.top + rect.height/2);
  requestAnimationFrame(()=> {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(.18)`;
    clone.style.opacity = "0";
  });
  setTimeout(()=> clone.remove(), 800);
}

/* menu init */
function initMenu() {
  $$(".menu-item").forEach(itemEl => {
    const minus = itemEl.querySelector(".qty-btn.minus");
    const plus = itemEl.querySelector(".qty-btn.plus");
    const display = itemEl.querySelector(".qty-display");
    const addBtn = itemEl.querySelector(".add-cart-btn");
    let qty = 1;
    if (display) display.textContent = qty;
    minus?.addEventListener("click", ()=> { qty = Math.max(1, qty-1); if (display) display.textContent = qty; });
    plus?.addEventListener("click", ()=> { qty++; if (display) display.textContent = qty; });
    addBtn?.addEventListener("click", ()=> {
      flyToCart(itemEl.querySelector(".menu-img"));
      const name = itemEl.dataset.item || itemEl.querySelector(".menu-title")?.textContent || "Item";
      const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
      const id = name.toLowerCase().replace(/\s+/g,"-");
      const idx = findCartIndex(id);
      if (idx>=0) cart[idx].qty += qty; else cart.push({ id, name, price, qty });
      showToast(`${qty} × ${name} added`);
      renderCart();
      qty = 1; if (display) display.textContent = qty;
      // nudge scroll if near bottom
      setTimeout(()=> {
        const nearBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 60);
        if (nearBottom) window.scrollBy({ top: -120, behavior: "smooth" });
      }, 200);
    });
  });
}

/* search & chips */
function initFilters() {
  $("#menuSearch")?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase().trim();
    $$(".menu-item").forEach(it => {
      const name = (it.dataset.item||"").toLowerCase();
      const desc = (it.querySelector(".menu-desc")?.textContent||"").toLowerCase();
      it.style.display = (name.includes(q) || desc.includes(q)) ? "flex" : "none";
    });
  });
  $$(".chip").forEach(ch => ch.addEventListener("click", ()=> {
    $$(".chip").forEach(x=>x.classList.remove("active"));
    ch.classList.add("active");
    const cat = ch.dataset.cat;
    $$(".menu-item").forEach(it => it.style.display = (cat === "all" || it.dataset.cat === cat) ? "flex" : "none");
  }));
}

/* sheet drag to close (vertical) */
function initSheetDrag() {
  const sheet = $("#cartSheet");
  const handle = $("#sheetHandle") || sheet;
  if (!sheet) return;
  let startY = 0, currentY = 0, dragging = false;
  const sheetHeight = () => sheet.getBoundingClientRect().height;

  const touchStart = (e) => {
    dragging = true;
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    sheet.style.transition = "none";
  };
  const touchMove = (e) => {
    if (!dragging) return;
    currentY = (e.touches ? e.touches[0].clientY : e.clientY);
    const dy = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const touchEnd = (e) => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const dy = Math.max(0, currentY - startY);
    const thresh = sheetHeight() * 0.36; // threshold to close
    if (dy > thresh) closeSheet();
    else sheet.style.transform = ""; // snap back
  };

  handle.addEventListener("touchstart", touchStart, { passive:true });
  handle.addEventListener("touchmove", touchMove, { passive:true });
  handle.addEventListener("touchend", touchEnd);
  // support mouse for debugging on desktop
  handle.addEventListener("mousedown", (e)=> { e.preventDefault(); touchStart(e); document.addEventListener("mousemove", touchMove); document.addEventListener("mouseup", ()=> { touchEnd(); document.removeEventListener("mousemove", touchMove); }); });
}

/* checkout flow */
async function startCheckout() {
  if (cart.length === 0) { showToast("Cart is empty"); return; }
  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const amount = cart.reduce((s,i) => s + i.qty * i.price, 0);
  showToast("Starting payment...");
  try {
    const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
      method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ amount, items })
    });
    const data = await res.json();
    if (!data || data.ok === false) { console.error("create failed", data); showToast(data?.error || "Payment failed"); return; }
    const session = data.session || data.payment_session_id || data.data?.payment_session_id || data.data?.session;
    const orderId = data.orderId || data.order_id || data.data?.order_id || data.data?.order?.id || session;
    if (!session) { console.error("no session", data); showToast("Payment session missing"); return; }

    if (window.Cashfree && (window.Cashfree.checkout || typeof window.Cashfree === "function")) {
      try {
        if (window.Cashfree.checkout) window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
        else { const inst = window.Cashfree(); inst.checkout({ paymentSessionId: session, redirectTarget: "_modal" }); }
      } catch (err) { console.error("open cf", err); showToast("Failed to open payment"); return; }
    } else { showToast("Payment SDK not loaded"); console.warn("Cashfree missing"); return; }

    const handler = async (ev) => {
      try {
        const msg = ev.data || {};
        const success = msg.paymentStatus === "SUCCESS" || msg.paymentMessage === "SUCCESS" || (typeof msg === "string" && msg.toUpperCase().includes("SUCCESS"));
        const failed = msg.paymentStatus === "FAILED" || msg.paymentMessage === "FAILED" || (typeof msg === "string" && msg.toUpperCase().includes("FAILED"));
        if (success) {
          showToast("Verifying payment...");
          const vres = await fetch(`${SERVER_URL}/verify-cashfree-payment`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ orderId: orderId || session, items }) });
          const vdata = await vres.json();
          if (vdata && vdata.ok) {
            showToast("Payment success 🎉");
            cart = []; renderCart(); closeSheet();
          } else { showToast(vdata?.error || "Verification failed"); console.warn("verify fail", vdata); }
        } else if (failed) showToast("Payment failed or cancelled");
      } catch (err) { console.error("payment handler", err); showToast("Payment verification error"); }
      finally { window.removeEventListener("message", handler); }
    };
    window.addEventListener("message", handler, { once:true, passive:true });
  } catch (err) { console.error("checkout error", err); showToast("Checkout error"); }
}

/* init on DOM ready */
document.addEventListener("DOMContentLoaded", ()=> {
  initMenu(); initFilters(); initOverlayControls(); initSheetDrag();
  renderCart();

  // open cart btn
  $("#openCartBtn")?.addEventListener("click", openSheet);
  // checkout hook
  $("#checkoutBtn")?.addEventListener("click", (e)=> { e.preventDefault(); startCheckout(); });

  console.info("Bottom-sheet UI ready");
});