/* ==========================================================
   SH — The Hunger Point
   FINAL SCRIPT (NO SWIPE)
   ✔ Cart modal center animation
   ✔ Fly-to-cart animation
   ✔ Search filter
   ✔ Category filter
   ✔ Bottom cart button
   ✔ Checkout → Cashfree payment page redirect
   ========================================================== */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com"; 
const PRICE_DEFAULT = 10;

/* DOM shortcuts */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Toast */
function showToast(message, duration = 2500) {
  const wrap = $("#toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ---------------- CART STATE ------------------- */
let cart = [];
const findCartIndex = (id) => cart.findIndex((c) => c.id === id);

function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* Image map */
const imageMap = {
  momo: "/home/sh-momo.png",
  finger: "/home/sh-french-fries.png",
  tea: "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
};
function getImageFor(name) {
  return imageMap[name?.toLowerCase()] || "";
}

/* ---------------- RENDER CART ------------------- */
function renderCart() {
  const container = $("#cartItems");
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    total += item.qty * item.price;
    const img = getImageFor(item.name);

    const node = document.createElement("div");
    node.className = "cart-item";
    node.innerHTML = `
      <img src="${img}" class="cart-img" />
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="cart-actions">
        <button class="cart-dec" data-id="${item.id}">−</button>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}">✕</button>
      </div>
    `;
    container.appendChild(node);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();
  initCartButtons();
}

/* ---------------- CART BUTTON ACTIONS ------------------- */
function initCartButtons() {
  $$(".cart-dec").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
      }
    };
  });

  $$(".cart-inc").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
      }
    };
  });

  $$(".cart-remove").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      cart = cart.filter((c) => c.id !== id);
      renderCart();
    };
  });
}

/* ---------------- CART MODAL ------------------- */
function openModal() {
  $("#overlay").classList.remove("hidden");
  $("#cartModal").classList.remove("hidden");
  renderCart();
}

function closeModal() {
  $("#overlay").classList.add("hidden");
  $("#cartModal").classList.add("hidden");
}

$("#overlay")?.addEventListener("click", closeModal);
$("#closeCart")?.addEventListener("click", closeModal);
$("#closeOnlyBtn")?.addEventListener("click", closeModal);

/* ---------------- FLY ANIMATION ------------------- */
function flyToCart(img) {
  const rect = img.getBoundingClientRect();
  const clone = img.cloneNode(true);
  clone.className = "fly-img";

  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";

  document.body.appendChild(clone);

  const target = $("#bottomCartBtn").getBoundingClientRect();

  setTimeout(() => {
    clone.style.transform = `
      translate(${target.left - rect.left}px,
                ${target.top - rect.top}px)
      scale(0.2)
    `;
    clone.style.opacity = "0";
  }, 20);

  setTimeout(() => clone.remove(), 800);
}

/* ---------------- MENU ADD BUTTONS ------------------- */
$$(".menu-item").forEach((itemEl) => {
  const qtyDisplay = itemEl.querySelector(".qty-display");
  const minus = itemEl.querySelector(".qty-btn.minus");
  const plus = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  let qty = 1;

  minus.onclick = () => {
    qty = Math.max(1, qty - 1);
    qtyDisplay.textContent = qty;
  };

  plus.onclick = () => {
    qty++;
    qtyDisplay.textContent = qty;
  };

  addBtn.onclick = () => {
    flyToCart(itemEl.querySelector(".menu-img"));

    const name = itemEl.dataset.item;
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const idx = findCartIndex(id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added`);
    renderCart();
  };
});

/* ---------------- SEARCH FILTER ------------------- */
$("#menuSearch")?.addEventListener("input", (e) => {
  const val = e.target.value.toLowerCase();

  $$(".menu-item").forEach((item) => {
    const name = item.dataset.item.toLowerCase();
    const desc = item.querySelector(".menu-desc").textContent.toLowerCase();

    item.style.display = name.includes(val) || desc.includes(val) ? "flex" : "none";
  });
});

/* Tap search icon */
$(".search-btn")?.addEventListener("click", () => {
  $("#menuSearch").focus();
});

/* ---------------- CATEGORY FILTER ------------------- */
$$(".chip").forEach((chip) => {
  chip.onclick = () => {
    $$(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");

    const cat = chip.dataset.cat;

    $$(".menu-item").forEach((item) => {
      item.style.display = cat === "all" || item.dataset.cat === cat ? "flex" : "none";
    });
  };
});

/* ---------------- CHECKOUT → OPEN SERVER PAYMENT PAGE ------------------- */
$("#checkoutBtn")?.addEventListener("click", () => {
  if (cart.length === 0) return showToast("Cart is empty!");

  const items = encodeURIComponent(JSON.stringify(cart));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  window.location.href = `${SERVER_URL}?amount=${total}&items=${items}`;
});

/* ---------------- INIT ------------------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  $("#bottomCartBtn")?.addEventListener("click", openModal);
  renderCart();
});