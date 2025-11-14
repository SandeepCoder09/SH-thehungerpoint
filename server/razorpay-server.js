// server/razorpay-server.js
// Merged server: Razorpay + Firestore + Admin (plain password) + JWT + Push
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------- FIREBASE ADMIN INIT --------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
  });
}
const db = admin.firestore();

// -------------- RAZORPAY INIT --------------
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET,
});

// -------------- ADMIN / JWT CONFIG --------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""; // plain password from .env
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "change_this_secret";
const JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "6h";

// -------------- HELPERS --------------
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyTokenMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

// -------------- ROUTES --------------

// Health
app.get("/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Create Razorpay order (public)
app.post("/create-order", async (req, res) => {
  try {
    const { amount, items } = req.body;
    if (!amount || !items) return res.status(400).json({ ok: false, error: "Missing amount/items" });

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: "sh_order_" + Date.now(),
    });

    return res.json({ ok: true, order, key_id: process.env.RZP_KEY_ID });
  } catch (err) {
    console.error("create-order error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Verify payment and save order to Firestore (public, called from frontend Razorpay handler)
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing payment fields" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RZP_KEY_SECRET).update(body.toString()).digest("hex");
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    // compute amount from items (assumes items have {name, qty, price})
    const amount = Array.isArray(items) ? items.reduce((s, it) => s + (Number(it.price) * Number(it.qty)), 0) : 0;

    // Save order to Firestore
    const docRef = await db.collection("orders").add({
      items: items || [],
      amount,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      razorpay_order_id,
      razorpay_payment_id,
    });

    // Send push to adminTokens (if any)
    try {
      const tokensSnap = await db.collection("adminTokens").get();
      const tokens = tokensSnap.docs.map(d => d.id).filter(Boolean);
      if (tokens.length > 0) {
        const message = {
          notification: {
            title: "New Order Received",
            body: `Order #${docRef.id} • ₹${amount}`
          },
          data: { orderId: docRef.id },
          tokens,
        };

        const resp = await admin.messaging().sendMulticast(message);
        // cleanup invalid tokens
        const invalid = [];
        resp.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
        if (invalid.length) {
          const batch = db.batch();
          invalid.forEach(t => batch.delete(db.collection("adminTokens").doc(t)));
          await batch.commit();
        }
      }
    } catch (pushErr) {
      console.warn("Push send failed (continuing):", pushErr.message || pushErr);
    }

    return res.json({ ok: true, orderId: docRef.id });
  } catch (err) {
    console.error("verify-payment error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Admin login (plain password) -> returns JWT
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: "Missing credentials" });

    if (email !== ADMIN_EMAIL) return res.status(403).json({ ok: false, error: "Forbidden" });
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: "Invalid password" });

    const token = signToken({ email });
    return res.json({ ok: true, token });
  } catch (err) {
    console.error("admin login error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Verify JWT
app.get("/admin/verify", verifyTokenMiddleware, (req, res) => {
  return res.json({ ok: true, admin: req.admin || {} });
});

// Protected: update order status
app.post("/admin/update-status", verifyTokenMiddleware, async (req, res) => {
  try {
    const { orderId, status } = req.body;
    if (!orderId || !status) return res.status(400).json({ ok: false, error: "Missing orderId or status" });

    await db.collection("orders").doc(orderId).update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    return res.json({ ok: true });
  } catch (err) {
    console.error("update-status error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Admin: fetch all orders (protected)
app.get("/admin/orders", verifyTokenMiddleware, async (req, res) => {
  try {
    const snap = await db.collection("orders").orderBy("createdAt", "desc").get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, list });
  } catch (err) {
    console.error("admin/orders error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -------------- START --------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
