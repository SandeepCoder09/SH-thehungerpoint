// /home/script.js
// FULL WORKING FINAL VERSION (Firebase v10 + Cart + Buttons + Payment)

// Import Firebase objects from firebase-config.js
import { auth, db } from "/home/firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ------------------------------
// Backend Server URL
// ------------------------------
const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

// ------------------------------
// Helpers
// ------------------------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function showToast(msg, dur = 2000) {
  const box = $("#toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// ------------------------------
// CART
// ------------------------------
let cart = [];

const findItem = (id) => cart.findIndex((i) => i.id === id);

const imageMap = {
  momo: "/home/sh-momo.png",
  finger: "/home/sh-french-fries.png",
  tea: "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
};

const getImg = (name) =>
  imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";

function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

function renderCart() {
  const box = $("#cartItems");
  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal").textContent = "₹0";
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
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${
      item.price * item.qty
    }</div>
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

// ------------------------------
// Firestore SAVE/LOAD
// ------------------------------
async function saveCartToFirestore() {
  if (!auth.currentUser) return;

  try {
    await setDoc(doc(db, "cart", auth.currentUser.uid), {
      items: cart,
      updatedAt: Date.now(),
    });

    console.log("🟢 Cart saved");
  } catch (err) {
    console.error("🔥 Save Cart Error:", err);
  }
}

async function loadCartFromFirestore() {
  if (!auth.currentUser) return;

  try {
    const snap = await getDoc(doc(db, "cart", auth.currentUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      cart = Array.isArray(data.items) ? data.items : [];
      console.log("🟢 Cart loaded");
    } else {
      cart = [];
    }
  } catch (err) {
    console.error("🔥 Load Cart Error:", err);
  }
}

// ------------------------------
// Menu Buttons
// ------------------------------
function initMenu() {
  $$(".menu-item").forEach((el) => {
    const minus = el.querySelector(".qty-btn.minus");
    const plus = el.querySelector(".qty-btn.plus");
    const disp = el.querySelector(".qty-display");
    const add = el.querySelector(".add-cart-btn");
    const img = el.querySelector(".menu-img");

    let qty = 1;
    disp.textContent = qty;

    minus.onclick = () => {
      qty = Math.max(1, qty - 1);
      disp.textContent = qty;
    };

    plus.onclick = () => {
      qty++;
      disp.textContent = qty;
    };

    add.onclick = async () => {
      flyToCart(img);

      const name = el.dataset.item;
      const price = Number(el.dataset.price) || 10;
      const id = name.toLowerCase().replace(/\s+/g, "-");

      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, price, qty });

      showToast(`${qty} × ${name} added`);
      renderCart();
      await saveCartToFirestore();

      qty = 1;
      disp.textContent = qty;
    };
  });
}

// ------------------------------
// Cart Buttons
// ------------------------------
function attachCartButtons() {
  $$(".c-dec").forEach((b) => {
    b.onclick = async () => {
      const i = findItem(b.dataset.id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        await saveCartToFirestore();
      }
    };
  });

  $$(".c-inc").forEach((b) => {
    b.onclick = async () => {
      const i = findItem(b.dataset.id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
        await saveCartToFirestore();
      }
    };
  });

  $$(".c-rem").forEach((b) => {
    b.onclick = async () => {
      cart = cart.filter((x) => x.id !== b.dataset.id);
      renderCart();
      await saveCartToFirestore();
    };
  });
}

// ------------------------------
// UI - Cart Sheet
// ------------------------------
function flyToCart(img) {
  const r = img.getBoundingClientRect();
  const clone = img.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.left = r.left + "px";
  clone.style.top = r.top + "px";
  clone.style.width = r.width + "px";
  clone.style.height = r.height + "px";
  clone.style.zIndex = 3000;
  clone.style.opacity = "1";
  clone.style.transition = "all .7s ease";
  document.body.appendChild(clone);

  const target = $("#bottomCartBtn").getBoundingClientRect();

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${target.left - r.left}px, ${
      target.top - r.top
    }px) scale(.2)`;
    clone.style.opacity = "0";
  });

  setTimeout(() => clone.remove(), 700);
}

$("#bottomCartBtn").onclick = () => {
  $("#overlay").classList.add("active");
  $("#cartSheet").classList.add("active");
  document.body.style.overflow = "hidden";
  renderCart();
};

$("#overlay").onclick = closeSheet;
$("#closeSheet").onclick = closeSheet;

function closeSheet() {
  $("#overlay").classList.remove("active");
  $("#cartSheet").classList.remove("active");
  document.body.style.overflow = "";
}

// ------------------------------
// CLEAR CART
// ------------------------------
$("#clearCart").onclick = async () => {
  cart = [];
  renderCart();
  await saveCartToFirestore();
  showToast("Cart cleared");
};

// ------------------------------
// PAYMENT — Cashfree
// ------------------------------
$("#checkoutBtn").onclick = startCheckoutFlow;

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
      window.Cashfree.checkout({
        paymentSessionId: session,
        redirectTarget: "_modal",
      });
    } else {
      return showToast("Cashfree SDK missing");
    }

    // Listen for popup result
    const handler = async (e) => {
      const msg = e.data;
      if (msg?.paymentStatus === "SUCCESS") {
        showToast("Verifying payment...");

        const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, items }),
        });

        const ok = await vr.json();

        if (ok?.ok) {
          showToast("Order Confirmed 🎉");

          cart = [];
          renderCart();
          await saveCartToFirestore();
          closeSheet();
        } else {
          showToast("Verification failed");
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

// ------------------------------
// AUTH FIRST → THEN UI
// ------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("❌ Not logged in");
    window.location.href = "/auth/login.html";
    return;
  }

  console.log("🟢 Logged in:", user.uid);

  initMenu();
  await loadCartFromFirestore();
  renderCart();
});
