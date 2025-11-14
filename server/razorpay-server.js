// razorpay-server.js  — FINAL VERSION 🔥

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
//  FIREBASE ADMIN INITIALIZE
// ---------------------------
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
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        }),
    });
}

const db = admin.firestore();

// ---------------------------
//  RAZORPAY INITIALIZE
// ---------------------------
const razorpay = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET,
});

// ---------------------------
//  HEALTH CHECK
// ---------------------------
app.get("/ping", (req, res) => {
    res.json({ ok: true, message: "Server is alive 🚀" });
});

// ---------------------------
//  CREATE ORDER
// ---------------------------
app.post("/create-order", async (req, res) => {
    try {
        const { amount, items } = req.body;

        if (!amount || !items) {
            return res.status(400).json({ ok: false, error: "Amount or items missing" });
        }

        const options = {
            amount: amount * 100,   // amount in paise
            currency: "INR",
            receipt: "sh-order-" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        res.json({
            ok: true,
            order,
            key_id: process.env.RZP_KEY_ID
        });

    } catch (err) {
        console.error("Create order error:", err);
        res.status(500).json({ ok: false, error: "Server error" });
    }
});

// ---------------------------
//  VERIFY PAYMENT + SAVE ORDER
// ---------------------------
app.post("/verify-payment", async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            items 
        } = req.body;

        // Validate signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RZP_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.json({ ok: false, error: "Invalid payment signature" });
        }

        // Save order to Firestore
        const orderRef = await db.collection("orders").add({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            items: items,
            amount: items.reduce((sum, i) => sum + i.price * i.qty, 0),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("🔥 Order saved:", orderRef.id);

        res.json({ ok: true, orderId: orderRef.id });

    } catch (err) {
        console.error("Verify error:", err);
        res.status(500).json({ ok: false, error: "Server error" });
    }
});

// ---------------------------
//  RUN SERVER
// ---------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT}`));
