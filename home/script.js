// /home/script.js
// FINAL WORKING VERSION – Firebase v10 + Cart + Buttons

/* ------------ IMPORTS ------------- */
import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ------------ INIT FIREBASE ------------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ------------ DOM HELPERS ------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ------------ CART ------------- */
let cart = [];

const findItem = (id) => cart.findIndex((x) => x.id === id);

function showToast(msg, dur = 2000) {
  const box = $("#toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

/* ------------ FIRESTORE CART SAVE/LOAD ------------- */
async function saveCart() {
  const u = auth.currentUser;
  if (!u) return;

  try {
    await setDoc(doc(db, "cart", u.uid), {
      items: cart,
      updatedAt: Date.now()
    });
    console.log("Cart saved");
  } catch (e) {
    console.error("Save error:", e);
  }
}

async function loadCart() {
  const u = auth.currentUser;
  if (!u) return;

  try {
    const snap = await getDoc(doc(db, "cart", u.uid));
    if (snap.exists()) {
      cart = snap.data().items || [];
      console.log("Cart loaded:", cart);
    } else {
      cart = [];
    }
  } catch (e) {
    console.error("Load error:", e);
  }
}

/* ------------ CART UI ------------- */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  const total = cart.reduce((s, x) => s + x.qty, 0);
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
    total += item.qty * item.price;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img class="cart-img" src="/home/SH-Favicon.png">
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty}</div>
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
  updateCartButtons();
  updateCartCount();
}

function updateCartButtons() {
  $$(".c-dec").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        await saveCart();
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
        await saveCart();
      }
    })
  );

  $$(".c-rem").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      cart = cart.filter((x) => x.id !== id);
      renderCart();
      await saveCart();
    })
  );
}

/* ------------ MENU ITEM BUTTONS ------------- */
function initMenu() {
  $$(".menu-item").forEach((el) => {
    const minus = el.querySelector(".qty-btn.minus");
    const plus = el.querySelector(".qty-btn.plus");
    const display = el.querySelector(".qty-display");
    const addBtn = el.querySelector(".add-cart-btn");

    let qty = 1;

    minus.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      display.textContent = qty;
    });

    plus.addEventListener("click", () => {
      qty++;
      display.textContent = qty;
    });

    addBtn.addEventListener("click", async () => {
      const name = el.dataset.item;
      const price = Number(el.dataset.price);
      const id = name.toLowerCase().replace(/\s+/g, "-");

      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, qty, price });

      showToast(`${qty} × ${name} added`);
      renderCart();
      await saveCart();

      qty = 1;
      display.textContent = qty;
    });
  });
}

/* ------------ CART SHEET ------------- */
$("#bottomCartBtn").addEventListener("click", () => {
  $("#overlay").classList.add("active");
  $("#cartSheet").classList.add("active");
  renderCart();
});

$("#overlay").addEventListener("click", () => {
  $("#overlay").classList.remove("active");
  $("#cartSheet").classList.remove("active");
});

/* ------------ FIREBASE-FIRST INIT ------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("Not logged in");
    initMenu(); // allow local button functionality
    return;
  }

  console.log("User logged:", user.uid);

  initMenu();
  await loadCart();
  renderCart();
});
