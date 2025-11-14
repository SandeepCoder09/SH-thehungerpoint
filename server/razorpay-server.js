// razorpay-server.js – FINAL CLEAN VERSION
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import Razorpay from "razorpay";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// -----------------------------
// ENV VARIABLES
// -----------------------------
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_JWT_SECRET,
  RZP_KEY_ID,
  RZP_KEY_SECRET,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PROJECT_ID
} = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_JWT_SECRET) {
  console.error("❌ Missing admin login env vars!");
}

const app = express();
app.use(cors({
  origin: [
    "https://sandeepcoder09.github.io",
    "http://localhost:5500"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// -----------------------------
// FIREBASE ADMIN INITIALIZATION
// -----------------------------
admin.initializeApp({
  credential: admin.credential.cert({
    project_id: FIREBASE_PROJECT_ID,
    private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

// -----------------------------
// RAZORPAY CLIENT
// -----------------------------
const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET,
});

// -----------------------------
// 1) PING
// -----------------------------
app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "Server is awake!" });
});

// -----------------------------
// 2) ADMIN LOGIN (PLAIN TEXT)
// -----------------------------
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL) {
    return res.json({ ok: false, error: "Invalid email" });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.json({ ok: false, error: "Invalid password" });
  }

  const token = jwt.sign({ email }, ADMIN_JWT_SECRET, { expiresIn: "12h" });

  res.json({ ok: true, token });
});

// -----------------------------
// 3) MIDDLEWARE (Check JWT)
// -----------------------------
function authCheck(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch (err) {
    res.status(403).json({ ok: false, error: "Invalid token" });
  }
}

// -----------------------------
// 4) GET ALL ORDERS (ADMIN ONLY)
// -----------------------------
app.get("/admin/orders", authCheck, async (req, res) => {
  const snap = await db.collection("orders").orderBy("timestamp", "desc").get();

  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  res.json({ ok: true, orders });
});

// -----------------------------
// 5) CREATE RAZORPAY ORDER
// -----------------------------
app.post("/create-order", async (req, res) => {
  const { amount, items } = req.body;

  try {
    const rzpOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
    });

    res.json({
      ok: true,
      order: rzpOrder,
      key_id: RZP_KEY_ID,
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// -----------------------------
// 6) VERIFY PAYMENT + SAVE ORDER
// -----------------------------
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto.createHmac("sha256", RZP_KEY_SECRET).update(sign).digest("hex");

  if (expected !== razorpay_signature) {
    return res.json({ ok: false, error: "Signature mismatch" });
  }

  const ref = await db.collection("orders").add({
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    items,
    status: "pending",
    timestamp: Date.now(),
  });

  res.json({ ok: true, orderId: ref.id });
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port: ${PORT}`);
});
