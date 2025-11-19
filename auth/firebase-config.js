async function loadFirebaseConfig() {
  const response = await fetch("/api/firebase-config");
  const firebaseConfig = await response.json();

  firebase.initializeApp(firebaseConfig);

  window.auth = firebase.auth();
  window.db = firebase.firestore();
}
loadFirebaseConfig();