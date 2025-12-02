/* ------------------------------------------
   SH - The Hunger Point
   FINAL JS for Bottom Sheet Cart (B1)
   Persist cart to server (cart collection) + local fallback
   ------------------------------------------ */

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

/* DOM helpers */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Toast */
function showToast(msg, dur = 2200) {
  const box = $("#toast-container");
  if (!box) return console.log("TOAST:", msg);
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

/* CART STATE */
let cart = [];
const findItem = (id) => cart.findIndex((i) => i.id === id);

/* IMAGE MAP */
const imageMap = {
  momo: "/home/sh-momo.png",
  finger: "/home/sh-french-fries.png",
  "hot tea": "/home/sh-hot-tea.png",
  tea: "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
};
function getImg(name) {
  return imageMap[name.toLowerCase()] || "/home/SH-Favicon.png";
}

/* UPDATE CART COUNT */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* RENDER CART */
function renderCart() {
  const box = $("#cartItems");
  if (!box) return;

  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal" ) && ($("#cartTotal").textContent = "₹0");
    updateCartCount();
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.qty;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.dataset.id = item.id;

    row.innerHTML = `
      <img class="cart-img" src="${getImg(item.name)}">
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>

      <div class="cart-actions">
        <button class="c-dec" data-id="${item.id}">−</button>
        <span>${item.qty}</span>
        <button class="c-inc" data-id="${item.id}">+</button>
        <button class="c-rem" data-id="${item.id}">✕</button>
      </div>
    `;

    box.appendChild(row);
  });

  $("#cartTotal").textContent = "₹" + total;

  updateCartCount();
  attachCartButtons();
}

/* ATTACH CART BUTTON EVENTS */
function attachCartButtons() {
  $$(".c-dec").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        await scheduleSaveCart();
      }
    })
  );

  $$(".c-inc").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
        await scheduleSaveCart();
      }
    })
  );

  $$(".c-rem").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      cart = cart.filter((x) => x.id !== id);
      renderCart();
      await scheduleSaveCart();
    })
  );
}

