// /home/script.js — Fixed cart + UI behaviour (modular-friendly, uses window.auth/window.db)
// Keep this file under /home/script.js (same path you already use)

(() => {
  const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function showToast(msg, dur = 2500) {
    const wrap = $("#toast-container");
    if (!wrap) {
      // Fallback
      console.log("toast:", msg);
      return;
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    wrap.appendChild(t);
    // small show animation if CSS present
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 220);
    }, dur);
  }

  // Use modular auth exposed on window by /auth/sh-auth.js or your inline init
  const auth = window.auth;

  // cart state
  let cart = [];
  const CART_KEY = "sh_cart_v1";

  const findItem = (id) => cart.findIndex((x) => x.id === id);

  const imageMap = {
    momo: "/home/sh-momo.png",
    finger: "/home/sh-french-fries.png",
    "hot tea": "/home/sh-hot-tea.png",
    tea: "/home/sh-hot-tea.png",
    "bread pakoda": "/home/sh-bread-pakoda.png",
  };
  const getImg = (name) => imageMap[(name || "").toLowerCase()] || "/home/SH-Favicon.png";

  // load initial cart from localStorage
  (function loadLocal() {
    try {
      const s = localStorage.getItem(CART_KEY);
      if (s) cart = JSON.parse(s) || [];
    } catch (e) {
      console.warn("Failed to parse cart:", e);
    }
  })();

  function saveLocal() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      // notify other tabs / listeners
      window.dispatchEvent(new Event("storage"));
      // custom app event
      document.dispatchEvent(new CustomEvent("cart-updated"));
    } catch (e) {
      console.warn("saveLocal failed", e);
    }
  }

  function updateCartCountUI() {
    const b = $("#bottomCartBtn");
    if (b) {
      const n = cart.reduce((s, i) => s + (i.qty || 0), 0);
      b.setAttribute("data-count", String(n));
      // update explicit badge if present
      const badge = document.getElementById("cartBadge");
      if (badge) {
        badge.textContent = n;
        badge.style.display = n > 0 ? "block" : "none";
      }
    }
  }

  function attachCartButtons() {
    // attach to items inside cart sheet
    $$(".c-dec").forEach((b) => {
      b.onclick = (ev) => {
        const id = b.dataset.id;
        const idx = findItem(id);
        if (idx >= 0) {
          cart[idx].qty = Math.max(1, (cart[idx].qty || 1) - 1);
          saveLocal();
          renderCart();
        }
        ev.stopPropagation?.();
      };
    });

    $$(".c-inc").forEach((b) => {
      b.onclick = (ev) => {
        const id = b.dataset.id;
        const idx = findItem(id);
        if (idx >= 0) {
          cart[idx].qty = (cart[idx].qty || 0) + 1;
          saveLocal();
          renderCart();
        }
        ev.stopPropagation?.();
      };
    });

    $$(".c-rem").forEach((b) => {
      b.onclick = (ev) => {
        const id = b.dataset.id;
        cart = cart.filter((x) => x.id !== id);
        saveLocal();
        renderCart();
        ev.stopPropagation?.();
      };
    });
  }

  function renderCart() {
    const box = $("#cartItems");
    if (!box) return;

    box.innerHTML = "";

    if (!cart.length) {
      box.innerHTML = `<p class="empty">Cart is empty</p>`;
      $("#cartTotal") && ($("#cartTotal").textContent = "₹0");
      updateCartCountUI();
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
          <span class="cart-qty">${i.qty}</span>
          <button class="c-inc" data-id="${i.id}">+</button>
          <button class="c-rem" data-id="${i.id}" title="Remove">✕</button>
        </div>
      `;

      box.appendChild(row);
    });

    $("#cartTotal") && ($("#cartTotal").textContent = "₹" + total);
    updateCartCountUI();
    attachCartButtons();
  }

  // INIT menu interactions (qty +/- and add)
  function initMenu() {
    $$(".menu-item").forEach((el) => {
      const minus = el.querySelector(".qty-btn.minus");
      const plus = el.querySelector(".qty-btn.plus");
      const disp = el.querySelector(".qty-display");
      const add = el.querySelector(".add-cart-btn");
      const img = el.querySelector(".menu-img");

      let qty = 1;
      if (disp) disp.textContent = qty;

      if (minus) {
        minus.onclick = (ev) => {
          qty = Math.max(1, qty - 1);
          if (disp) disp.textContent = qty;
          ev.stopPropagation?.();
        };
      }
      if (plus) {
        plus.onclick = (ev) => {
          qty++;
          if (disp) disp.textContent = qty;
          ev.stopPropagation?.();
        };
      }

      if (add) {
        add.onclick = (ev) => {
          // animation
          flyToCart(img);

          const name = el.dataset.item;
          const price = Number(el.dataset.price) || 10;
          const id = (name || "").toLowerCase().replace(/\s+/g, "-");

          const idx = findItem(id);
          if (idx >= 0) cart[idx].qty = (cart[idx].qty || 0) + qty;
          else cart.push({ id, name, price, qty });

          showToast(`${qty} × ${name} added`);
          saveLocal();
          renderCart();

          // reset
          qty = 1;
          if (disp) disp.textContent = qty;

          ev.stopPropagation?.();
        };
      }
    });
  }

  // Smooth flying animation to cart
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
      clone.style.transition = "transform .7s ease, opacity .7s ease";
      clone.style.zIndex = 3000;
      document.body.appendChild(clone);

      const targetEl = $("#bottomCartBtn");
      const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth - 40, top: window.innerHeight - 40 };

      requestAnimationFrame(() => {
        const dx = targetRect.left - r.left;
        const dy = targetRect.top - r.top;
        clone.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
        clone.style.opacity = "0";
      });

      setTimeout(() => clone.remove(), 750);
    } catch (e) {
      // silent
    }
  }

  // Safe overlay open/close helpers (avoid CSS-only reliance)
  function openCartSheet() {
    const overlay = $("#overlay");
    const sheet = $("#cartSheet");

    if (overlay) {
      overlay.style.display = "block";
      overlay.style.pointerEvents = "auto";
      overlay.classList.add("active");
    }
    if (sheet) {
      sheet.classList.add("active");
      // ensure it's visible even if CSS missing
      sheet.style.bottom = "0";
    }
    document.body.style.overflow = "hidden";
    renderCart();
  }

  function closeCartSheet() {
    const overlay = $("#overlay");
    const sheet = $("#cartSheet");
    if (overlay) {
      overlay.classList.remove("active");
      // hide after small delay to allow CSS fade (if any)
      overlay.style.pointerEvents = "none";
      overlay.style.display = "none";
    }
    if (sheet) {
      sheet.classList.remove("active");
      sheet.style.bottom = "";
    }
    document.body.style.overflow = "";
  }

  // Attach open/close buttons
  (function attachSheetControls() {
    const bottom = $("#bottomCartBtn");
    if (bottom) {
      bottom.addEventListener("click", openCartSheet);
    }
    const closeBtn = $("#closeSheet");
    if (closeBtn) closeBtn.addEventListener("click", closeCartSheet);
    const overlay = $("#overlay");
    if (overlay) overlay.addEventListener("click", closeCartSheet);
  })();

  // clear cart
  $("#clearCart")?.addEventListener("click", () => {
    cart = [];
    saveLocal();
    renderCart();
    showToast("Cart cleared");
  });

  // Checkout flow (Cashfree)
  $("#checkoutBtn")?.addEventListener("click", startCheckout);

  async function startCheckout() {
    if (!auth) {
      return showToast("Auth not ready");
    }
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
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Network error:", err);
      return showToast("Payment network error");
    }

    const data = await res.json().catch(() => ({}));
    console.log("Cashfree response:", data);

    if (!data.ok || !data.payment_session_id) {
      console.error("Bad session:", data);
      return showToast("Payment initialization failed");
    }

    try {
      const cf = Cashfree({ mode: "production" });
      cf.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: "_self" });
      return;
    } catch (err) {
      console.error("Cashfree SDK error:", err);
      return showToast("Payment system not ready — try again");
    }
  }

  /* =====================================================
     LANG ENGINE — ENGLISH <-> HINDI (FULL AUTO)
  ==================================================== */

  // Master dictionary (kept short for performance)
  const DICT = {
    "Fresh & Fast": "ताज़ा और फास्ट",
    "Local favorites served hot — tap to add, order in seconds.": "गरमा-गरम स्थानीय पसंद — टैप करें और सेकंडों में ऑर्डर करें।",
    "Search dishes (momo, tea…)": "व्यंजन खोजें (मोमो, चाय…)",
    "All": "सभी",
    "Momos": "मोमोज़",
    "Snacks": "नाश्ता",
    "Tea": "चाय",
    "Special": "विशेष",
    "Momo": "मोमो",
    "Finger": "फ्रेंच फ्राइज",
    "Hot Tea": "गरम चाय",
    "Bread Pakoda": "ब्रेड पकोड़ा",
    "Steam-fresh dumplings — soft, juicy & spicy chutney.": "स्टीम मोमो — नरम, रसीले और मसालेदार चटनी के साथ।",
    "Crispy fries, double-fried — tasty with ketchup.": "कुरकुरे फ्राइज — केचप के साथ स्वादिष्ट।",
    "Masala or ginger — aromatic & warming.": "मसाला या अदरक — सुगंधित और गर्माहट देने वाला।",
    "Crispy, spiced batter — perfect chai snack.": "कुरकुरी, मसालेदार परत — चाय के साथ परफेक्ट स्नैक।",
    "Your Cart": "आपकी टोकरी",
    "Cart is empty": "टोकरी खाली है",
    "Total:": "कुल:",
    "Clear": "खाली करें",
    "Checkout": "भुगतान करें",
    "Add": "जोड़ें",
  };
  const DICT_REVERSE = {};
  Object.keys(DICT).forEach(k => DICT_REVERSE[DICT[k]] = k);

  function applyTranslation(lang) {
    const reverse = lang === "en";
    // Only translate simple text nodes to avoid breaking complex markup
    document.querySelectorAll("body *:not(script):not(style)").forEach((el) => {
      // skip form inputs
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      // translate immediate text nodes
      el.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
          const text = node.nodeValue.trim();
          if (!text) return;
          if (!reverse && DICT[text]) node.nodeValue = DICT[text];
          else if (reverse && DICT_REVERSE[text]) node.nodeValue = DICT_REVERSE[text];
        }
      });
    });
  }

  $(".lang-btn")?.addEventListener("click", () => {
    const prev = localStorage.getItem("sh_lang") || "en";
    const next = prev === "hi" ? "en" : "hi";
    localStorage.setItem("sh_lang", next);
    applyTranslation(next);
  });

  // apply on load
  applyTranslation(localStorage.getItem("sh_lang") || "en");

  /* -------------------------------------------------
     EVENTS: listen for storage changes (other tabs)
  ------------------------------------------------- */
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) {
      // reload cart from storage
      try {
        const s = localStorage.getItem(CART_KEY);
        cart = s ? JSON.parse(s) : [];
      } catch (err) {
        cart = [];
      }
      renderCart();
    }
  });

  // custom cart-updated event should update UI across the app
  document.addEventListener("cart-updated", () => {
    updateCartCountUI();
  });

  // Expose a small API on window for other pages (profile/settings) to update badge
  window.SH = window.SH || {};
  window.SH.updateCartBadge = updateCartCountUI;

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    renderCart();
    updateCartCountUI();
  });
})();