// script.js (ES module - uses exported auth + db from firebase-config.js)
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

/* ------------------------------------------
   SH - The Hunger Point
   FINAL JS (v10 modular)
------------------------------------------- */

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
  return imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";
}

/* --------------------------------------------------
   FIRESTORE HELPERS (v10 modular)
-------------------------------------------------- */
function getCurrentUserId() {
  const u = auth.currentUser;
  return u ? u.uid : null;
}

async function saveCartToFirestore() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("⚠ No UID during saveCart");
    return;
  }

  try {
    await setDoc(doc(db, "cart", userId), {
      items: cart,
      updatedAt: Date.now(),
    });
    console.log("🟢 Cart saved to Firestore");
  } catch (err) {
    console.error("🔥 Firestore Save Error:", err);
  }
}

async function loadCartFromFirestore() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("⚠ No UID during loadCart");
    cart = [];
    return;
  }

  try {
    const snap = await getDoc(doc(db, "cart", userId));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.items)) {
        cart = data.items;
        console.log("🟢 Cart loaded from Firestore");
      } else {
        cart = [];
      }
    } else {
      cart = [];
      console.log("ℹ No cart doc for user (fresh)");
    }
  } catch (err) {
    console.error("🔥 Firestore Load Error:", err);
    cart = [];
  }
}

/* --------------------------------------------------
   UI: render + buttons
-------------------------------------------------- */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

function renderCart() {
  const box = $("#cartItems");
  if (!box) return;

  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    $("#cartTotal")?.textContent = "₹0";
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

function attachCartButtons() {
  // remove previous handlers (safe reattach)
  $$(".c-dec").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        await saveCartToFirestore();
      }
    };
  });

  $$(".c-inc").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
        await saveCartToFirestore();
      }
    };
  });

  $$(".c-rem").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      cart = cart.filter((x) => x.id !== id);
      renderCart();
      await saveCartToFirestore();
    };
  });
}

/* --------------------------------------------------
   Fly animation + sheet controls
-------------------------------------------------- */
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
document.getElementById("closeSheet")?.addEventListener("click", closeCartSheet);

/* --------------------------------------------------
   Init menu (attach + / - / add)
-------------------------------------------------- */
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
      await saveCartToFirestore();

      qty = 1;
      if (disp) disp.textContent = qty;
    });
  });
}

/* --------------------------------------------------
   Clear / Checkout
-------------------------------------------------- */
$("#clearCart")?.addEventListener("click", async () => {
  cart = [];
  renderCart();
  await saveCartToFirestore();
  showToast("Cart cleared");
});

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
      window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
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
          cart = [];
          renderCart();
          await saveCartToFirestore();
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

/* --------------------------------------------------
   FIREBASE-FIRST INITIALIZATION
   Attach UI only after auth is known
-------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("❌ User not logged in — UI waiting for login");
    // Still attach menu qty controls so user can interact locally (optional)
    initMenu();
    renderCart();
    return;
  }

  console.log("🟢 Firebase user ready:", user.uid);

  // store UID locally for other parts (optional)
  localStorage.setItem("userId", user.uid);

  // Attach menu button handlers AFTER auth ready
  initMenu();

  // Load persisted cart & render
  await loadCartFromFirestore();
  renderCart();
});
