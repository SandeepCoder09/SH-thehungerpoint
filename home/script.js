/* -------------------------------------------------------
   SH — The Hunger Point
   MAIN HOMEPAGE SCRIPT (SAFE REGENERATED VERSION)
--------------------------------------------------------- */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE = 10;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* -------------------------------------------------------
   TOAST SYSTEM (OLD CODE — PRESERVED)
--------------------------------------------------------- */
function showToast(msg, type="info", time=3000) {
  const container = $("#toast-container");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => el.remove(), time);
}

/* -------------------------------------------------------
   QUANTITY + ADD BUTTONS (OLD LOGIC + UPDATED)
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  $$(".menu-item").forEach(item => {
    const qtyEl = item.querySelector(".qty");
    const dec = item.querySelector("[data-action='dec']");
    const inc = item.querySelector("[data-action='inc']");
    const addBtn = item.querySelector(".add-cart-btn");

    let qty = 1;

    const setQty = (v) => {
      qty = Math.max(1, v);
      qtyEl.textContent = qty;
    };

    dec.onclick = () => setQty(qty - 1);
    inc.onclick = () => setQty(qty + 1);

    addBtn.onclick = () => addToCart(item, qty);
  });
});

/* -------------------------------------------------------
   ORDER CONFIRMED BOX CONTROL (IMPORTANT FIX)
--------------------------------------------------------- */
function hideOrderStatus() {
  const st = $("#order-status");
  if (st) st.classList.add("hidden");
}

function resetHomePage() {
  hideOrderStatus();
  const menu = document.querySelector(".menu");
  if (menu) menu.style.display = "grid";
}

/* -------------------------------------------------------
   DESKTOP TAB SWITCHING (NEW + SAFE)
--------------------------------------------------------- */
const tabs = $$(".tab");
const pages = $$(".page");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {

    tabs.forEach(t => t.classList.remove("active"));
    pages.forEach(p => p.style.display = "none");

    tab.classList.add("active");

    const target = tab.dataset.tab + "-page";
    document.querySelector("." + target).style.display = "block";

    // Hide Order Confirmed on page change
    hideOrderStatus();

    if (tab.dataset.tab === "home") resetHomePage();
  });
});

/* -------------------------------------------------------
   MOBILE BOTTOM NAV SWITCHING
--------------------------------------------------------- */
const bnItems = $$(".bn-item");

bnItems.forEach(item => {
  item.addEventListener("click", () => {

    bnItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    tabs.forEach(t => t.classList.remove("active"));
    pages.forEach(p => p.style.display = "none");

    const target = item.dataset.tab + "-page";
    document.querySelector("." + target).style.display = "block";

    hideOrderStatus();

    if (item.dataset.tab === "home") resetHomePage();
  });
});

/* -------------------------------------------------------
   CART SYSTEM (NEW, DOESN'T BREAK OLD CODE)
--------------------------------------------------------- */

let cart = [];

function updateCartUI() {
  $("#cartCount").textContent = cart.reduce((a, b) => a + b.qty, 0);

  const container = $("#cartItems");
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span>${item.name} × ${item.qty}</span>
      <strong>₹${item.qty * item.price}</strong>
    </div>
  `).join("");

  $("#cartTotal").textContent = "₹" + cart.reduce((a, b) => a + b.qty * b.price, 0);
}

function addToCart(item, qty) {
  const name = item.dataset.item;
  const price = PRICE;

  const existing = cart.find(i => i.name === name);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ name, qty, price });
  }

  updateCartUI();
  showToast(`${name} added to cart`, "success");
}

/* -------------------------------------------------------
   CART POPUP OPEN/CLOSE
--------------------------------------------------------- */
$("#openCart").onclick = () => {
  $("#cartPopup").classList.remove("hidden");
};

$("#closeCart").onclick = () => {
  $("#cartPopup").classList.add("hidden");
};

/* -------------------------------------------------------
   CHECKOUT (MULTI ITEM — PLACEHOLDER)
--------------------------------------------------------- */
$("#checkoutBtn").addEventListener("click", () => {
  if (cart.length === 0) {
    showToast("Your cart is empty!", "error");
    return;
  }

  console.log("Checkout Items:", cart);

  showToast("Redirecting to payment…", "info");

  // ⚠️ SAFE PLACEHOLDER — DOES NOT BREAK OLD CODE
  // You can add Razorpay multi-item order here
});

/* -------------------------------------------------------
   END
--------------------------------------------------------- */