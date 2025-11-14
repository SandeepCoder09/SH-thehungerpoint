const firebaseConfig = {
    apiKey: "REPLACE_API_KEY",
    authDomain: "REPLACE_PROJECT.firebaseapp.com",
    projectId: "sh-the-hunger-point",
    storageBucket: "REPLACE_PROJECT.appspot.com",
    messagingSenderId: "REPLACE_SENDER_ID",
    appId: "REPLACE_APP_ID"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
