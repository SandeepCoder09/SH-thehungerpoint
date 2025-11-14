const firebaseConfig = {
  apiKey: "AIzaSyBAR2bTveqOertBkpt95YId9hDPrg6S9_E",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",
  messagingSenderId: "312843485011",
  appId: "1:312843485011:web:347c18ee0ad022a1beaba6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
