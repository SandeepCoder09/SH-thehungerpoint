// /home/script.js
// FULL WORKING FINAL VERSION (Firebase v10 + Cart + Buttons + Payment)
// Defensive fixes + better logging

// Import Firebase objects from firebase-config.js
import { auth, db } from "/home/firebase-config.js";
import {
  onAuthStateChanged
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
  if (!box) {
    // fallback to console if toast container missing
    console.log("TOAST:", msg);
    return;
  }
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
  if (!box) return; // defensive
  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    const totalEl = $("#cartTotal");
    if (totalEl) totalEl.textContent = "₹0";
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
      <img class="cart-img" src="${getImg(item.name)}" alt="${item.name}">
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

  const totalEl = $("#cartTotal");
  if (totalEl) totalEl.textContent = "₹" + total;
  updateCartCount();
  attachCartButtons();
}

// ------------------------------
// Firestore SAVE/LOAD
// ------------------------------
async function saveCartToFirestore() {
  try {
    if (!auth || !auth.currentUser) {
      console.warn("saveCartToFirestore: no auth user");
      return;
    }
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
  try {
    if (!auth || !auth.currentUser) {
      console.warn("loadCartFromFirestore: no auth user");
      cart = [];
      return;
    }

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
    cart = [];
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
    if (disp) disp.textContent = qty;

    if (minus) minus.onclick = () => {
      qty = Math.max(1, qty - 1);
      if (disp) disp.textContent = qty;
    };

    if (plus) plus.onclick = () => {
      qty++;
      if (disp) disp.textContent = qty;
    };

    if (add) add.onclick = async () => {
      flyToCart(img);

      const name = el.dataset.item;
      const price = Number(el.dataset.price) || 10;
      const id = (name || "").toLowerCase().replace(/\s+/g, "-");

      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, price, qty });

      showToast(`${qty} × ${name} added`);
      renderCart();
      await saveCartToFirestore();

      qty = 1;
      if (disp) disp.textContent = qty;
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
  try {
    if (!img) return;
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

    const targetEl = $("#bottomCartBtn");
    if (!targetEl) {
      setTimeout(() => clone.remove(), 700);
      return;
    }
    const target = targetEl.getBoundingClientRect();

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${target.left - r.left}px, ${
        target.top - r.top
      }px) scale(.2)`;
      clone.style.opacity = "0";
    });

    setTimeout(() => clone.remove(), 700);
  } catch (err) {
    console.warn("flyToCart error:", err);
  }
}

const bottomBtn = $("#bottomCartBtn");
if (bottomBtn) {
  bottomBtn.onclick = () => {
    $("#overlay")?.classList.add("active");
    $("#cartSheet")?.classList.add("active");
    document.body.style.overflow = "hidden";
    renderCart();
  };
}

$("#overlay")?.addEventListener("click", closeSheet);
$("#closeSheet")?.addEventListener("click", closeSheet);

function closeSheet() {
  $("#overlay")?.classList.remove("active");
  $("#cartSheet")?.classList.remove("active");
  document.body.style.overflow = "";
}

// ------------------------------
// CLEAR CART
// ------------------------------
$("#clearCart")?.addEventListener("click", async () => {
  cart = [];
  renderCart();
  await saveCartToFirestore();
  showToast("Cart cleared");
});

// ------------------------------
// PAYMENT — Cashfree
// ------------------------------
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
    console.log("create-cashfree-order response:", data);

    // Helpful debug if server returned raw error
    if (!data.ok) {
      showToast(data.error || "Payment failed");
      // also show raw if present for debugging
      if (data.raw) console.error("Cashfree raw:", data.raw);
      return;
    }

    const session = data.session || data.paymentSessionId || data.payment_session_id;
    const orderId = data.orderId || data.order_id || data.data?.order_id;

    if (!session || !orderId) {
      console.error("Missing session/orderId:", data);
      showToast("Payment setup failed (missing session)");
      return;
    }

    if (window.Cashfree && typeof window.Cashfree.checkout === "function") {
      // try both property names depending on SDK expectations
      const payload = {
        paymentSessionId: session,
        sessionId: session,
        redirectTarget: "_modal",
      };

      try {
        window.Cashfree.checkout(payload);
      } catch (err) {
        console.warn("Cashfree.checkout threw, trying sessionId only", err);
        try {
          window.Cashfree.checkout({ sessionId: session, redirectTarget: "_modal" });
        } catch (err2) {
          console.error("Cashfree invocation failed:", err2);
          showToast("Payment popup failed");
          return;
        }
      }
    } else {
      console.error("Cashfree SDK missing on window:", window.Cashfree);
      return showToast("Cashfree SDK missing");
    }

    // Listen for popup postMessage result
    const handler = async (e) => {
      try {
        const msg = e.data;
        // Debug
        console.log("cashfree message:", msg);

        if (msg?.paymentStatus === "SUCCESS" || msg?.status === "SUCCESS") {
          showToast("Verifying payment...");

          const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, items }),
          });

          const ok = await vr.json();
          console.log("verify-cashfree-payment response:", ok);

          if (ok?.ok) {
            showToast("Order Confirmed 🎉");
            cart = [];
            renderCart();
            await saveCartToFirestore();
            closeSheet();
          } else {
            showToast("Verification failed");
            console.error("Verify failed:", ok);
          }
        }
      } catch (err) {
        console.error("message handler error:", err);
      } finally {
        window.removeEventListener("message", handler);
      }
    };

    window.addEventListener("message", handler);
  } catch (err) {
    console.error("Checkout error:", err);
    showToast("Checkout error");
  }
}

// ------------------------------
// AUTH FIRST → THEN UI
// ------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("❌ Not logged in");
    // keep menu interactive but do not allow checkout
    initMenu();
    renderCart();
    return;
  }

  console.log("🟢 Logged in:", user.uid);

  initMenu();
  await loadCartFromFirestore();
  renderCart();
});
