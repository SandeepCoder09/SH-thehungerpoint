/* ==========================================================
   SH — The Hunger Point
   FINAL SCRIPT WITH:
   ✔ Cart modal center animation
   ✔ Fly-to-cart animation
   ✔ Search filter
   ✔ Category filter
   ✔ Bottom cart button
   ✔ Swipe-to-delete
   ✔ Full cart rendering system
   ========================================================== */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

/* DOM shortcuts */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Toast system */
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
const findCartIndex = (id) => cart.findIndex(c => c.id === id);

/* Update total count on cart icon */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (btn) {
    const total = cart.reduce((s, i) => s + i.qty, 0);
    btn.setAttribute("data-count", total);
  }
}

/* Image lookup */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "tea": "/home/sh-hot-tea.png",
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

  cart.forEach(item => {
    total += item.qty * item.price;
    const img = getImageFor(item.name);

    const wrap = document.createElement("div");
    wrap.className = "cart-item-wrapper";

    wrap.innerHTML = `
      <div class="cart-swipe-bg">Delete</div>
      <div class="cart-item" data-id="${item.id}">
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
      </div>
    `;
    container.appendChild(wrap);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  initCartButtons();
  initSwipeToDelete();
}

/* ---------------- CART BUTTON ACTIONS ------------------- */
function initCartButtons() {
  $$(".cart-dec").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
      }
    };
  });

  $$(".cart-inc").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
      }
    };
  });

  $$(".cart-remove").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      cart = cart.filter(c => c.id !== id);
      renderCart();
    };
  });
}

/* ---------------- CART MODAL OPEN/CLOSE ------------------- */
function openModal() {
  $("#overlay")?.classList.remove("hidden");
  $("#cartModal")?.classList.remove("hidden");
  renderCart();
}

function closeModal() {
  $("#overlay")?.classList.add("hidden");
  $("#cartModal")?.classList.add("hidden");
}

$("#overlay")?.addEventListener("click", closeModal);
$("#closeCart")?.addEventListener("click", closeModal);
$("#closeOnlyBtn")?.addEventListener("click", closeModal);

/* ---------------- FLY IMAGE ANIMATION ------------------- */
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

/* ---------------- ADD BUTTON + QTY ------------------- */
$$(".menu-item").forEach(itemEl => {
  const qtyDisplay = itemEl.querySelector(".qty-display");
  const dec = itemEl.querySelector(".qty-btn.minus");
  const inc = itemEl.querySelector(".qty-btn.plus");
  const addBtn = itemEl.querySelector(".add-cart-btn");

  let qty = 1;

  dec.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    qtyDisplay.textContent = qty;
  });

  inc.addEventListener("click", () => {
    qty++;
    qtyDisplay.textContent = qty;
  });

  addBtn.addEventListener("click", () => {
    const img = itemEl.querySelector(".menu-img");
    if (img) flyToCart(img);

    const name = itemEl.dataset.item;
    const price = Number(itemEl.dataset.price) || PRICE_DEFAULT;
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const i = findCartIndex(id);
    if (i >= 0) cart[i].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added`);
    renderCart();
  });
});

/* ---------------- SEARCH FILTER ------------------- */
const searchInput = $("#menuSearch");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim().toLowerCase();

    $$(".menu-item").forEach(item => {
      const name = item.dataset.item.toLowerCase();
      const desc = item.querySelector(".menu-desc").textContent.toLowerCase();

      item.style.display = name.includes(val) || desc.includes(val)
        ? "flex"
        : "none";
    });
  });
}

$(".search-btn")?.addEventListener("click", () => {
  $("#menuSearch").focus();
});

/* ---------------- CATEGORY FILTER ------------------- */
$$(".chip").forEach(c => {
  c.addEventListener("click", () => {
    $$(".chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active");

    const cat = c.dataset.cat;
    $$(".menu-item").forEach(item => {
      item.style.display =
        cat === "all" || item.dataset.cat === cat ? "flex" : "none";
    });
  });
});

/* ---------------- SWIPE TO DELETE ------------------- */
function initSwipeToDelete() {
  const items = document.querySelectorAll(".cart-item");

  items.forEach(item => {
    let startX = 0;
    let moved = false;

    item.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      moved = false;
      item.classList.add("swipe-move");
    });

    item.addEventListener("touchmove", e => {
      const diff = e.touches[0].clientX - startX;
      if (diff < 0) {
        moved = true;
        item.style.transform = `translateX(${diff}px)`;
      }
    });

    item.addEventListener("touchend", () => {
      item.classList.remove("swipe-move");

      const diff = parseInt(item.style.transform.replace("translateX(", ""));

      if (moved && diff < -60) {
        item.classList.add("swiped");
        item.style.transform = "translateX(-80px)";
      } else {
        item.classList.remove("swiped");
        item.style.transform = "translateX(0px)";
      }
    });

    item.parentElement
      .querySelector(".cart-swipe-bg")
      .addEventListener("click", () => {
        const id = item.dataset.id;
        cart = cart.filter(c => c.id !== id);
        renderCart();
      });
  });
}

/* ---------------- BOTTOM CART BUTTON ------------------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#bottomCartBtn")?.addEventListener("click", openModal);
  renderCart();
});