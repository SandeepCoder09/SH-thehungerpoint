// ── MENU DATA ──────────────────────────────────────────────────
const MENU = [
  {
    id: 1,
    name: "Momo",
    emoji: "🥟",
    cat: "momos",
    price: 10,
    unit: "4 pcs",
    desc: "Steam-fresh dumplings — soft, juicy & spicy chutney.",
    badge: "bestseller",
    veg: true,
  },
  {
    id: 2,
    name: "Special Momo",
    emoji: "🥟",
    cat: "momos",
    price: 30,
    unit: "8 pcs",
    desc: "Loaded pan-fried momos with signature SH sauce.",
    badge: "new",
    veg: true,
  },
  {
    id: 3,
    name: "Fried Momo",
    emoji: "🥟",
    cat: "momos",
    price: 20,
    unit: "4 pcs",
    desc: "Golden crispy fried momos — extra crunch, extra love.",
    badge: null,
    veg: true,
  },
  {
    id: 4,
    name: "Finger Fries",
    emoji: "🍟",
    cat: "snacks",
    price: 10,
    unit: "plate",
    desc: "Double-fried crispy fries — perfect with ketchup.",
    badge: "bestseller",
    veg: true,
  },
  {
    id: 5,
    name: "Bread Pakoda",
    emoji: "🧆",
    cat: "snacks",
    price: 10,
    unit: "pcs",
    desc: "Crispy spiced batter bread — perfect chai snack.",
    badge: null,
    veg: true,
  },
  {
    id: 6,
    name: "Veg Roll",
    emoji: "🌯",
    cat: "snacks",
    price: 25,
    unit: "roll",
    desc: "Stuffed veg roll with chutney & onions — filling!",
    badge: "new",
    veg: true,
  },
  {
    id: 7,
    name: "Samosa",
    emoji: "🥙",
    cat: "snacks",
    price: 5,
    unit: "pcs",
    desc: "Crispy golden samosa — spiced potato filling.",
    badge: null,
    veg: true,
  },
  {
    id: 8,
    name: "Hot Tea",
    emoji: "🍵",
    cat: "tea",
    price: 10,
    unit: "cup",
    desc: "Masala or ginger — aromatic & warming.",
    badge: null,
    veg: true,
  },
  {
    id: 9,
    name: "Special Chai",
    emoji: "☕",
    cat: "tea",
    price: 15,
    unit: "cup",
    desc: "Thick SH special brew with cardamom & saffron.",
    badge: "special",
    veg: true,
  },
  {
    id: 10,
    name: "Cold Drink",
    emoji: "🥤",
    cat: "tea",
    price: 20,
    unit: "bottle",
    desc: "Chilled soda — refreshing with your order.",
    badge: null,
    veg: true,
  },
  {
    id: 11,
    name: "Combo Plate",
    emoji: "🍱",
    cat: "special",
    price: 40,
    unit: "plate",
    desc: "4 Momos + Fries + Chai — the full SH experience!",
    badge: "bestseller",
    veg: true,
  },
  {
    id: 12,
    name: "Family Pack",
    emoji: "🎁",
    cat: "special",
    price: 80,
    unit: "pack",
    desc: "8 Momos + 2 Chai + Samosa × 2 — perfect for sharing.",
    badge: "special",
    veg: true,
  },
];

// ── STATE ─────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem("sh_cart") || "[]");
let activeCat = "all";
let searchQ = "";

