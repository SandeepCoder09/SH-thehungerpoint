// /home/script.js
// FINAL — Firebase v10 + Cart + Firestore + Cashfree + defensive fixes + contact lookup

// ------------------------------
// Firebase Imports
// ------------------------------
import { auth, db } from "/home/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ------------------------------
// Backend Server URL
// ------------------------------
const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

// ------------------------------
// DOM Helpers
// ------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showToast(msg, dur = 2200) {
  const box = $("#toast-container");
  if (!box) { console.log("TOAST:", msg); return; }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// ------------------------------
// Cart state + helpers
// ------------------------------
let cart = [];
const findItem = (id) => cart.findIndex((x) => x.id === id);

const imageMap = {
  momo: "/home/sh-momo.png",
  finger: "/home/sh-french-fries.png",
  tea: "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png",
};
const getImg = (name) => imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";

function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + (i.qty || 0), 0);
  btn.setAttribute("data-count", total);
}

function renderCart() {
  const box = $("#cartItems");
  if (!box) return;
  box.innerHTML = "";

  if (!cart || cart.length === 0) {
    box.innerHTML = `<p class="empty">Cart is empty</p>`;
    const t = $("#cartTotal"); if (t) t.textContent = "₹0";
    updateCartCount();
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    total += (Number(item.price) || 0) * (Number(item.qty) || 0);

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

  const tEl = $("#cartTotal");
  if (tEl) tEl.textContent = "₹" + total;
  updateCartCount();
  attachCartButtons();
}

// ------------------------------
// Firestore save / load
// ------------------------------
async function saveCartToFirestore() {
  try {
    if (!auth || !auth.currentUser) { console.warn("saveCart: no auth user"); return; }
    await setDoc(doc(db, "cart", auth.currentUser.uid), {
      items: cart,
      updatedAt: Date.now(),
    });
    console.log("🟢 Cart saved");
  } catch (err) {
    console.error("Save Cart Error:", err);
  }
}

async function loadCartFromFirestore() {
  try {
    if (!auth || !auth.currentUser) { cart = []; console.warn("loadCart: no auth user"); return; }
    const snap = await getDoc(doc(db, "cart", auth.currentUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      cart = Array.isArray(data.items) ? data.items : [];
      console.log("🟢 Cart loaded", cart);
    } else {
      cart = [];
    }
  } catch (err) {
    console.error("Load Cart Error:", err);
    cart = [];
  }
}

// ------------------------------
// Menu initializers
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
      const name = el.dataset.item || "item";
      const price = Number(el.dataset.price) || 10;
      const id = (name || "item").toLowerCase().replace(/\s+/g, "-");
      const i = findItem(id);
      if (i >= 0) cart[i].qty += qty;
      else cart.push({ id, name, price, qty });
      showToast(`${qty} × ${name} added`);
      renderCart();
      await saveCartToFirestore();
      qty = 1; if (disp) disp.textContent = qty;
    };
  });
}

