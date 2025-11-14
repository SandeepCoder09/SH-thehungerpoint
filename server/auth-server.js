// server/auth-server.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- FIREBASE ADMIN ------------------
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

// ---------- ADMIN ENV VARIABLES ----------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "super_secret_change_me";
const JWT_EXPIRES_IN = "6h";

// ---------- JWT VERIFY MIDDLEWARE ----------
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

// ---------- ROUTES ----------

// Health
app.get("/ping", (req, res) => res.json({ ok: true }));

// LOGIN
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL)
    return res.status(403).json({ ok: false, error: "Invalid email" });

  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!match)
    return res.status(401).json({ ok: false, error: "Incorrect password" });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({ ok: true, token });
});

// VERIFY
app.get("/admin/verify", verifyToken, (req, res) => {
  res.json({ ok: true });
});

// UPDATE ORDER STATUS
app.post("/admin/update-status", verifyToken, async (req, res) => {
  const { orderId, status } = req.body;

  if (!orderId || !status)
    return res.status(400).json({ ok: false, error: "Missing values" });

  await db.collection("orders").doc(orderId).update({ status });

  res.json({ ok: true });
});

// ---------- RUN SERVER ----------
const PORT = process.env.PORT || 7000;
app.listen(PORT, () =>
  console.log(`Admin Auth Server running on port ${PORT}`)
);
