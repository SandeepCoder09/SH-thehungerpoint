// server_fixed.js — Complete working backend (Firebase Admin + Razorpay + Admin Login)

import express from "express"; import cors from "cors"; import Razorpay from "razorpay"; import crypto from "crypto"; import admin from "firebase-admin"; import jwt from "jsonwebtoken"; import bcrypt from "bcryptjs";

// ----------------------------- // INITIALIZE EXPRESS // ----------------------------- const app = express(); app.use(cors({ origin: "*" })); app.use(express.json());

// ----------------------------- // ENVIRONMENT VARIABLES // ----------------------------- const { FIREBASE_TYPE, FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID, FIREBASE_AUTH_URI, FIREBASE_TOKEN_URI, FIREBASE_AUTH_PROVIDER_X509_CERT_URL, FIREBASE_CLIENT_X509_CERT_URL, FIREBASE_UNIVERSE_DOMAIN, JWT_SECRET, RZP_KEY_ID, RZP_KEY_SECRET } = process.env;

// ----------------------------- // FIREBASE ADMIN INITIALIZATION // ----------------------------- try { const serviceAccount = { type: FIREBASE_TYPE, project_id: FIREBASE_PROJECT_ID, private_key_id: FIREBASE_PRIVATE_KEY_ID, private_key: FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n"), client_email: FIREBASE_CLIENT_EMAIL, client_id: FIREBASE_CLIENT_ID, auth_uri: FIREBASE_AUTH_URI, token_uri: FIREBASE_TOKEN_URI, auth_provider_x509_cert_url: FIREBASE_AUTH_PROVIDER_X509_CERT_URL, client_x509_cert_url: FIREBASE_CLIENT_X509_CERT_URL, universe_domain: FIREBASE_UNIVERSE_DOMAIN, };

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), }); console.log("Firebase Admin initialized ✔"); } catch (err) { console.error("Firebase Admin Init Error ❌", err); }

const db = admin.firestore();

// ----------------------------- // RAZORPAY INIT // ----------------------------- const razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });

// ----------------------------- // PING TEST // ----------------------------- app.get("/ping", (req, res) => { res.send("Server Awake ✔"); });

// ----------------------------- // ADMIN LOGIN // ----------------------------- app.post("/admin/login", async (req, res) => { try { const { email, password } = req.body;

const adminDoc = await db.collection("admins").doc(email).get();
if (!adminDoc.exists)
  return res.json({ ok: false, error: "Invalid email or password" });

const data = adminDoc.data();
const valid = await bcrypt.compare(password, data.passwordHash);
if (!valid)
  return res.json({ ok: false, error: "Invalid email or password" });

const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });

res.json({ ok: true, token });

} catch (err) { console.error("Admin Login Error ❌", err); res.json({ ok: false, error: "Server error" }); } });

// ----------------------------- // ADMIN VERIFY TOKEN // ----------------------------- app.post("/admin/verify", (req, res) => { try { const { token } = req.body; const decoded = jwt.verify(token, JWT_SECRET); res.json({ ok: true, admin: decoded.email }); } catch (e) { res.json({ ok: false }); } });

// ----------------------------- // UPDATE ORDER STATUS // ----------------------------- app.post("/admin/update-status", async (req, res) => { try { const { id, status } = req.body; await db.collection("orders").doc(id).update({ status }); res.json({ ok: true }); } catch (err) { console.error("Status Update Error ❌", err); res.json({ ok: false }); } });

// ----------------------------- // CREATE ORDER (RAZORPAY) // ----------------------------- app.post("/create-order", async (req, res) => { try { const { amount } = req.body;

const options = {
  amount: amount * 100,
  currency: "INR",
};

const order = await razorpay.orders.create(options);
res.json(order);

} catch (err) { console.error("Razorpay Create Error ❌", err); res.status(500).json({ error: "Server Error" }); } });

// ----------------------------- // VERIFY PAYMENT // ----------------------------- app.post("/verify-payment", (req, res) => { try { const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

const hash = crypto.createHmac("sha256", RZP_KEY_SECRET)
  .update(razorpay_order_id + "|" + razorpay_payment_id)
  .digest("hex");

if (hash === razorpay_signature) {
  res.json({ success: true });
} else {
  res.json({ success: false });
}

} catch (err) { console.error("Verify Error ❌", err); res.json({ success: false }); } });

// ----------------------------- // START SERVER // ----------------------------- const PORT = process.env.PORT || 10000; app.listen(PORT, () => console.log(🔥 SH Hunger Server Running on PORT ${PORT}));