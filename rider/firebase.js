// rider/firebase.js
// Firebase v9 modular init for Firestore + Storage and small helpers.
// Replace config if needed — this uses your provided config.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc,
  onSnapshot, query, where, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";

import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-storage.js";

// --- your firebase config (you provided this earlier) ---
const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  app, db, storage,
  collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, getDocs, addDoc,
  storageRef, uploadBytes, getDownloadURL
};
