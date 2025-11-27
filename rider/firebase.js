// /rider/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-thehungerpoint",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  app,
  db,
  auth,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  signInWithEmailAndPassword,
  signOut
};