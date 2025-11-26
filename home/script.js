/* ======================================================
   SH — FINAL PAYMENT + CART + UI SCRIPT
   Cashfree Integrated + Modal Checkout + No Redirects
   ====================================================== */

const SERVER_URL = "https://shhungerpoint.onrender.com"; // correct backend

/* Shortcuts */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Toast */
function showToast(msg, time = 2500) {
  const box = $("#toast-container");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), time);
}

/* CART STATE */
let cart = [];
const findCartIndex = (id) => cart.findIndex(x => x.id === id);

function updateCartCount() {
  const btn = $("#bottomCartBtn");
  const total = cart.reduce((s, i) => s + i.qty, 0);
  btn.setAttribute("data-count", total);
}

/* IMAGE MAP */
const imageMap = {
  "momo": "/home/sh-momo.png",
  "finger": "/home/sh-french-fries.png",
  "tea": "/home/sh-hot-tea.png",
  "hot tea": "/home/sh-hot-tea.png",
  "bread pakoda": "/home/sh-bread-pakoda.png"
};
function getImg(name) {
  return imageMap[name.toLowerCase()] || "";
}

/* ------------------ RENDER CART ------------------- */
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

  cart.forEach(item => {
    total += item.qty * item.price;

    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <img class="cart-img" src="${getImg(item.name)}" />
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-sub">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="cart-actions">
        <button class="cart-dec" data-id="${item.id}">−</button>
        <span class="cart-qty">${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}">✕</button>
      </div>
    `;

    box.appendChild(row);
  });

  $("#cartTotal").textContent = "₹" + total;
  updateCartCount();

  initCartButtons();
}

/* CART BUTTONS */
function initCartButtons() {
  $$(".cart-dec").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        renderCart();
      }
    };
  });

  $$(".cart-inc").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const i = findCartIndex(id);
      if (i >= 0) {
        cart[i].qty++;
        renderCart();
      }
    };
  });

  $$(".cart-remove").forEach(b => {
    b.onclick = () => {
      cart = cart.filter(c => c.id !== b.dataset.id);
      renderCart();
    };
  });
}

/* ------------------ CART MODAL ------------------- */
function openModal() {
  $("#overlay").classList.remove("hidden");
  $("#cartModal").classList.remove("hidden");
  renderCart();
}
function closeModal() {
  $("#overlay").classList.add("hidden");
  $("#cartModal").classList.add("hidden");
}
$("#overlay").onclick = closeModal;
$("#closeCart").onclick = closeModal;
$("#closeOnlyBtn").onclick = closeModal;

/* ------------------ ADD TO CART ------------------- */
$$(".menu-item").forEach(card => {
  const minus = card.querySelector(".qty-btn.minus");
  const plus = card.querySelector(".qty-btn.plus");
  const display = card.querySelector(".qty-display");
  const addBtn = card.querySelector(".add-cart-btn");

  let qty = 1;

  minus.onclick = () => {
    qty = Math.max(1, qty - 1);
    display.textContent = qty;
  };

  plus.onclick = () => {
    qty++;
    display.textContent = qty;
  };

  addBtn.onclick = () => {
    const name = card.dataset.item;
    const price = Number(card.dataset.price);
    const id = name.toLowerCase().replace(/\s+/g, "-");

    const i = findCartIndex(id);
    if (i >= 0) cart[i].qty += qty;
    else cart.push({ id, name, price, qty });

    showToast(`${qty} × ${name} added`);
    renderCart();
  };
});

/* ------------------ CHECKOUT → PAYMENT ------------------- */
$("#checkoutBtn").onclick = async () => {

  if (cart.length === 0) {
    showToast("Cart is empty");
    return;
  }

  const items = cart.map(i => ({
    name: i.name,
    qty: i.qty,
    price: i.price
  }));

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  showToast("Starting payment...");

  // 1. CREATE ORDER WITH BACKEND
  const createResp = await fetch(`${SERVER_URL}/create-cashfree-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: total, items })
  }).then(r => r.json());

  if (!createResp.ok) {
    showToast("Payment failed");
    return;
  }

  // 2. OPEN CASHFREE PAYMENT POPUP
  Cashfree.checkout({
    paymentSessionId: createResp.session,
    redirectTarget: "_modal"
  });

  // 3. WAIT PAYMENT RESULT
  window.addEventListener("message", async (ev) => {
    if (ev.data?.paymentStatus === "SUCCESS") {

      // VERIFY PAYMENT
      const verify = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: createResp.orderId, items })
      }).then(r => r.json());

      if (verify.ok) {
        showToast("Payment Successful 🎉");
        cart = [];
        renderCart();
        closeModal();
      } else {
        showToast("Verification failed");
      }
    }
  }, { once: true });
};

/* ------------------ BOTTOM CART BUTTON --------------- */
$("#bottomCartBtn").onclick = openModal;

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
});