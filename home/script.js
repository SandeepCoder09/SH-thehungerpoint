// /home/script.js
// Redirect checkout (same tab) flow.
// Assumes server /create-cashfree-order returns { ok:true, orderId, redirectUrl }
// Fallback: if you return session instead, and Cashfree SDK loads, we call Cashfree.checkout().

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
      if (disp) disp.textContent = qty;

      minus && (minus.onclick = () => {
        qty = Math.max(1, qty - 1);
        disp.textContent = qty;
      });

      plus && (plus.onclick = () => {
        qty++;
        disp.textContent = qty;
      });

      add && (add.onclick = () => {
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
      });
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
    } catch (e) {}
  }

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
    cart = []; saveLocal(); renderCart(); showToast("Cart cleared");
  });

  /* ---------- PAY (REDIRECT SAME-TAB) ---------- */
  $("#checkoutBtn")?.addEventListener("click", startCheckout);

  // Wait short time for SDK to appear (fallback only)
  function waitCashfreeSDK(timeoutMs = 3000) {
    return new Promise((res) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (window.Cashfree) { clearInterval(t); return res(true); }
        if (Date.now() - start > timeoutMs) { clearInterval(t); return res(false); }
      }, 120);
    });
  }

  async function startCheckout() {
    if (!auth) return showToast("Auth not ready");
    if (cart.length === 0) return showToast("Cart is empty");

    const user = auth.currentUser;
    if (!user) return showToast("Please login");

    showToast("Starting payment...");

    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));

    // build payload for backend
    const payload = { amount, items, phone: user.uid, email: user.email || "guest@sh.com" };
    console.log("➡ create-cashfree payload:", payload);

    let res;
    try {
      res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Network error:", err);
      return showToast("Payment network error");
    }

    let data = await res.json().catch(() => ({}));
    console.log("⬅ create-cashfree response:", data);

    if (!data.ok) {
      console.error("create-cashfree failed:", data);
      return showToast("Payment initialization failed");
    }

    // Preferred: backend returns redirectUrl to Cashfree-hosted checkout (same-tab)
    if (data.redirectUrl) {
      // navigate user to checkout (same tab)
      window.location.href = data.redirectUrl;
      return;
    }

    // Fallback: server returned session and orderId -> try SDK path
    if (data.session && data.orderId) {
      // Wait briefly for SDK then call checkout
      const sdkReady = await waitCashfreeSDK(3000);
      if (!sdkReady || !window.Cashfree || typeof window.Cashfree.checkout !== "function") {
        console.error("SDK not ready or not supported:", window.Cashfree);
        return showToast("Payment system not ready — try again in a moment");
      }

      try {
        window.Cashfree.checkout({
          paymentSessionId: data.session,
          redirectTarget: "_self" // attempted same-tab (if SDK supports)
        });
      } catch (err) {
        console.error("Cashfree checkout error:", err);
        return showToast("Checkout error");
      }
      return;
    }

    // If none of the above, show error
    console.error("No redirectUrl and no session/orderId present:", data);
    showToast("Payment configuration missing");
  }

  /* listen for post message verification (optional) */
  window.addEventListener("message", async (e) => {
    const msg = e.data;
    if (msg?.paymentStatus === "SUCCESS" && msg.orderId) {
      showToast("Verifying payment...");
      // optionally call server verify endpoint
      try {
        const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: msg.orderId })
        });
        const v = await vr.json().catch(()=>({}));
        if (v.ok) {
          showToast("Order confirmed 🎉");
          cart = []; saveLocal(); renderCart(); closeSheet();
        } else {
          showToast("Verification failed");
        }
      } catch (err) {
        console.error("verify network error", err);
      }
    }
  });

  // init
  initMenu();
  renderCart();

})();
