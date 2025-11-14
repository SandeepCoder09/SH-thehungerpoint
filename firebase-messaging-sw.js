importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBAR2bTveq0ertBkpt9SYTdgNhprg659_E",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:347c18ee0ad022a1eeba06"
});

const messaging = firebase.messaging();

// When admin is in background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Order Received!";
  const options = {
    body: payload.notification?.body || "A customer just placed a new order.",
    icon: "/SH-thehungerpoint/home/assets-img/icon-192.png",
    badge: "/SH-thehungerpoint/home/assets-img/icon-192.png"
  };

  self.registration.showNotification(title, options);
});

// Click → Open Admin Panel
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/SH-thehungerpoint/admin/index.html")
  );
});
