// help/help.js
// Floating support bot (client-side only). Persists to localStorage.
// Simple keyword rules + canned FAQ answers. No backend required.

(function () {
  const CHAT_KEY = "sh_help_chat_v1";

  // UI refs
  const chatToggle = document.getElementById("chatToggle");
  const chatWindow = document.getElementById("chatWindow");
  const chatClose = document.getElementById("chatClose");
  const chatBody = document.getElementById("chatBody");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");

  // Search & articles
  const helpSearch = document.getElementById("helpSearch");
  const articleButtons = document.querySelectorAll(".article");
  const quickButtons = document.querySelectorAll(".chat-quick button");

  // Basic canned knowledge base
  const KB = [
    { q: "profile photo", a: "Open Settings → User Profile → Tap the pencil on the avatar. If upload fails, we store avatars as Base64 in Firestore — wait for the confirmation toast." },
    { q: "change password", a: "Go to Settings → Change Password and tap Save. We'll send a password-reset email to your account." },
    { q: "notifications", a: "Open Settings and toggle Push Notifications. We save your preference to your account." },
    { q: "logout", a: "Open Settings and tap Logout. This will sign you out and return you to the login screen." },
    { q: "refund", a: "For refunds please contact support with your order id. We'll assist you within 24 hours." },
    { q: "contact support", a: "You can message us on WhatsApp or use this chat. For fast support share your order id and a short problem description." },
  ];

  // Utilities
  function loadHistory() {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory(hist) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(hist || []));
  }

  // Render a single message
  function pushMessage(text, who = "bot", meta = "") {
    const el = document.createElement("div");
    el.className = "msg " + (who === "user" ? "user" : "bot");
    el.innerHTML = `<div>${escapeHtml(text)}</div>` + (meta ? `<small>${escapeHtml(meta)}</small>` : "");
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight - chatBody.clientHeight;
  }

  function escapeHtml(s) {
    return (s + "").replace(/[&<>"'`]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[m];
    });
  }

  // Simple keyword search in KB
  function findAnswer(query) {
    if (!query) return null;
    const q = query.toLowerCase();
    // direct match priority
    for (const item of KB) {
      if (q.includes(item.q)) return item.a;
    }
    // fuzzy: match any token
    const tokens = q.split(/\s+/).filter(Boolean);
    for (const item of KB) {
      for (const t of tokens) {
        if (item.q.indexOf(t) !== -1) return item.a;
      }
    }
    return null;
  }

  // Bot 'thinking' + reply
  function botReply(text) {
    // show typing indicator
    const typ = document.createElement("div");
    typ.className = "msg bot";
    typ.innerHTML = `<div>...</div>`;
    chatBody.appendChild(typ);
    chatBody.scrollTop = chatBody.scrollHeight - chatBody.clientHeight;

    setTimeout(() => {
      typ.remove();
      // compute reply: rule-based
      const answer = findAnswer(text) || "Sorry I couldn't find a direct answer. Try 'profile photo' or 'change password'. You can also open FAQs.";
      pushMessage(answer, "bot");
      // persist
      const history = loadHistory();
      history.push({ who: "bot", text: answer, time: Date.now() });
      saveHistory(history);
    }, 600 + Math.random() * 600);
  }

  // Send function
  function sendMessage(rawText) {
    const text = (rawText || "").trim();
    if (!text) return;
    pushMessage(text, "user");
    chatInput.value = "";
    chatInput.focus();

    // persist
    const history = loadHistory();
    history.push({ who: "user", text: text, time: Date.now() });
    saveHistory(history);

    // bot reply
    botReply(text);
  }

  // Wire UI
  function openChat() {
    chatWindow.setAttribute("aria-hidden", "false");
    chatWindow.style.display = "flex";
    chatInput.focus();
    // initial greeting
    const hist = loadHistory();
    if (hist.length === 0) {
      const greet = "Hi! I'm SH Assistant — tell me your problem (e.g., 'profile photo' or 'refund').";
      pushMessage(greet, "bot");
      saveHistory([{ who: "bot", text: greet, time: Date.now() }]);
    } else {
      // replay history
      chatBody.innerHTML = "";
      hist.forEach(m => pushMessage(m.text, m.who));
    }
  }
  function closeChat() {
    chatWindow.setAttribute("aria-hidden", "true");
    chatWindow.style.display = "none";
  }

  // events
  chatToggle && chatToggle.addEventListener("click", () => {
    const hidden = chatWindow.getAttribute("aria-hidden") === "true" || chatWindow.style.display === "none";
    if (hidden) openChat(); else closeChat();
  });
  chatClose && chatClose.addEventListener("click", closeChat);

  chatSend && chatSend.addEventListener("click", () => sendMessage(chatInput.value));
  chatInput && chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  // search box behavior: when search invoked, send to chat
  if (helpSearch) {
    helpSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = helpSearch.value.trim();
        if (v) {
          // open chat and send query
          openChat();
          sendMessage(v);
        }
      }
    });
  }

  // article quick buttons -> send as chat query
  articleButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-q") || btn.textContent;
      openChat();
      sendMessage(q);
    });
  });

  // quick suggested buttons in widget
  quickButtons.forEach(b => {
    b.addEventListener("click", () => {
      const txt = b.getAttribute("data-msg");
      if (!txt) return;
      openChat();
      sendMessage(txt);
    });
  });

  // keep chat visible state across reloads
  (function init() {
    const hist = loadHistory();
    if (hist && hist.length > 0) {
      // show only chat toggle; don't auto-open
    }
    // close window by default
    closeChat();
  })();

})();