/* FLY TO CART ANIMATION */
function flyToCart(img) {
  if (!img) return;

  const r = img.getBoundingClientRect();
  const clone = img.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.left = r.left + "px";
  clone.style.top = r.top + "px";
  clone.style.width = r.width + "px";
  clone.style.height = r.height + "px";
  clone.style.borderRadius = "12px";
  clone.style.objectFit = "cover";
  clone.style.zIndex = 3000;
  clone.style.transition = "transform .75s ease, opacity .75s";
  document.body.appendChild(clone);

  const target = $("#bottomCartBtn").getBoundingClientRect();

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(.2)`;
    clone.style.opacity = "0";
  });

  setTimeout(() => clone.remove(), 800);
}

/* BOTTOM SHEET OPEN/CLOSE */
function openCartSheet() {
  $("#overlay").classList.add("active");
  $("#cartSheet").classList.add("active");
  document.body.style.overflow = "hidden";
  renderCart();
}

function closeCartSheet() {
  $("#overlay").classList.remove("active");
  $("#cartSheet").classList.remove("active");
  document.body.style.overflow = "";
}

$("#bottomCartBtn")?.addEventListener("click", openCartSheet);
$("#overlay")?.addEventListener("click", closeCartSheet);

/* FIX: ensure X button always works */
document.addEventListener("DOMContentLoaded", () => {
  const xBtn = document.getElementById("closeSheet");
  if (xBtn) {
    xBtn.addEventListener("click", closeCartSheet);
  }
});

/* --- AUTH / USER detection helpers --- */
/*
  This tries common places where your app might store the logged-in user or token.
  If your app has a different place (e.g. window.SH.user or a cookie), update getCurrentUserId/getAuthToken accordingly.
*/
function getCurrentUserId() {
  // try common globals
  if (window.SH && window.SH.user && window.SH.user.id) return window.SH.user.id;
  if (window.currentUser && window.currentUser.id) return window.currentUser.id;
  // try localStorage
  try {
    const uid = localStorage.getItem("userId") || localStorage.getItem("uid");
    if (uid) return uid;
    // maybe stored as JSON
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.id) return u.id;
    }
  } catch (e) {}
  return null;
}

function getAuthToken() {
  // token places
  if (window.SH && window.SH.token) return window.SH.token;
  if (window.currentUser && window.currentUser.token) return window.currentUser.token;
  try {
    return localStorage.getItem("authToken") || localStorage.getItem("token") || null;
  } catch (e) {
    return null;
  }
}

/* --- SERVER COMMUNICATION --- */
const SAVE_DEBOUNCE_MS = 700;
let saveTimeout = null;
let lastSavePromise = null;

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function saveCartToServer() {
  const userId = getCurrentUserId();
  if (!userId) {
    // no logged-in user detected -> persist locally
    try {
      localStorage.setItem("cart_fallback", JSON.stringify(cart));
    } catch (e) {}
    return false;
  }

  const payload = { userId, items: cart };

  try {
    const res = await fetch(`${SERVER_URL}/cart`, {
      method: "POST", // server should accept POST to create/update cart for user
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // server responded with error — fallback to localStorage
      try {
        localStorage.setItem("cart_fallback", JSON.stringify(cart));
      } catch (e) {}
      console.warn("Cart save failed:", res.status);
      return false;
    }

    // Optionally read response
    await res.json().catch(() => {});
    return true;
  } catch (err) {
    console.warn("Cart save error:", err);
    try {
      localStorage.setItem("cart_fallback", JSON.stringify(cart));
    } catch (e) {}
    return false;
  }
}

async function loadCartFromServer() {
  const userId = getCurrentUserId();
  // first try server if userId present
  if (userId) {
    try {
      const token = getAuthToken();
      const url = new URL(`${SERVER_URL}/cart`);
      url.searchParams.set("userId", userId);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: buildHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          cart = data.items.map((it) => ({
            id: it.id,
            name: it.name,
            price: it.price,
            qty: it.qty,
          }));
          renderCart();
          return true;
        }
      } else {
        console.warn("Load cart server responded:", res.status);
      }
    } catch (err) {
      console.warn("Load cart from server error:", err);
    }
  }

  // fallback: try localStorage saved cart (either from previous offline save or when user not detected)
  try {
    const raw = localStorage.getItem("cart_fallback");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cart = parsed;
        renderCart();
        return true;
      }
    }
  } catch (e) {}

  // nothing found -> empty cart
  cart = [];
  renderCart();
  return false;
}

/* Debounced save to avoid too many requests */
function scheduleSaveCart() {
  if (saveTimeout) clearTimeout(saveTimeout);
  return new Promise((resolve) => {
    saveTimeout = setTimeout(async () => {
      lastSavePromise = saveCartToServer();
      const ok = await lastSavePromise;
      saveTimeout = null;
      resolve(ok);
    }, SAVE_DEBOUNCE_MS);
  });
}

/* MENU ACTIONS (qty + add) */
function initMenu() {
  $$(".menu-item").forEach((el) => {
    const minus = el.querySelector(".qty-btn.minus");
    const plus = el.querySelector(".qty-btn.plus");
    const disp = el.querySelector(".qty-display");
    const add = el.querySelector(".add-cart-btn");
    const img = el.querySelector(".menu-img");

    let qty = 1;
    if (disp) disp.textContent = qty;

    minus?.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      if (disp) disp.textContent = qty;
    });

    plus?.addEventListener("click", () => {
      qty++;
      if (disp) disp.textContent = qty;
    });

    add?.addEventListener("click", async () => {
      flyToCart(img);

      const name = el.dataset.item;
      const price = Number(el.dataset.price) || PRICE_DEFAULT;
      const id = name.toLowerCase().replace(/\s+/g, "-");

      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, price, qty });

      showToast(`${qty} × ${name} added`);
      renderCart();

      // persist
      await scheduleSaveCart();

      qty = 1;
      if (disp) disp.textContent = qty;
    });
  });
}

/* SEARCH */
$("#menuSearch")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  $$(".menu-item").forEach((el) => {
    const name = (el.dataset.item || "").toLowerCase();
    const desc = (el.querySelector(".menu-desc")?.textContent || "").toLowerCase();
    el.style.display = name.includes(q) || desc.includes(q) ? "flex" : "none";
  });
});

/* CATEGORY FILTER */
$$(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    $$(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");

    const cat = chip.dataset.cat;
    $$(".menu-item").forEach((el) => {
      el.style.display = cat === "all" || el.dataset.cat === cat ? "flex" : "none";
    });
  })
);

/* CLEAR CART */
$("#clearCart")?.addEventListener("click", async () => {
  cart = [];
  renderCart();
  await scheduleSaveCart();
  showToast("Cart cleared");
});

/* CHECKOUT → CASHFREE */
$("#checkoutBtn")?.addEventListener("click", startCheckoutFlow);

async function startCheckoutFlow() {
  if (cart.length === 0) return showToast("Cart is empty");

  const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
  const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);

  try {
    showToast("Starting payment...");
    const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, items }),
    });

    const data = await res.json();
    if (!data.ok) return showToast(data.error || "Payment failed");

    const session = data.session;
    const orderId = data.orderId;

    if (window.Cashfree) {
      const cf = window.Cashfree;
      cf.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
    } else {
      return showToast("Cashfree SDK missing");
    }

    const handler = async (e) => {
      const msg = e.data;

      if (msg?.paymentStatus === "SUCCESS") {
        showToast("Payment verifying...");

        const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, items }),
        });

        const ok = await vr.json();
        if (ok?.ok) {
          showToast("Order Confirmed 🎉");
          // clear cart locally and on server
          cart = [];
          renderCart();
          await scheduleSaveCart();
          closeCartSheet();
        } else {
          showToast("Payment verify failed");
        }
      }
      window.removeEventListener("message", handler);
    };

    window.addEventListener("message", handler);
  } catch (err) {
    console.error(err);
    showToast("Checkout error");
  }
}

/* INIT */
document.addEventListener("DOMContentLoaded", async () => {
  initMenu();
  await loadCartFromServer(); // loads cart from server or fallback storage
  renderCart();
});