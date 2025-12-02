// admin/support.js
// Admin support inbox — realtime replies (SH theme, style C).
// Requires window.auth and window.db to be set by your firebase-config.js.

(async function () {
  const authImpl = window.auth || (window.firebase && window.firebase.auth && window.firebase.auth());
  const db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());

  // DOM
  const adminEmailEl = document.getElementById("adminEmail");
  const signOutBtn = document.getElementById("signOutBtn");
  const backBtn = document.getElementById("backBtn");

  const chatsContainer = document.getElementById("chatsContainer");
  const searchInput = document.getElementById("searchInput");

  const chatPanel = document.getElementById("chatPanel");
  const chatUserName = document.getElementById("chatUserName");
  const chatUserEmail = document.getElementById("chatUserEmail");
  const messagesArea = document.getElementById("messagesArea");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const closeChatBtn = document.getElementById("closeChatBtn");

  let currentChatId = null;
  let msgsUnsubscribe = null;
  let chatsUnsubscribe = null;
  let cachedChats = [];

  function showToast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.position = "fixed";
    t.style.bottom = "18px";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.background = "#222";
    t.style.color = "#fff";
    t.style.padding = "8px 12px";
    t.style.borderRadius = "8px";
    t.style.zIndex = 99999;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // simple friendly date time
  function fmt(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }

  // ensure admin
  function requireAdmin(user) {
    if (!user) return Promise.reject("Not signed in");
    const emailKey = user.email;
    return db.collection("admins").doc(emailKey).get().then(doc => {
      if (!doc.exists) throw new Error("Not an admin");
      return true;
    });
  }

  // render chats list
  function renderChats(list) {
    chatsContainer.innerHTML = "";
    if (!list.length) {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No chats yet";
      chatsContainer.appendChild(e);
      return;
    }
    list.forEach(chat => {
      const row = document.createElement("div");
      row.className = "chat-row";
      row.dataset.chatId = chat.id;

      const avatar = document.createElement("div");
      avatar.className = "chat-avatar";
      const img = document.createElement("img");
      img.src = chat.photoURL || "/home/SH-Favicon.png";
      avatar.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "chat-meta";
      meta.innerHTML = `<div class="name">${chat.name || "User"}</div>
                        <div class="email">${chat.email || ""}</div>
                        <div class="last">${chat.lastText ? chat.lastText.slice(0,80) : ""}</div>`;

      const badge = document.createElement("div");
      badge.className = "chat-badge";
      badge.textContent = chat.unreadCount && chat.unreadCount>0 ? chat.unreadCount : "";

      row.appendChild(avatar);
      row.appendChild(meta);
      if (chat.unreadCount && chat.unreadCount>0) row.appendChild(badge);

      row.addEventListener("click", () => openChat(chat.id));
      chatsContainer.appendChild(row);
    });
  }

  // open chat and listen to messages
  async function openChat(chatId) {
    if (msgsUnsubscribe) { msgsUnsubscribe(); msgsUnsubscribe = null; }
    currentChatId = chatId;
    chatPanel.removeAttribute("aria-hidden");

    // load chat meta
    const metaDoc = await db.collection("supportChats").doc(chatId).get();
    if (!metaDoc.exists) {
      chatUserName.textContent = "Unknown";
      chatUserEmail.textContent = "";
    } else {
      const data = metaDoc.data();
      chatUserName.textContent = data.userName || "User";
      chatUserEmail.textContent = data.userEmail || (data.userId || "");
    }

    messagesArea.innerHTML = "";
    const msgsRef = db.collection("supportChats").doc(chatId).collection("messages").orderBy("time", "asc");

    msgsUnsubscribe = msgsRef.onSnapshot(snap => {
      messagesArea.innerHTML = "";
      if (snap.empty) {
        messagesArea.innerHTML = `<div class="messages-empty">No messages yet</div>`;
      } else {
        snap.forEach(doc => {
          const m = doc.data();
          const el = document.createElement("div");
          el.className = "msg " + (m.sender === "admin" ? "right" : "left");
          el.innerHTML = `<div class="text">${escapeHtml(m.text)}</div>
                          <div class="time">${fmt(m.time)}</div>`;
          messagesArea.appendChild(el);
        });
        // scroll to bottom
        messagesArea.scrollTop = messagesArea.scrollHeight + 200;
      }
      // mark unread -> 0
      db.collection("supportChats").doc(chatId).update({ unreadCount: 0, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
    }, err => {
      console.error("Messages listen error", err);
    });
  }

  // close chat view
  function closeChat() {
    if (msgsUnsubscribe) { msgsUnsubscribe(); msgsUnsubscribe = null; }
    currentChatId = null;
    chatPanel.setAttribute("aria-hidden", "true");
  }

  // send message
  async function sendMessage() {
    if (!currentChatId) return showToast("Select a conversation");
    const text = messageInput.value && messageInput.value.trim();
    if (!text) return;
    const admin = (authImpl && authImpl.currentUser);
    if (!admin) return showToast("Not signed in");

    const msgObj = {
      sender: "admin",
      text: text,
      time: firebase.firestore.FieldValue.serverTimestamp(),
      adminEmail: admin.email || ""
    };

    try {
      // push message to subcollection
      const msgsRef = db.collection("supportChats").doc(currentChatId).collection("messages");
      await msgsRef.add(msgObj);

      // update chat meta (lastText, updatedAt)
      await db.collection("supportChats").doc(currentChatId).update({
        lastText: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // clear composer
      messageInput.value = "";
      messageInput.focus();
    } catch (err) {
      console.error("Send failed", err);
      showToast("Send failed");
    }
  }

  // simple html escape
  function escapeHtml(s){ return (s||"").replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c])); }

  // live chats watcher
  function watchChats() {
    if (!db) return;
    const ref = db.collection("supportChats").orderBy("updatedAt","desc").limit(200);
    chatsUnsubscribe = ref.onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push(Object.assign({ id: doc.id }, d));
      });
      cachedChats = list;
      renderChats(list);
    }, err => {
      console.error("Chats listen error", err);
    });
  }

  // search handler
  function applySearch(q) {
    if (!q) return renderChats(cachedChats);
    const low = q.toLowerCase();
    const filtered = cachedChats.filter(c => {
      return (c.name && c.name.toLowerCase().includes(low)) ||
             (c.email && c.email.toLowerCase().includes(low)) ||
             (c.lastText && c.lastText.toLowerCase().includes(low));
    });
    renderChats(filtered);
  }

  // wire UI
  signOutBtn.addEventListener("click", async () => {
    try { await authImpl.signOut(); window.location.href = "/auth/login.html"; } catch(e){ console.error(e); }
  });
  backBtn.addEventListener("click", () => window.location.href = "/admin/index.html");
  closeChatBtn.addEventListener("click", closeChat);
  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }});
  searchInput.addEventListener("input", (e) => applySearch(e.target.value));

  // bootstrap
  (function init() {
    if (!authImpl || !db) {
      console.error("Firebase not loaded");
      return;
    }
    authImpl.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "/auth/login.html";
        return;
      }
      // display admin email
      adminEmailEl.textContent = user.email;

      try {
        await requireAdmin(user);
      } catch (err) {
        console.warn("Admin check failed", err);
        window.location.href = "/auth/login.html";
        return;
      }

      // start listening chats
      watchChats();
    });
  })();

})();