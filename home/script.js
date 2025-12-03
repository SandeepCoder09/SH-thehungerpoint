// /home/script.js — Clean & Fully Fixed Cashfree v3 Flow

(() => {
  const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function showToast(msg, dur = 2500) {
    const wrap = $("#toast-container");
    if (!wrap) return alert(msg);
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), dur);
  }

  const auth = window.auth;

  let cart = [];
  const findItem = (id) => cart.findIndex((x) => x.id === id);

  const imageMap = {
    momo: "/home/sh-momo.png",
    finger: "/home/sh-french-fries.png",
    "hot tea": "/home/sh-hot-tea.png",
    tea: "/home/sh-hot-tea.png",
    "bread pakoda": "/home/sh-bread-pakoda.png",
  };
  const getImg = (name) => imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";

  function updateCartCount() {
    const b = $("#bottomCartBtn");
    if (!b) return;
    const n = cart.reduce((s, i) => s + i.qty, 0);
    b.setAttribute("data-count", n);
  }

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

    cart.forEach((i) => {
      total += i.qty * i.price;

      const row = document.createElement("div");
      row.className = "cart-item";

      row.innerHTML = `
        <img class="cart-img" src="${getImg(i.name)}" />
        <div class="cart-info" style="flex:1">
          <div class="cart-name">${i.name}</div>
          <div class="cart-sub">₹${i.price} × ${i.qty} = ₹${i.qty * i.price}</div>
        </div>
        <div class="cart-actions">
          <button class="c-dec" data-id="${i.id}">−</button>
          <span>${i.qty}</span>
          <button class="c-inc" data-id="${i.id}">+</button>
          <button class="c-rem" data-id="${i.id}">✕</button>
        </div>
      `;

      box.appendChild(row);
    });

    $("#cartTotal").textContent = "₹" + total;
    updateCartCount();
    attachCartButtons();
  }

  try {
    const s = localStorage.getItem("sh_cart_v1");
    if (s) cart = JSON.parse(s);
  } catch (e) {}

  function saveLocal() {
    try { localStorage.setItem("sh_cart_v1", JSON.stringify(cart)); } catch (e) {}
  }

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
        const price = Number(el.dataset.price) || 10;
        const id = name.toLowerCase().replace(/\s+/g, "-");

        const i = findItem(id);
        if (i >= 0) cart[i].qty += qty;
        else cart.push({ id, name, price, qty });

        showToast(`${qty} × ${name} added`);
        saveLocal();
        renderCart();

        qty = 1;
        disp.textContent = qty;
      };
    });
  }

  function attachCartButtons() {
    $$(".c-dec").forEach((b) => b.onclick = () => {
      const idx = findItem(b.dataset.id);
      if (idx >= 0) {
        cart[idx].qty = Math.max(1, cart[idx].qty - 1);
        saveLocal(); renderCart();
      }
    });

    $$(".c-inc").forEach((b) => b.onclick = () => {
      const idx = findItem(b.dataset.id);
      if (idx >= 0) {
        cart[idx].qty++; saveLocal(); renderCart();
      }
    });

    $$(".c-rem").forEach((b) => b.onclick = () => {
      cart = cart.filter((x) => x.id !== b.dataset.id);
      saveLocal(); renderCart();
    });
  }

  function flyToCart(img) {
    try {
      const r = img.getBoundingClientRect();
      const c = img.cloneNode(true);
      c.style.position = "fixed";
      c.style.left = r.left + "px";
      c.style.top = r.top + "px";
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
      c.style.transition = "all .7s ease";
      c.style.zIndex = 3000;
      document.body.appendChild(c);
      const target = $("#bottomCartBtn").getBoundingClientRect();
      requestAnimationFrame(() => {
        c.style.transform = `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(.2)`;
        c.style.opacity = "0";
      });
      setTimeout(() => c.remove(), 700);
    } catch (e) {}
  }

  $("#bottomCartBtn").onclick = () => {
    $("#overlay").classList.add("active");
    $("#cartSheet").classList.add("active");
    document.body.style.overflow = "hidden";
    renderCart();
  };

  $("#closeSheet").onclick =
  $("#overlay").onclick = () => {
    $("#overlay").classList.remove("active");
    $("#cartSheet").classList.remove("active");
    document.body.style.overflow = "";
  };

  $("#clearCart").onclick = () => {
    cart = []; saveLocal(); renderCart(); showToast("Cart cleared");
  };

  /* ---------- FIXED CASHFREE v3 CHECKOUT ---------- */
  $("#checkoutBtn").addEventListener("click", startCheckout);

  async function startCheckout() {
    if (!auth) return showToast("Auth not ready");
    if (cart.length === 0) return showToast("Cart is empty");

    const user = auth.currentUser;
    if (!user) return showToast("Please login");

    showToast("Starting payment...");

    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));

    const payload = { amount, items, phone: user.uid, email: user.email || "guest@sh.com" };

    let res;
    try {
      res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error(err);
      return showToast("Payment network error");
    }

    const data = await res.json().catch(() => ({}));
    console.log("Cashfree Response:", data);

    // 1) Preferred redirect URL flow
    if (data.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }

    // 2) Payment session flow using SDK
    if (data.ok && data.payment_session_id) {
      const cashfree = new Cashfree({
        paymentSessionId: data.payment_session_id
      });
      cashfree.redirect();
      return;
    }

    showToast("Payment initialization failed");
  }

  initMenu();
  renderCart();
})();
