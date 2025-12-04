import { auth, onAuthStateChanged } from "/firebase.js";
import { db, doc, onSnapshot } from "/firebase.js";

export function requireUser(callback) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "/auth/login.html";
            return;
        }

        const userRef = doc(db, "users", user.uid);

        onSnapshot(userRef, (snap) => {
            if (!snap.exists()) return;
            callback({ uid: user.uid, ...snap.data() });
        });
    });
}

export function logoutUser() {
    auth.signOut();
    localStorage.clear();
    window.location.href = "/auth/login.html";
}