// ------------------------------
// Cart Button handlers
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
// Fly animation + sheet open/close
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
    clone.style.transition = "transform .7s ease, opacity .7s";
    document.body.appendChild(clone);

    const btn = $("#bottomCartBtn");
    if (!btn) { setTimeout(() => clone.remove(), 700); return; }
    const target = btn.getBoundingClientRect();

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(.2)`;
      clone.style.opacity = "0";
    });

    setTimeout(() => clone.remove(), 800);
  } catch (err) {
    console.warn("flyToCart error", err);
  }
}

$("#bottomCartBtn")?.addEventListener("click", () => {
  $("#overlay")?.classList.add("active");
  $("#cartSheet")?.classList.add("active");
  document.body.style.overflow = "hidden";
  renderCart();
});

$("#overlay")?.addEventListener("click", () => closeSheet());
$("#closeSheet")?.addEventListener("click", () => closeSheet());
function closeSheet() {
  $("#overlay")?.classList.remove("active");
  $("#cartSheet")?.classList.remove("active");
  document.body.style.overflow = "";
}

// ------------------------------
// Clear cart
// ------------------------------
$("#clearCart")?.addEventListener("click", async () => {
  cart = [];
  renderCart();
  await saveCartToFirestore();
  showToast("Cart cleared");
});

// ------------------------------
// Utility: fetch user contact (email/phone) from users collection
// ------------------------------
async function getUserContact() {
  try {
    if (!auth || !auth.currentUser) return { email: null, phone: null };
    const uid = auth.currentUser.uid;
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return { email: auth.currentUser.email || null, phone: null };
    }
    const data = snap.data() || {};
    return {
      email: data.email || auth.currentUser.email || null,
      phone: data.phone || data.mobile || null,
    };
  } catch (err) {
    console.error("getUserContact error:", err);
    return { email: auth.currentUser?.email || null, phone: null };
  }
}

// ------------------------------
// PAYMENT — Cashfree
// ------------------------------
$("#checkoutBtn")?.addEventListener("click", startCheckoutFlow);

async function startCheckoutFlow() {
  if (!cart || cart.length === 0) return showToast("Cart is empty");

  const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
  const amount = cart.reduce((s, i) => s + (i.qty * i.price || 0), 0);

  try {
    showToast("Starting payment...");

    // get user contact (email/phone) to satisfy Cashfree required fields
    const contact = await getUserContact();
    // fallback defaults if nothing available (Cashfree often requires phone)
    const phone = contact.phone || contact.email ? contact.phone : "9999999999";
    const email = contact.email || "guest@sh.com";

    const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        items,
        phone,
        email,
      }),
    });

    const data = await res.json();
    console.log("create-cashfree-order response:", data);

    if (!data || !data.ok) {
      showToast(data?.error || "Payment failed");
      if (data?.raw) console.error("Cashfree raw:", data.raw);
      return;
    }

    const session = data.session || data.paymentSessionId || data.payment_session_id || data.data?.payment_session_id;
    const orderId = data.orderId || data.order_id || data.data?.order_id;

    if (!session || !orderId) {
      console.error("Missing session/orderId:", data);
      showToast("Payment setup failed (missing session)");
      return;
    }

    if (!(window.Cashfree && typeof window.Cashfree.checkout === "function")) {
      console.error("Cashfree SDK missing:", window.Cashfree);
      showToast("Payment SDK missing");
      return;
    }

    // Try standard checkout call; handle SDK differences
    try {
      window.Cashfree.checkout({
        paymentSessionId: session,
        sessionId: session,
        redirectTarget: "_modal",
      });
    } catch (err) {
      console.warn("Cashfree.checkout call failed, trying sessionId only", err);
      try {
        window.Cashfree.checkout({ sessionId: session, redirectTarget: "_modal" });
      } catch (err2) {
        console.error("Cashfree invocation failed:", err2);
        showToast("Payment popup failed");
        return;
      }
    }

    // Listen for result from Cashfree popup via postMessage
    const handler = async (e) => {
      try {
        const msg = e.data;
        console.log("Cashfree message:", msg);

        // Accept multiple shapes
        const success = msg?.paymentStatus === "SUCCESS" || msg?.status === "SUCCESS" || msg?.txnStatus === "SUCCESS";

        if (success) {
          showToast("Verifying payment...");
          const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, items }),
          });
          const ok = await vr.json();
          console.log("verify-cashfree-payment:", ok);
          if (ok?.ok) {
            showToast("Order Confirmed 🎉");
            cart = [];
            renderCart();
            await saveCartToFirestore();
            closeSheet();
          } else {
            showToast("Verification failed");
            console.error("Verification failed:", ok);
          }
        } else {
          // Not success — log for debugging
          console.log("Cashfree returned non-success message:", msg);
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
// Auth-first initialization
// ------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("No auth user - menu interactive, checkout disabled");
    initMenu();
    renderCart();
    return;
  }
  console.log("Logged in:", user.uid);
  initMenu();
  await loadCartFromFirestore();
  renderCart();
});
