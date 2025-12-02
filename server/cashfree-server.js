// --- Replace into your existing server file ---
// (This snippet assumes the rest of your file (Firebase admin init, express, io, etc)
// remains the same. Replace the previous create-cashfree-order & verify-cashfree-payment
// handlers and the CORS setup with the code below.)

// CORS with whitelist from env (optional)
const CF_ALLOWED_ORIGINS = (process.env.CF_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (CF_ALLOWED_ORIGINS.length === 0) return callback(null, true); // allow all if not configured
    if (CF_ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error("Not allowed by CORS: " + origin));
  }
}));

// Cashfree base
const CF_MODE = (process.env.CF_MODE || "production").toLowerCase();
const CF_BASE =
  CF_MODE === "sandbox"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

// Helper to call Cashfree and parse JSON (with logging)
async function cashfreePost(path, payload) {
  const url = `${CF_BASE}${path}`;
  console.log("➡️ Cashfree POST:", url, payload);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2022-09-01",
      "x-client-id": process.env.CF_APP_ID,
      "x-client-secret": process.env.CF_SECRET_KEY
    },
    body: JSON.stringify(payload),
    // set timeout/other options if you want
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error("Cashfree returned non-json:", text);
    throw new Error("Cashfree non-json response: " + text);
  }

  console.log("⬅️ Cashfree response:", json);
  return { status: resp.status, body: json };
}

/* -----------------------------------
   Cashfree — Create Order (robust)
----------------------------------- */
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, items = [], phone, email, return_url } = req.body;

    if (!amount || Number(amount) <= 0) {
      return safeJson(res, 400, { ok: false, error: "Amount required" });
    }

    // Build payload — include return_url for web flows
    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || email || "guest",
        customer_phone: phone || undefined,
        customer_email: email || undefined
      },
      // RETURN URL used by Cashfree to callback / redirect (use your site)
      return_url: return_url || process.env.CF_RETURN_URL || "https://sh-thehungerpoint.pages.dev/",
      // optional metadata
      order_meta: {
        items_count: items.length,
        notes: "Created by SH backend"
      }
    };

    const { status, body } = await cashfreePost("/pg/orders", payload);

    // Save raw response for debugging if needed
    if (!body) {
      return safeJson(res, 500, { ok: false, error: "Empty response from Cashfree" });
    }

    // Cashfree v2 may respond under `data` or top-level keys
    const orderId = body.order_id || body.data?.order_id || body.data?.order?.id || body.data?.order_id;
    const session = body.payment_session_id || body.data?.payment_session_id || body.data?.session || body.data?.payment_session;

    // If we didn't find expected keys, send raw body back to caller for debugging
    if (!orderId || !session) {
      console.error("Cashfree missing orderId/session", { status, body });
      return safeJson(res, 502, { ok: false, error: "Cashfree failed", status, raw: body });
    }

    // Optionally persist a draft order in Firestore (not finalized) — useful to match later
    try {
      if (db) {
        await db.collection("orders").doc(orderId).set({
          orderId,
          items,
          totalAmount: Number(amount),
          status: "initiated",
          cfCreatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Could not persist draft order:", e?.message || e);
    }

    return safeJson(res, 200, { ok: true, orderId, session, raw: body });
  } catch (err) {
    console.error("Cashfree order error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error", message: err.message });
  }
});

/* -----------------------------------
   Cashfree — Verify Payment (robust)
----------------------------------- */
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId, items = [] } = req.body;
    if (!orderId) return safeJson(res, 400, { ok: false, error: "orderId required" });

    const url = `${CF_BASE}/pg/orders/${encodeURIComponent(orderId)}`;
    console.log("➡️ Cashfree GET:", url);

    // GET order info
    const resp = await fetch(url, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      }
    });

    const text = await resp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      console.error("Cashfree verify non-json:", text);
      return safeJson(res, 502, { ok: false, error: "Invalid response from Cashfree", raw: text });
    }

    console.log("⬅️ Cashfree verify response:", body);

    const status =
      body.order_status ||
      body.data?.order_status ||
      body.status ||
      body.data?.status;

    if (!status || String(status).toUpperCase() !== "PAID") {
      return safeJson(res, 200, { ok: false, error: "Payment not completed", raw: body });
    }

    // Save paid order to Firestore
    const total = items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0);

    if (db) {
      await db.collection("orders").doc(orderId).set({
        orderId,
        items,
        totalAmount: total,
        status: "paid",
        updatedAt: admin.firestore.Timestamp.now(),
        paidAt: admin.firestore.Timestamp.now()
      }, { merge: true });
    }

    return safeJson(res, 200, { ok: true, orderId, raw: body });
  } catch (err) {
    console.error("Cashfree verify error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error", message: err.message });
  }
});
