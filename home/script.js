/* ----------------------------------------------------
   SH - The Hunger Point
   FINAL SCRIPT WITH FIREBASE-FIRST INIT
-----------------------------------------------------*/

const SERVER_URL = "https://sh-thehungerpoint.onrender.com";
const PRICE_DEFAULT = 10;

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

/* Images */
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

/* Firebase UID detection */
function getCurrentUserId() {
  const f = firebase.auth().currentUser;
  if (f?.uid) return f.uid;

  const local = localStorage.getItem("userId");
  if (local) return local;

  return null;
}

/* Save cart */
async function saveCartToFirestore() {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    await db.collection("cart").doc(userId).set({
      items: cart,
      updatedAt: Date.now(),
    });
    console.log("🟢 Cart saved");
  } catch (err) {
    console.error("🔥 Firestore Save Error:", err);
  }
}

/* Load cart */
async function loadCartFromFirestore() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("❌ No UID... cannot load cart yet");
    return;
  }

  try {
    const snap = await db.collection("cart").doc(userId).get();
    if (snap.exists && Array.isArray(snap.data().items)) {
      cart = snap.data().items;
      console.log("🟢 Cart loaded from Firestore");
    } else {
      cart = [];
    }
  } catch (err) {
    console.error("🔥 Firestore Load Error:", err);
  }
}

/* Update cart count icon */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* Render cart UI */
function renderCart() {
  const box = $("#cartItems");
  if (!box) return;

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
  updateCartCount();
  attachCartButtons();
}

/* Cart item button events */
function attachCartButtons() {
  $$(".c-dec").forEach((b) =>
    b.onclick = () => {
      const i = findItem(b.dataset.id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        saveCartToFirestore();
      }
    }
  );

  $$(".c-inc").forEach((b) =>
    b.onclick = () => {
      const i = findItem(b.dataset.id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
        saveCartToFirestore();
      }
    }
  );

  $$(".c-rem").forEach((b) =>
    b.onclick = () => {
      cart = cart.filter((x) => x.id !== b.dataset.id);
      renderCart();
      saveCartToFirestore();
    }
  );
}

/* Fly to cart animation */
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

/* Bottom sheet */
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

$("#bottomCartBtn").onclick = openCartSheet;
$("#overlay").onclick = closeCartSheet;
$("#closeSheet")?.addEventListener("click", closeCartSheet);

/* Menu item buttons (Add, +, −) */
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

    add.onclick = () => {
      flyToCart(img);

      const name = el.dataset.item;
      const price = Number(el.dataset.price) || PRICE_DEFAULT;
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

/* Clear cart */
$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
  saveCartToFirestore();
  showToast("Cart cleared");
});

/* Checkout */
$("#checkoutBtn")?.addEventListener("click", startCheckoutFlow);

async function startCheckoutFlow() {
  if (cart.length === 0) return showToast("Cart empty");

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

    const { session, orderId } = data;

    if (window.Cashfree) {
      window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
    } else return showToast("Cashfree missing");

    const handler = async (e) => {
      if (e.data?.paymentStatus === "SUCCESS") {
        showToast("Verifying...");
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
          saveCartToFirestore();
          closeCartSheet();
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

/* ----------------------------------------------------
   FIREBASE-FIRST INITIALIZATION
-----------------------------------------------------*/

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    console.warn("❌ User NOT logged in — cart disabled");
    return;
  }

  console.log("🟢 Firebase User Ready:", user.uid);
  localStorage.setItem("userId", user.uid);

  initMenu();                 // ALL buttons attach AFTER Firebase ready
  await loadCartFromFirestore();  
  renderCart();
});
