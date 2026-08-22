"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const PACKAGE_NAME = process.env.MYKET_PACKAGE_NAME || "";
const ACCESS_TOKEN = process.env.MYKET_ACCESS_TOKEN || "";
const PUBLIC_KEY_B64 = (process.env.MYKET_PUBLIC_KEY || "").replace(/\s+/g, "");
const AUTO_CONSUME = String(process.env.MYKET_AUTO_CONSUME || "true") !== "false";

const MYKET_API = "https://developer.myket.ir/api/partners/applications";

const processedTokens = new Set();

const app = express();
app.set("trust proxy", true);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname, { index: false }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/pay", (_req, res) => {
  res.sendFile(path.join(__dirname, "pay.html"));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, configured: isConfigured() });
});

app.get(["/armox.apk", "/download/armox.apk"], (_req, res) => {
  const apk = path.join(__dirname, "armox.apk");
  if (!fs.existsSync(apk)) {
    return res.status(404).send("APK not found");
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="armox.apk"');
  res.sendFile(apk);
});

/**
 * مرحله ۱: دریافت آدرس شروع خرید (Server-to-Server به مایکت)
 */
app.post("/api/myket/start", async (req, res) => {
  try {
    assertConfigured();
    const skuId = String(req.body.skuId || "").trim();
    const developerPayload = String(
      req.body.developerPayload || JSON.stringify({ ts: Date.now() })
    );

    if (!skuId) {
      return res.status(400).json({ error: "skuId الزامی است" });
    }
    if (!developerPayload || developerPayload.length > 1024) {
      return res.status(400).json({ error: "developerPayload نامعتبر است" });
    }

    const callbackUrl = `${publicBase(req)}/myket-callback`;
    const startUrl = `${MYKET_API}/${encodeURIComponent(PACKAGE_NAME)}/purchases/iap/start`;

    const myketRes = await fetch(startUrl, {
      method: "POST",
      headers: {
        "X-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skuId, callbackUrl, developerPayload }),
    });

    const data = await safeJson(myketRes);
    if (!myketRes.ok || !data?.url) {
      return res.status(myketRes.status || 502).json({
        error: "شروع خرید ناموفق بود",
        myket: data,
      });
    }

    res.json({ url: data.url, callbackUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || "خطای سرور" });
  }
});

app.get("/api/myket/start", async (req, res) => {
  const skuId = String(req.query.skuId || "").trim();
  if (!skuId) {
    return res.status(400).send("پارامتر skuId لازم است. مثال: /api/myket/start?skuId=GEM2");
  }
  try {
    assertConfigured();
    const developerPayload = String(req.query.payload || JSON.stringify({ ts: Date.now() }));
    const callbackUrl = `${publicBase(req)}/myket-callback`;
    const startUrl = `${MYKET_API}/${encodeURIComponent(PACKAGE_NAME)}/purchases/iap/start`;
    const myketRes = await fetch(startUrl, {
      method: "POST",
      headers: {
        "X-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skuId, callbackUrl, developerPayload }),
    });
    const data = await safeJson(myketRes);
    if (!myketRes.ok || !data?.url) {
      return res.status(myketRes.status || 502).json({ error: "شروع خرید ناموفق", myket: data });
    }
    res.redirect(data.url);
  } catch (err) {
    res.status(500).json({ error: err.message || "خطای سرور" });
  }
});

/**
 * مرحله ۳: کال‌بک مرورگر کاربر (form POST)
 * هرگز محصول را فقط با این کال‌بک تحویل نده — باید Verify شود.
 */
app.post("/myket-callback", async (req, res) => {
  const status = String(req.body.status || "");
  const invoiceRaw = req.body.invoice == null ? "" : String(req.body.invoice);
  const signature = req.body.signature == null ? "" : String(req.body.signature);

  const result = {
    status,
    signatureValid: false,
    verified: false,
    consumed: false,
    invoice: null,
    verify: null,
    consume: null,
    error: null,
  };

  try {
    if (status !== "Successful" && status !== "AlreadyPaid") {
      result.error = status === "Failed" ? "خرید ناموفق بود" : `وضعیت ناشناخته: ${status}`;
      return res.status(200).send(renderResultPage(result));
    }

    if (!invoiceRaw) {
      result.error = "invoice خالی است";
      return res.status(200).send(renderResultPage(result));
    }

    if (PUBLIC_KEY_B64 && signature) {
      result.signatureValid = verifyInvoiceSignature(invoiceRaw, signature, PUBLIC_KEY_B64);
      if (!result.signatureValid) {
        result.error = "امضای دیجیتال نامعتبر است";
        return res.status(400).send(renderResultPage(result));
      }
    }

    let invoice;
    try {
      invoice = JSON.parse(invoiceRaw);
    } catch {
      result.error = "invoice JSON نامعتبر است";
      return res.status(400).send(renderResultPage(result));
    }
    result.invoice = invoice;

    const skuId = invoice.productId;
    const purchaseToken = invoice.purchaseToken;
    if (!skuId || !purchaseToken) {
      result.error = "productId یا purchaseToken در invoice نیست";
      return res.status(400).send(renderResultPage(result));
    }

    const verify = await verifyPurchase(skuId, purchaseToken);
    result.verify = verify.body;
    result.verified = Boolean(
      verify.ok && verify.body && Number(verify.body.purchaseState) === 0
    );

    if (!result.verified) {
      result.error = "صحت‌سنجی خرید از سرور مایکت ناموفق بود";
      return res.status(200).send(renderResultPage(result));
    }

    const tokenKey = `${skuId}:${purchaseToken}`;
    const alreadyGranted = processedTokens.has(tokenKey);
    if (!alreadyGranted) {
      processedTokens.add(tokenKey);
      // اینجا محصول را به کاربر خودتان بدهید (دیتابیس / امتیاز / سکه)
    }

    if (AUTO_CONSUME) {
      const consume = await consumePurchase(skuId, purchaseToken);
      result.consume = consume.body;
      result.consumed = consume.ok;
    }

    return res.status(200).send(renderResultPage(result));
  } catch (err) {
    result.error = err.message || "خطای سرور در کال‌بک";
    return res.status(500).send(renderResultPage(result));
  }
});

app.post("/api/myket/verify", async (req, res) => {
  try {
    assertConfigured();
    const skuId = String(req.body.skuId || "").trim();
    const tokenId = String(req.body.tokenId || req.body.purchaseToken || "").trim();
    if (!skuId || !tokenId) {
      return res.status(400).json({ error: "skuId و tokenId الزامی است" });
    }
    const verify = await verifyPurchase(skuId, tokenId);
    res.status(verify.ok ? 200 : verify.status).json(verify.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/myket/consume", async (req, res) => {
  try {
    assertConfigured();
    const skuId = String(req.body.skuId || "").trim();
    const token = String(req.body.token || req.body.purchaseToken || "").trim();
    if (!skuId || !token) {
      return res.status(400).json({ error: "skuId و token الزامی است" });
    }
    const consume = await consumePurchase(skuId, token);
    res.status(consume.ok ? 200 : consume.status).json(consume.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Armox Myket server listening on 0.0.0.0:${PORT}`);
});

function isConfigured() {
  return Boolean(PACKAGE_NAME && ACCESS_TOKEN);
}

function assertConfigured() {
  if (!PACKAGE_NAME || !ACCESS_TOKEN) {
    throw new Error(
      "MYKET_PACKAGE_NAME و MYKET_ACCESS_TOKEN را در فایل .env تنظیم کنید"
    );
  }
}

function publicBase(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function verifyPurchase(skuId, tokenId) {
  const url = `${MYKET_API}/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(skuId)}/verify`;
  const myketRes = await fetch(url, {
    method: "POST",
    headers: {
      "X-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tokenId }),
  });
  const body = await safeJson(myketRes);
  return { ok: myketRes.ok, status: myketRes.status, body };
}

async function consumePurchase(skuId, token) {
  const url = `${MYKET_API}/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(skuId)}/tokens/${encodeURIComponent(token)}/consume`;
  const myketRes = await fetch(url, {
    method: "PUT",
    headers: {
      "X-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
  });
  const body = await safeJson(myketRes);
  return { ok: myketRes.ok, status: myketRes.status, body };
}

/**
 * امضا روی رشته خام invoice (UTF-8) با SHA1 + RSA PKCS#1 v1.5
 */
function verifyInvoiceSignature(invoiceRaw, signatureBase64, publicKeyBase64) {
  const pem = wrapPem(publicKeyBase64);
  const verifier = crypto.createVerify("SHA1");
  verifier.update(Buffer.from(invoiceRaw, "utf8"));
  verifier.end();
  try {
    return verifier.verify(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

function wrapPem(b64) {
  if (b64.includes("BEGIN PUBLIC KEY")) return b64;
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function renderResultPage(result) {
  const ok = result.verified;
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ok ? "پرداخت موفق" : "نتیجه پرداخت"}</title>
  <style>
    body { font-family: Tahoma, sans-serif; background:#071018; color:#dff; min-height:100vh; display:flex; align-items:center; justify-content:center; margin:0; }
    .card { background:rgba(0,255,180,.08); border:1px solid rgba(0,255,200,.25); border-radius:24px; padding:2rem; max-width:640px; width:92%; }
    h1 { margin-top:0; }
    pre { background:#0008; padding:1rem; overflow:auto; border-radius:12px; direction:ltr; text-align:left; font-size:12px; }
    a { color:#7fffd4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${ok ? "خرید تأیید شد" : "خرید کامل نشد"}</h1>
    <p>وضعیت کال‌بک: ${escapeHtml(result.status || "-")}</p>
    <p>امضا: ${result.signatureValid ? "معتبر" : "بررسی‌نشده/نامعتبر"}</p>
    <p>Verify: ${result.verified ? "موفق (purchaseState=0)" : "ناموفق"}</p>
    <p>Consume: ${result.consumed ? "موفق" : AUTO_CONSUME ? "ناموفق/انجام نشد" : "غیرفعال"}</p>
    ${result.error ? `<p>${escapeHtml(result.error)}</p>` : ""}
    <pre>${escapeHtml(JSON.stringify({ invoice: result.invoice, verify: result.verify, consume: result.consume }, null, 2))}</pre>
    <p><a href="/pay">بازگشت</a></p>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
