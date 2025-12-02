/* ----------------------------------------------------
   SH - The Hunger Point
   GUARANTEED WORKING VERSION — WAITS FOR FIREBASE FIRST
-----------------------------------------------------*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ------------------------------------
   WAIT FOR FIREBASE TO BE READY
------------------------------------ */
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && firebase.auth && firebase.firestore) {
        resolve();
      } else {
        console.warn("⏳ Waiting for Firebase...");
        setTimeout(check, 50);
      }
    };
    check();
  });
}

/* Toast */
function showToast(msg, dur = 2200) {
  const box = $("#toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

/* CART STATE */
let cart = [];
const findItem = (id) => cart.findIndex((i) => i.id === id);

/* IMAGES */
const imageMap = {
  momo: "/home/sh-momo.png",
  finger: "/home/sh-french-fries.png",
  "hot tea": "/home/sh-hot-tea.png",
  tea: "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
};
const getImg = (name) => imageMap[name.toLowerCase()] || "/home/SH-Favicon.png";

/* UID */
function getCurrentUserId() {
  const u = firebase.auth().currentUser;
  return u ? u.uid : null;
}

/* SAVE CART */
async function saveCartToFirestore() {
  const uid = getCurrentUserId();
  if (!uid) return;

  await db.collection("cart").doc(uid).set({
    items: cart,
    updatedAt: Date.now(),
  });
  console.log("🟢 Cart saved");
}

/* LOAD CART */
async function loadCartFromFirestore() {
  const uid = getCurrentUserId();
  if (!uid) return;

  const snap = await db.collection("cart").doc(uid).get();
  if (snap.exists && snap.data().items) {
    cart = snap.data().items;
    console.log("🟢 Cart loaded");
  }
}

/* RENDER CART */
function updateCartCount() {
  $("#bottomCartBtn")?.setAttribute(
    "data-count",
    cart.reduce((s, i) => s + i.qty, 0)
  );
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

    box.innerHTML += `
      <div class="cart-item">
        <img class="cart-img" src="${getImg(item.name)}">
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
      </div>
    `;
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();
  attachCartButtons();
}

/* BUTTONS */
function attachCartButtons() {
  $$(".c-dec").forEach((btn) =>
    btn.onclick = () => {
      const i = findItem(btn.dataset.id);
      cart[i].qty = Math.max(1, cart[i].qty - 1);
      renderCart();
      saveCartToFirestore();
    }
  );

  $$(".c-inc").forEach((btn) =>
    btn.onclick = () => {
      const i = findItem(btn.dataset.id);
      cart[i].qty++;
      renderCart();
      saveCartToFirestore();
    }
  );

  $$(".c-rem").forEach((btn) =>
    btn.onclick = () => {
      cart = cart.filter((x) => x.id !== btn.dataset.id);
      renderCart();
      saveCartToFirestore();
    }
  );
}

/* MENU BUTTONS */
function initMenu() {
  $$(".menu-item").forEach((m) => {
    const minus = m.querySelector(".qty-btn.minus");
    const plus = m.querySelector(".qty-btn.plus");
    const disp = m.querySelector(".qty-display");
    const add = m.querySelector(".add-cart-btn");
    const img = m.querySelector(".menu-img");

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

    add.onclick = () => {
      const name = m.dataset.item;
      const price = Number(m.dataset.price) || PRICE_DEFAULT;
      const id = name.toLowerCase().replace(/\s+/g, "-");

      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, price, qty });

      showToast(`${qty} × ${name} added`);
      renderCart();
      saveCartToFirestore();

      qty = 1;
      disp.textContent = qty;
    };
  });
}

/* OPEN/CLOSE CART */
$("#bottomCartBtn").onclick = () => {
  $("#overlay").classList.add("active");
  $("#cartSheet").classList.add("active");
  renderCart();
};

$("#overlay").onclick = () => {
  $("#overlay").classList.remove("active");
  $("#cartSheet").classList.remove("active");
};

/* ----------------------------------------------------
   THE ONLY IMPORTANT PART:
   WAIT FOR FIREBASE → THEN RUN EVERYTHING
-----------------------------------------------------*/
(async () => {
  await waitForFirebase();

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("❌ User not logged in");
      return;
    }

    console.log("🟢 Firebase Ready, UID =", user.uid);

    initMenu();                 // buttons now safe
    await loadCartFromFirestore();
    renderCart();
  });
})();
