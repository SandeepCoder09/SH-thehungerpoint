// /home/script.js — Regenerated (Fullscreen embedded Cashfree drop-in, Production)

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

  /* ---------- PAY (EMBEDDED FULLSCREEN DROP-IN) ---------- */
  $("#checkoutBtn")?.addEventListener("click", startCheckout);

  async function startCheckout() {
    if (!auth) return showToast("Auth not ready");
    if (cart.length === 0) return showToast("Cart is empty");

    const user = auth.currentUser;
    if (!user) return showToast("Please login");

    showToast("Loading payment...");

    const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const items = cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));

    const payload = {
      amount,
      items,
      phone: user.uid,
      email: user.email || "guest@sh.com",
    };

    let res;
    try {
      res = await fetch(`${SERVER_URL}/create-cashfree-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Network create-order error:", err);
      return showToast("Payment network error");
    }

    const data = await res.json().catch(() => ({}));
    console.log("⬅ create-cashfree response:", data);

    // Preferred redirect flow (if backend returns hosted checkout)
    if (data.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }

    // Payment session flow: require payment_session_id
    if (!data.ok || !data.payment_session_id) {
      console.error("Missing payment_session_id or bad response:", data);
      return showToast("Payment initialization failed");
    }

    // CLOSE cart sheet (user requested)
    closeSheet();

    // Get fullscreen container (must exist in DOM)
    const cfBox = document.getElementById("cf-fullscreen");
    if (!cfBox) {
      console.error("cf-fullscreen container not found");
      return showToast("Payment UI error");
    }

    // Ensure container visible & sized BEFORE mounting drop-in
    cfBox.style.display = "block";
    cfBox.style.minHeight = "100vh";
    cfBox.style.padding = "20px";
    // Clear any placeholder content (Cashfree prefers a clean container)
    cfBox.innerHTML = "";

    // Add a lightweight loader while drop-in mounts
    const loader = document.createElement("div");
    loader.style.cssText = "text-align:center;margin:24px 0;font-weight:600;";
    loader.textContent = "Loading payment...";
    cfBox.appendChild(loader);

    try {
      // Create cashfree instance (production)
      const cashfree = Cashfree({ mode: "production" });

      // initialiseDropin may be async; wrap with Promise to support both callback or promise styles
      await new Promise((resolve, reject) => {
        try {
          const cb = async (event) => {
            // Cashfree drop-in events
            console.log("CF DROPIN EVENT:", event);

            // Remove loader on first event (UI mounted)
            if (loader && loader.parentNode) loader.remove();

            if (event?.type === "PAYMENT_SUCCESS") {
              // event.order.orderId is expected
              showToast("Verifying payment...");
              try {
                const vr = await fetch(`${SERVER_URL}/verify-cashfree-payment`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: event.order.orderId, items }),
                });
                const v = await vr.json().catch(() => ({}));
                if (v.ok) {
                  showToast("Order confirmed 🎉");
                  cart = [];
                  saveLocal();
                  renderCart();
                } else {
                  showToast("Verification failed");
                }
              } catch (err) {
                console.error("verify error:", err);
                showToast("Verification network error");
              } finally {
                // hide drop-in on success
                cfBox.style.display = "none";
                cfBox.innerHTML = "";
              }
            }

            if (event?.type === "PAYMENT_ERROR" || event?.type === "PAYMENT_CANCEL") {
              showToast("Payment failed or cancelled");
              cfBox.style.display = "none";
              cfBox.innerHTML = "";
            }
            // keep the drop-in active for other events; resolve once mounted
            if (event?.type === "UI_READY") {
              resolve(true);
            }
          };

          // Some Cashfree SDKs expect initialiseDropin to accept a container + options + callback
          // Others return a promise. We call with callback and also set a fallback timeout.
          cashfree.initialiseDropin(
            cfBox,
            {
              paymentSessionId: data.payment_session_id,
              redirectTarget: "_self",
              ui: { theme: "light" }
            },
            cb
          );

          // fallback: if UI_READY didn't fire within 8s, resolve anyway (but keep drop-in active)
          const fallback = setTimeout(() => {
            console.warn("CF dropin UI_READY timeout — proceeding anyway");
            try { if (loader && loader.parentNode) loader.remove(); } catch(e){}
            resolve(true);
          }, 8000);

          // clear fallback when promise resolved
          const originalResolve = resolve;
          resolve = (v) => { clearTimeout(fallback); originalResolve(v); };
        } catch (err) {
          reject(err);
        }
      });

    } catch (err) {
      console.error("DROPIN ERROR:", err);
      // cleanup and show message
      try { cfBox.style.display = "none"; cfBox.innerHTML = ""; } catch (e) {}
      return showToast("Payment UI error");
    }
  }

  // init
  initMenu();
  renderCart();
})();