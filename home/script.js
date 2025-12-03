// /home/script.js
// ES Module friendly client script — expects window.auth and window.db to be available
// Handles cart UI + Cashfree flow (defensive checks & logs)

(() => {
  const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function showToast(msg, dur = 2200) {
    const box = $("#toast-container");
    if (!box) {
      console.log("TOAST:", msg);
      return;
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), dur);
  }

  // Firebase objects from index.html
  const auth = window.auth;
  const db = window.db;
  if (!auth) console.warn("window.auth is missing — ensure index.html initialized Firebase");

  // Cart state
  let cart = [];
  try { const s = localStorage.getItem("sh_cart_v1"); if (s) cart = JSON.parse(s); } catch (e) { cart = []; }

  const imageMap = {
    momo: "/home/sh-momo.png",
    finger: "/home/sh-french-fries.png",
    "hot tea": "/home/sh-hot-tea.png",
    tea: "/home/sh-hot-tea.png",
    "bread pakoda": "/home/sh-bread-pakoda.png"
  };
  const getImg = (name) => imageMap[name?.toLowerCase()] || "/home/SH-Favicon.png";

  const findItem = (id) => cart.findIndex((i) => i.id === id);

  function updateCartCount() {
    const b = $("#bottomCartBtn");
    if (!b) return;
    const total = cart.reduce((s, i) => s + i.qty, 0);
    b.setAttribute("data-count", total);
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
    cart.forEach((it) => {
      total += it.qty * it.price;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img class="cart-img" src="${getImg(it.name)}" alt="${it.name}">
        <div class="cart-info">
          <div class="cart-name">${it.name}</div>
          <div class="cart-sub">₹${it.price} × ${it.qty} = ₹${it.qty * it.price}</div>
        </div>
        <div class="cart-actions">
          <button class="c-dec" data-id="${it.id}">−</button>
          <span>${it.qty}</span>
          <button class="c-inc" data-id="${it.id}">+</button>
          <button class="c-rem" data-id="${it.id}">✕</button>
        </div>
      `;
      box.appendChild(row);
    });

    $("#cartTotal").textContent = "₹" + total;
    updateCartCount();
    attachCartButtons();
  }

  function saveLocal() {
    try { localStorage.setItem("sh_cart_v1", JSON.stringify(cart)); } catch (e) {}
  }

  // menu wiring
  function initMenu() {
    $$(".menu-item").forEach((el) => {
      const minus = el.querySelector(".qty-btn.minus");
      const plus = el.querySelector(".qty-btn.plus");
      const disp = el.querySelector(".qty-display");
      const add = el.querySelector(".add-cart-btn");
      const img = el.querySelector(".menu-img");

      let qty = 1;
      if (disp) disp.textContent = qty;

      minus && (minus.onclick = () => { qty = Math.max(1, qty - 1); if (disp) disp.textContent = qty; });
      plus && (plus.onclick = () => { qty++; if (disp) disp.textContent = qty; });

      add && (add.onclick = () => {
        flyToCart(img);
        const name = el.dataset.item;
        const price = Number(el.dataset.price) || 10;
        const id = (name || "").toLowerCase().replace(/\s+/g, "-");
        const idx = findItem(id);
        if (idx >= 0) cart[idx].qty += qty;
        else cart.push({ id, name, price, qty });
        showToast(`${qty} × ${name} added`);
        saveLocal();
        renderCart();
        qty = 1;
        if (disp) disp.textContent = qty;
      });
    });
  }

  function attachCartButtons() {
    $$(".c-dec").forEach((b) => {
      b.onclick = () => {
        const i = findItem(b.dataset.id);
        if (i >= 0) { cart[i].qty = Math.max(1, cart[i].qty - 1); saveLocal(); renderCart(); }
      };
    });
    $$(".c-inc").forEach((b) => {
      b.onclick = () => {
        const i = findItem(b.dataset.id);
        if (i >= 0) { cart[i].qty++; saveLocal(); renderCart(); }
      };
    });
    $$(".c-rem").forEach((b) => {
      b.onclick = () => { cart = cart.filter((x) => x.id !== b.dataset.id); saveLocal(); renderCart(); };
    });
  }

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
      clone.style.transition = "all .7s ease";
      clone.style.zIndex = 3000;
      document.body.appendChild(clone);
      const target = $("#bottomCartBtn").getBoundingClientRect();
      requestAnimationFrame(() => {
        clone.style.transform = `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(.2)`;
        clone.style.opacity = "0";
      });
      setTimeout(() => clone.remove(), 700);
    } catch (err) { console.warn("fly error", err); }
  }

  $("#bottomCartBtn")?.addEventListener("click", () => {
    $("#overlay")?.classList.add("active");
    $("#cartSheet")?.classList.add("active");
    document.body.style.overflow = "hidden";
    renderCart();
  });
  $("#closeSheet")?.addEventListener("click", () => { $("#overlay")?.classList.remove("active"); $("#cartSheet")?.classList.remove("active"); document.body.style.overflow = ""; });
  $("#overlay")?.addEventListener("click", () => { $("#overlay")?.classList.remove("active"); $("#cartSheet")?.classList.remove("active"); document.body.style.overflow = ""; });

  $("#clearCart")?.addEventListener("click", () => { cart = []; saveLocal(); renderCart(); showToast("Cart cleared"); });

  /* ---------------- PAYMENT ---------------- */
  $("#checkoutBtn")?.addEventListener("click", startCheckout);

  async function startCheckout() {
    if (!cart.length) return showToast("Cart is empty");
    if (!auth || !auth.currentUser) return showToast("Please login to checkout");

    const user = auth.currentUser;
    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));

    showToast("Starting payment...");

    // send uid as phone so backend creates a safe customer_id
    const payload = { amount, items, phone: user.uid, email: user.email || undefined };

    console.log("create-cashfree payload:", payload);

    try {
      const res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      console.log("create-cashfree response:", data);

      if (!data.ok) {
        showToast(data.error || "Payment setup failed");
        console.error("Cashfree create failed:", data);
        return;
      }

      const session = data.session || data.paymentSessionId || data.payment_session_id;
      const orderId = data.orderId || data.order_id || data.data?.order_id;

      if (!session || !orderId) {
        showToast("Payment session missing");
        console.error("Missing session/orderId:", data);
        return;
      }

      if (!window.Cashfree || typeof window.Cashfree.checkout !== "function") {
        showToast("Payment SDK missing");
        console.error("Cashfree missing:", window.Cashfree);
        return;
      }

      // Launch Cashfree checkout
      try {
        window.Cashfree.checkout({ paymentSessionId: session, redirectTarget: "_modal" });
      } catch (err) {
        // fallback try
        try { window.Cashfree.checkout({ sessionId: session, redirectTarget: "_modal" }); }
        catch (err2) { console.error("Cashfree launch failed", err2); showToast("Payment popup failed"); return; }
      }

      // Listen for postMessage result
      const handler = async (e) => {
        try {
          const msg = e.data;
          console.log("Cashfree message:", msg);
          if (msg?.paymentStatus === "SUCCESS" || msg?.status === "SUCCESS") {
            showToast("Verifying payment...");
            const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, items })
            });
            const v = await vr.json().catch(() => ({}));
            console.log("verify response:", v);
            if (v.ok) {
              showToast("Order Confirmed 🎉");
              cart = [];
              saveLocal();
              renderCart();
              $("#overlay")?.classList.remove("active");
              $("#cartSheet")?.classList.remove("active");
            } else {
              showToast("Verification failed");
              console.error("verify failed:", v);
            }
          } else {
            console.log("Non-success message from Cashfree:", msg);
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

  // Init UI
  initMenu();
  renderCart();

  // optional: reload saved cart after login (if you want to sync with Firestore later)
  if (auth && auth.currentUser) {
    // you can implement Firestore load/save here if preferred
  } else if (auth) {
    auth.onAuthStateChanged((u) => {
      if (u) {
        console.log("User signed in:", u.uid);
      }
    });
  }
})();
