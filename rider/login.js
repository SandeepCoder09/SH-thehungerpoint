/* rider/login.js
   - POST /rider/login
   - store token + riderId
   - redirect to dashboard
   - auto-check on load
*/

(() => {
  // ======= CONFIG =======
  // backend server (Render)
  const SERVER_URL = "https://sh-thehungerpoint.onrender.com";

  // Where to redirect after successful login
  // (you told me your Rider login page URL is /rider/login)
  const DASHBOARD_URL = "https://sh-thehungerpoint.pages.dev/rider/index.html";

  // ======= UTIL =======
  function $(sel) { return document.querySelector(sel); }
  function createToastContainer() {
    if ($("#rider-toast-container")) return;
    const c = document.createElement("div");
    c.id = "rider-toast-container";
    c.style.position = "fixed";
    c.style.zIndex = 99999;
    c.style.right = "18px";
    c.style.top = "18px";
    c.style.display = "flex";
    c.style.flexDirection = "column";
    c.style.gap = "8px";
    document.body.appendChild(c);
  }
  function showToast(text, timeout = 3000) {
    createToastContainer();
    const t = document.createElement("div");
    t.textContent = text;
    t.style.background = "rgba(0,0,0,0.85)";
    t.style.color = "white";
    t.style.padding = "10px 14px";
    t.style.borderRadius = "8px";
    t.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
    t.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
    t.style.fontSize = "14px";
    t.style.maxWidth = "320px";
    document.getElementById("rider-toast-container").appendChild(t);
    setTimeout(() => t.remove(), timeout);
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = "Signing in...";
      btn.classList?.add("processing");
    } else {
      if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
      btn.classList?.remove("processing");
    }
  }

  function setInlineError(msg) {
    let el = $("#rider-login-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "rider-login-error";
      el.style.color = "#b00020";
      el.style.marginTop = "12px";
      el.style.fontSize = "14px";
      const form = $("#loginScreen") || document.body;
      form.appendChild(el);
    }
    el.textContent = msg || "";
    if (!msg) el.style.display = "none"; else el.style.display = "block";
  }

  // ======= API HELPERS =======
  async function apiPost(path, body = {}, opts = {}) {
    const url = (path.startsWith("http") ? path : (SERVER_URL + path));
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "omit"
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { ok: res.ok, status: res.status, json };
  }

  async function apiGet(path, opts = {}) {
    const url = (path.startsWith("http") ? path : (SERVER_URL + path));
    const res = await fetch(url, {
      method: "GET",
      headers: opts.headers || {},
      credentials: "omit"
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { ok: res.ok, status: res.status, json };
  }

  // ======= LOGIN FLOW =======
  async function doLogin(email, password, btn) {
    setInlineError("");
    setBtnLoading(btn, true);

    if (!email || !password) {
      setInlineError("Enter email and password.");
      setBtnLoading(btn, false);
      return;
    }

    try {
      const { ok, status, json } = await apiPost("/rider/login", { email, password });

      // Some servers return ok:false with detailed json
      if (!ok && json && json.ok === false) {
        setInlineError(json.error || "Invalid credentials");
        showToast(json.error || "Login failed");
        setBtnLoading(btn, false);
        return;
      }

      // If successful shape { ok:true, riderId, token }
      if (json && json.ok && json.token && json.riderId) {
        localStorage.setItem("riderToken", json.token);
        localStorage.setItem("riderId", json.riderId);
        // redirect to dashboard
        showToast("Login successful — redirecting…", 1200);
        setTimeout(() => { window.location.href = DASHBOARD_URL; }, 900);
        return;
      }

      // fallback: server returned 200 but different shape
      // try to extract token/riderId from common fields
      const possibleToken = json?.token || json?.accessToken || json?.data?.token;
      const possibleRider = json?.riderId || json?.data?.riderId || email;
      if (possibleToken) {
        localStorage.setItem("riderToken", possibleToken);
        localStorage.setItem("riderId", possibleRider);
        showToast("Login successful — redirecting…", 1200);
        setTimeout(() => { window.location.href = DASHBOARD_URL; }, 900);
        return;
      }

      // default error
      setInlineError(json?.error || "Invalid credentials");
      showToast("Login failed");
    } catch (err) {
      console.error("Login error:", err);
      setInlineError("Server error. Try again.");
      showToast("Server error");
    } finally {
      setBtnLoading(btn, false);
    }
  }

  // ======= AUTO-CHECK ON LOAD =======
  // If token + riderId exist, verify approval and redirect automatically
  async function autoCheckAndRedirect() {
    const token = localStorage.getItem("riderToken");
    const riderId = localStorage.getItem("riderId");
    if (!token || !riderId) return;

    // show quick spinner on login button if available
    const loginBtn = $("#loginBtn") || null;
    if (loginBtn) setBtnLoading(loginBtn, true);

    try {
      // Use /rider/check?riderId=... to verify rider exists + approved
      const res = await apiGet(`/rider/check?riderId=${encodeURIComponent(riderId)}`);
      if (res.json && res.json.ok) {
        // already approved — go to dashboard
        showToast("Welcome back! Redirecting to dashboard…", 900);
        setTimeout(() => { window.location.href = DASHBOARD_URL; }, 700);
        return;
      }

      // not approved or something else
      setInlineError(res.json?.error || "Rider not approved / login required");
    } catch (err) {
      console.error("Auto-check failed", err);
    } finally {
      if (loginBtn) setBtnLoading(loginBtn, false);
    }
  }

  // ======= BIND UI =======
  function bindUI() {
    const emailEl = $("#riderEmail");
    const passEl = $("#riderPass");
    const btn = $("#loginBtn");

    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const email = (emailEl?.value || "").trim();
        const password = (passEl?.value || "").trim();
        doLogin(email, password, btn);
      });
    }

    // submit on enter
    [emailEl, passEl].forEach(el => {
      if (!el) return;
      el.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter") {
          btn?.click();
        }
      });
    });

    // optional: logout link if present
    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("riderToken");
        localStorage.removeItem("riderId");
        showToast("Logged out");
        // bring user back to login page if dashboard is separate
        if (window.location.pathname.includes("/rider/index.html")) {
          window.location.href = "/rider/login";
        }
      });
    }
  }

  // ======= ON LOAD =======
  document.addEventListener("DOMContentLoaded", () => {
    bindUI();
    // small delay so page UI bootstraps before redirecting
    setTimeout(autoCheckAndRedirect, 300);
  });

})();
