# SH The Hunger Point — Live Build

Responsive customer site + Admin PWA + Razorpay (test) + Firebase Firestore.

## 🧱 Structure
- **public/** — Customer site (menu, Cashfree, Firebase)
- **admin/** — Admin PWA (real-time Firestore + alerts)
- **server/** — Node server with cashfree + Firestore backend

## 🚀 Setup
1. Create a Firebase project (test mode) → copy web config → `public/firebase-config.js`
2. Download service account JSON → save as `admin/serviceAccountKey.json`
3. Generate Razorpay **test keys** → paste into `server/cashfree-server.js`
4. Run backend:
   ```bash
   cd server
   npm install
   node cashfree-server.js