// ── RENDER MENU ───────────────────────────────────────────────
function renderMenu() {
  const grid = document.getElementById("menuGrid");
  const noRes = document.getElementById("noResults");
  const title = document.getElementById("menuTitle");
  const count = document.getElementById("itemCount");

  let items = MENU;
  if (activeCat !== "all") items = items.filter((i) => i.cat === activeCat);
  if (searchQ)
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQ) ||
        i.desc.toLowerCase().includes(searchQ),
    );

  const catNames = {
    all: "All Items",
    momos: "Momos",
    snacks: "Snacks",
    tea: "Drinks & Tea",
    special: "Special Combos",
  };
  title.textContent = catNames[activeCat] || "All Items";
  count.textContent = items.length + " item" + (items.length !== 1 ? "s" : "");

  if (!items.length) {
    grid.innerHTML = "";
    noRes.style.display = "block";
    document.getElementById("searchTerm").textContent = searchQ;
    return;
  }
  noRes.style.display = "none";

  grid.innerHTML = items
    .map((item) => {
      const inCart = cart.find((c) => c.id === item.id);
      const qty = inCart ? inCart.qty : 0;
      const badgeHtml = item.badge
        ? `<div class="food-badges"><span class="badge badge-${item.badge === "bestseller" ? "red" : item.badge === "new" ? "blue" : "orange"}">${item.badge}</span></div>`
        : "";
      return `
      <div class="food-card fade-up" data-id="${item.id}">
        <div class="food-img-wrap">
          <div class="food-img-placeholder">${item.emoji}</div>
          ${badgeHtml}
        </div>
        <div class="food-info">
          <div class="food-name">${item.name}</div>
          <div class="food-desc">${item.desc}</div>
          <div class="food-footer">
            <div class="food-price">₹${item.price} <span class="unit">/ ${item.unit}</span></div>
            ${
              qty === 0
                ? `<button class="add-btn" onclick="addItem(${item.id})">+ Add</button>`
                : `<div class="qty-control">
                  <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
                  <span class="qty-num">${qty}</span>
                  <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
                 </div>`
            }
          </div>
        </div>
      </div>`;
    })
    .join("");
}

// ── CART LOGIC ────────────────────────────────────────────────
function addItem(id) {
  const item = MENU.find((i) => i.id === id);
  const existing = cart.find((c) => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart();
  renderMenu();
  updateFab();
  showToast("🥟", item.name + " added to cart!");
}
function changeQty(id, delta) {
  const idx = cart.findIndex((c) => c.id === id);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
  renderMenu();
  updateFab();
}
function clearCart() {
  cart = [];
  saveCart();
  renderMenu();
  updateFab();
  closeCart();
  showToast("🗑️", "Cart cleared");
}
function saveCart() {
  localStorage.setItem("sh_cart", JSON.stringify(cart));
}

function updateFab() {
  const fab = document.getElementById("cartFab");
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const count = cart.reduce((s, c) => s + c.qty, 0);
  document.getElementById("fabCount").textContent = count;
  document.getElementById("fabTotal").textContent = "₹" + total;
  fab.classList.toggle("hidden", count === 0);
}

function openCart() {
  const overlay = document.getElementById("cartOverlay");
  const sheet = document.getElementById("cartSheet");
  const itemsEl = document.getElementById("cartItems");
  const summary = document.getElementById("cartSummary");
  overlay.classList.add("open");
  sheet.classList.add("open");

  if (!cart.length) {
    itemsEl.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🛒</div><h3>Cart is empty</h3><p>Add some delicious items from the menu!</p></div>';
    summary.style.display = "none";
    return;
  }
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  itemsEl.innerHTML = cart
    .map(
      (c) => `
    <div class="cart-item">
      <div class="cart-item-emoji">${c.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-price">₹${c.price} × ${c.qty} = <strong>₹${c.price * c.qty}</strong></div>
      </div>
      <div class="qty-control" style="background:var(--dark2)">
        <button class="qty-btn" onclick="changeQty(${c.id},-1);openCart()">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" onclick="changeQty(${c.id},1);openCart()">+</button>
      </div>
    </div>`,
    )
    .join("");
  summary.style.display = "block";
  document.getElementById("summaryItems").textContent = "₹" + total;
  document.getElementById("summaryTotal").textContent = "₹" + total;
}
function closeCart() {
  document.getElementById("cartOverlay").classList.remove("open");
  document.getElementById("cartSheet").classList.remove("open");
}
function checkout() {
  if (!cart.length) return;
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const order = {
    id: "SH" + Date.now(),
    items: [...cart],
    total,
    status: "preparing",
    time: new Date().toISOString(),
  };
  const orders = JSON.parse(localStorage.getItem("sh_orders") || "[]");
  orders.unshift(order);
  localStorage.setItem("sh_orders", JSON.stringify(orders));
  clearCart();
  closeCart();
  window.location.href = "../orders/orders.html";
}

// ── CATEGORIES ────────────────────────────────────────────────
document.getElementById("catTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-tab");
  if (!btn) return;
  document
    .querySelectorAll(".cat-tab")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeCat = btn.dataset.cat;
  renderMenu();
});

// ── SEARCH ────────────────────────────────────────────────────
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQ = e.target.value.toLowerCase().trim();
  renderMenu();
});

// ── TOAST ─────────────────────────────────────────────────────
function showToast(icon, msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.querySelector(".toast-icon").textContent = icon;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ── INIT ──────────────────────────────────────────────────────
renderMenu();
updateFab();
