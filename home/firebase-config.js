// Firebase v10 Modular SDK (auto-loaded from CDN in index.html)

const firebaseConfig = {
  apiKey: "AIzaSyBAR2bTveqOertBkpt95YId9hDPrg6S9_E",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",
  messagingSenderId: "312843485011",
  appId: "1:312843485011:web:347c18ee0ad022a1beaba6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore reference
const db = firebase.firestore();

console.log("🔥 Firebase Connected — Firestore Ready");
