/* ------------------------------------------
   SH - The Hunger Point
   FINAL JS for Bottom Sheet Cart (B1)
   Firestore Cart + Render Payment
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
  return imageMap[name.toLowerCase()] || "/home/SH-Favicon.png";
}

/* UPDATE CART COUNT */
function updateCartCount() {
  const btn = $("#bottomCartBtn");
  if (!btn) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* --------------------------------------------------
   FIX #1 — ALWAYS GET FIREBASE UID DIRECTLY
-------------------------------------------------- */
function getCurrentUserId() {
  const user = firebase.auth().currentUser;
  return user ? user.uid : null;
}

/* --------------------------------------------------
   FIRESTORE CART: SAVE
-------------------------------------------------- */
async function saveCartToFirestore() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("⚠ No UID during saveCart");
    return;
  }

  try {
    await db.collection("cart").doc(userId).set({
      items: cart,
      updatedAt: Date.now(),
    });

    console.log("🟢 Cart saved to Firestore");
  } catch (err) {
    console.error("🔥 Firestore Save Error:", err);
  }
}

/* --------------------------------------------------
   FIRESTORE CART: LOAD
-------------------------------------------------- */
async function loadCartFromFirestore() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("⚠ No UID during loadCart");
    return;
  }

  try {
    const snap = await db.collection("cart").doc(userId).get();

    if (snap.exists) {
      const data = snap.data();
      if (Array.isArray(data.items)) {
        cart = data.items;
        console.log("🟢 Cart loaded from Firestore");
      }
    } else {
      console.log("ℹ No cart found for this user");
    }
  } catch (err) {
    console.error("🔥 Firestore Load Error:", err);
  }
}

/* --------------------------------------------------
   RENDER CART UI
-------------------------------------------------- */
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

/* --------------------------------------------------
   CART BUTTON EVENT HANDLERS
-------------------------------------------------- */
function attachCartButtons() {
  $$(".c-dec").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
        saveCartToFirestore();
      }
    })
  );

  $$(".c-inc").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const i = findItem(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
        saveCartToFirestore();
      }
    })
  );

  $$(".c-rem").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      cart = cart.filter((x) => x.id !== id);
      renderCart();
      saveCartToFirestore();
    })
  );
}

/* --------------------------------------------------
   FLY TO CART
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

/* --------------------------------------------------
   CART SHEET OPEN/CLOSE
-------------------------------------------------- */
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

document.addEventListener("DOMContentLoaded", () => {
  const xBtn = document.getElementById("closeSheet");
  if (xBtn) xBtn.addEventListener("click", closeCartSheet);
});

/* --------------------------------------------------
   MENU + ADD TO CART
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

    add?.addEventListener("click", () => {
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
      if (disp) disp.textContent = qty;
    });
  });
}

/* --------------------------------------------------
   SEARCH + CATEGORY FILTER
-------------------------------------------------- */
$("#menuSearch")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  $$(".menu-item").forEach((el) => {
    const name = (el.dataset.item || "").toLowerCase();
    const desc = (el.querySelector(".menu-desc")?.textContent || "").toLowerCase();
    el.style.display = name.includes(q) || desc.includes(q) ? "flex" : "none";
  });
});

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

/* --------------------------------------------------
   CLEAR CART
-------------------------------------------------- */
$("#clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
  saveCartToFirestore();
  showToast("Cart cleared");
});

/* --------------------------------------------------
   PAYMENT USING RENDER SERVER
-------------------------------------------------- */
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
          saveCartToFirestore();
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
   INIT
-------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMenu();

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      console.log("🔐 UID ready:", user.uid);
      await loadCartFromFirestore();
      renderCart();
    }
  });
});
