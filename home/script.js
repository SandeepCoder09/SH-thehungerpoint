// /home/script.js
// CLEAN • STABLE • FIXED FOR CASHFREE + FIREBASE v10

(() => {
  const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------------- Toast ---------------- */
  function showToast(msg, dur = 2000) {
    const wrap = $("#toast-container");
    if (!wrap) return alert(msg);
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), dur);
  }

  /* ---------------- Global Firebase ---------------- */
  const auth = window.auth;
  const db = window.db;
  if (!auth) console.warn("Firebase auth missing.");

  /* ---------------- Cart State ---------------- */
  let cart = [];
  const findItem = (id) => cart.findIndex((x) => x.id === id);

  const imageMap = {
    momo: "/home/sh-momo.png",
    finger: "/home/sh-french-fries.png",
    "hot tea": "/home/sh-hot-tea.png",
    tea: "/home/sh-hot-tea.png",
    "bread pakoda": "/home/sh-bread-pakoda.png",
  };

  const getImg = (name) =>
    imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";

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
        <div class="cart-info">
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

  /* -------- Cart localStorage -------- */
  try {
    const saved = localStorage.getItem("sh_cart_v1");
    if (saved) cart = JSON.parse(saved);
  } catch (e) {}

  function saveLocal() {
    try {
      localStorage.setItem("sh_cart_v1", JSON.stringify(cart));
    } catch (e) {}
  }

  /* ---------------- Menu Setup ---------------- */
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

  /* ---------------- Cart Buttons ---------------- */
  function attachCartButtons() {
    $$(".c-dec").forEach((b) => {
      b.onclick = () => {
        const i = findItem(b.dataset.id);
        if (i >= 0) {
          cart[i].qty = Math.max(1, cart[i].qty - 1);
          saveLocal();
          renderCart();
        }
      };
    });

    $$(".c-inc").forEach((b) => {
      b.onclick = () => {
        const i = findItem(b.dataset.id);
        if (i >= 0) {
          cart[i].qty++;
          saveLocal();
          renderCart();
        }
      };
    });

    $$(".c-rem").forEach((b) => {
      b.onclick = () => {
        cart = cart.filter((x) => x.id !== b.dataset.id);
        saveLocal();
        renderCart();
      };
    });
  }

  /* ---------------- Fly Effect ---------------- */
  function flyToCart(img) {
    try {
      if (!img) return;
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
    } catch {}
  }

  /* ---------------- Sheet Control ---------------- */
  $("#bottomCartBtn")?.addEventListener("click", () => {
    $("#overlay").classList.add("active");
    $("#cartSheet").classList.add("active");
    document.body.style.overflow = "hidden";
    renderCart();
  });

  $("#closeSheet")?.addEventListener("click", closeSheet);
  $("#overlay")?.addEventListener("click", closeSheet);

  function closeSheet() {
    $("#overlay").classList.remove("active");
    $("#cartSheet").classList.remove("active");
    document.body.style.overflow = "";
  }

  $("#clearCart")?.addEventListener("click", () => {
    cart = [];
    saveLocal();
    renderCart();
    showToast("Cart cleared");
  });

  /* ======================================================
     PAYMENT FLOW — FINAL FIXED VERSION
  ====================================================== */
  $("#checkoutBtn")?.addEventListener("click", startCheckout);

  async function startCheckout() {
    if (cart.length === 0) return showToast("Cart is empty");

    const user = auth.currentUser;
    if (!user) return showToast("Please login");

    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const items = cart.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price
    }));

    showToast("Starting payment...");

    const payload = {
      amount,
      items,
      phone: user.uid,          // safe alphanumeric → becomes customer_id
      email: user.email || "guest@sh.com"
    };

    console.log("➡️ create-cashfree payload:", payload);

    let res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data = await res.json().catch(() => ({}));

    console.log("⬅️ create-cashfree response:", data);

    if (!data.ok) {
      showToast("Payment failed");
      console.error("Cashfree raw:", data);
      return;
    }

    const session = data.session;
    const orderId = data.orderId;

    if (!session || !orderId) {
      showToast("Payment session missing");
      console.error("Missing:", data);
      return;
    }

    if (!window.Cashfree || typeof window.Cashfree.checkout !== "function") {
      showToast("Payment SDK missing");
      console.error("Cashfree SDK missing:", window.Cashfree);
      return;
    }

    try {
      window.Cashfree.checkout({
        paymentSessionId: session,
        redirectTarget: "_modal"
      });
    } catch (err) {
      console.error("Cashfree checkout error:", err);
      showToast("Payment popup error");
      return;
    }

    /* ---- Listen for result ---- */
    const handler = async (e) => {
      const msg = e.data;
      console.log("Cashfree message:", msg);

      if (msg?.paymentStatus === "SUCCESS") {
        showToast("Verifying payment...");

        const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, items })
        });

        const v = await vr.json().catch(() => ({}));
        console.log("Verify response:", v);

        if (v.ok) {
          showToast("Order Confirmed 🎉");
          cart = [];
          saveLocal();
          renderCart();
          closeSheet();
        } else {
          showToast("Verification failed");
        }
      }

      window.removeEventListener("message", handler);
    };

    window.addEventListener("message", handler);
  }

  /* ---------------- Init ---------------- */
  initMenu();
  renderCart();

})();
