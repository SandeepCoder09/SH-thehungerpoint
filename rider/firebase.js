// /rider/firebase.js
// Robust dynamic-import wrapper for Firebase modular SDK
// Exports the same names used across your rider files.

const FIREBASE_VERSION = "9.24.0";
const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const urls = {
   app: `${CDN_BASE}/firebase-app.js`,
   auth: `${CDN_BASE}/firebase-auth.js`,
   firestore: `${CDN_BASE}/firebase-firestore.js`
};

// Your firebase config (keep as you provided)
const firebaseConfig = {
   apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
   authDomain: "sh-the-hunger-point.firebaseapp.com",
   projectId: "sh-the-hunger-point",
   storageBucket: "sh-the-hunger-point.firebasestorage.app",
   messagingSenderId: "401237282420",
   appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
   measurementId: "G-4KP3RJ15E9"
};

let app = null;
let db = null;
let auth = null;
let exportsReady = false;

async function loadFirebaseModules() {
   try {
      // dynamic import of modules from CDN
      const appMod = await import(urls.app);
      const authMod = await import(urls.auth);
      const fsMod = await import(urls.firestore);

      // initialize app
      app = appMod.initializeApp(firebaseConfig);

      // exports used by your other modules
      auth = authMod.getAuth(app);
      db = fsMod.getFirestore(app);

      // Re-export commonly used functions/objects (matching your code usage)
      return {
         app,
         db,
         auth,
         // Firestore helpers
         collection: fsMod.collection,
         query: fsMod.query,
         where: fsMod.where,
         onSnapshot: fsMod.onSnapshot,
         getDocs: fsMod.getDocs,
         doc: fsMod.doc,
         getDoc: fsMod.getDoc,
         updateDoc: fsMod.updateDoc,
         orderBy: fsMod.orderBy,
         // Auth helpers
         signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
         signOut: authMod.signOut
      };
   } catch (err) {
      console.error("Firebase dynamic import failed:", err);
      throw err;
   }
}

// Single shared promise so multiple imports wait for same initialization:
const _initPromise = (async () => {
   const obj = await loadFirebaseModules();
   exportsReady = true;
   return obj;
})();

// Export wrappers that defer until modules are loaded
export async function _ensure() {
   return _initPromise;
}

// Export named bindings that other files can import (they'll be promises or functions)
export const appPromise = _initPromise.then(x => x.app);
export const dbPromise = _initPromise.then(x => x.db);
export const authPromise = _initPromise.then(x => x.auth);

export async function getApp() {
   const x = await _initPromise;
   return x.app;
}
export async function getDb() {
   const x = await _initPromise;
   return x.db;
}
export async function getAuth() {
   const x = await _initPromise;
   return x.auth;
}

// Export helpers used in your rider code (so old imports continue to work).
// NOTE: these wrappers return the actual function from firestore/auth after init.
export const collection = (...args) => _initPromise.then(x => x.collection(...args));
export const query = (...args) => _initPromise.then(x => x.query(...args));
export const where = (...args) => _initPromise.then(x => x.where(...args));
export const onSnapshot = (...args) => _initPromise.then(x => x.onSnapshot(...args));
export const getDocs = (...args) => _initPromise.then(x => x.getDocs(...args));
export const doc = (...args) => _initPromise.then(x => x.doc(...args));
export const getDoc = (...args) => _initPromise.then(x => x.getDoc(...args));
export const updateDoc = (...args) => _initPromise.then(x => x.updateDoc(...args));
export const orderBy = (...args) => _initPromise.then(x => x.orderBy(...args));
export const signInWithEmailAndPassword = (...args) => _initPromise.then(x => x.signInWithEmailAndPassword(...args));
export const signOut = (...args) => _initPromise.then(x => x.signOut(...args));

// Provide default export convenience
export default {
   _ensure,
   appPromise,
   dbPromise,
   authPromise,
   getApp,
   getDb,
   getAuth
};
