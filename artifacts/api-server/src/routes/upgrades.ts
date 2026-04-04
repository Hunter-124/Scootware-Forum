import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { PRODUCT_IDS, inviteCodesTable, productAccessTable } from "@workspace/db";
import { PAYMENT_CONFIG } from "../config/payments";
import { eq } from "drizzle-orm";
import { db, siteConfigTable } from "@workspace/db";
import {
  usdToCoin,
  generateMicroOffsetUsd,
  type SupportedCoin,
} from "../lib/crypto-monitor";
import { paymentNotifications } from "../lib/payment-notifications";
import { getEmailTemplate, type EmailTemplate } from "../lib/email";
import Stripe from "stripe";
import type { Logger } from "pino";

// Extend Express Request type with pino logger property
declare global {
  namespace Express {
    interface Request {
      log?: Logger;
    }
  }
}

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Default product definitions (base values)
function buildDefaultProducts() {
  return PRODUCT_IDS.map(id => ({
    id,
    name: id === "SPOOFER" ? "HWID Spoofer" : `${id} Access`,
    description: id === "SPOOFER" ? "Advanced HWID protection for all games." : `Exclusive access to ${id} software and updates.`,
    price: id === "SPOOFER" ? 9.99 : 19.99,
    durationDays: 30,
    inviteOnly: false,
    // optional bulk settings will be merged from site config
    bulkQuantity: undefined,
    bulkDiscountPercent: undefined,
    features: id === "SPOOFER" ? [
      "Full HWID protection",
      "Kernel-level spoofing",
      "One-click operation",
      "Priority support"
    ] : [
      "Full product capabilities",
      `Access to ${id} private forum`,
      "Configuration sharing",
      "Priority community support"
    ]
  }));
}

async function getConfiguredProducts() {
  // Read products override from site config table (stored as JSON under key 'products')
  try {
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "products"));
    if (!rows || rows.length === 0) return buildDefaultProducts();
    const row = rows[0];
    let productsConfig = {} as any;
    try { productsConfig = JSON.parse(row.value); } catch (e) { productsConfig = {}; }

    const defaults = buildDefaultProducts();
    // Merge config entries into defaults
    return defaults.map(p => {
      const cfg = productsConfig[p.id];
      if (!cfg) return p;
      return {
        ...p,
        price: typeof cfg.price === 'number' ? cfg.price : p.price,
        bulkQuantity: cfg.bulkQuantity !== undefined ? Number(cfg.bulkQuantity) : p.bulkQuantity,
        bulkDiscountPercent: cfg.bulkDiscountPercent !== undefined ? Number(cfg.bulkDiscountPercent) : p.bulkDiscountPercent,
        inviteOnly: cfg.inviteOnly === true || p.inviteOnly,
      };
    });
  } catch (err) {
    // On error, return defaults
    return buildDefaultProducts();
  }
}

router.get("/", async (_req, res: Response) => {
  const products = await getConfiguredProducts();
  res.json(products);
});

// ──────────────────────────────────────────────────────────────
// Crypto Health Check
// GET /api/upgrades/crypto/health
// Checks if CoinGecko and Wallets are working.
// ──────────────────────────────────────────────────────────────

router.get("/crypto/health", async (req: Request, res: Response): Promise<any> => {
  try {
    const { fetchCoinPrices } = await import("../lib/crypto-monitor");

    // Check CoinGecko API
    const prices = await fetchCoinPrices();

    // Check Wallet Configuration
    const wallets = PAYMENT_CONFIG.CRYPTO_WALLETS;
    const missingWallets = Object.entries(wallets)
      .filter(([_, addr]) => !addr || addr.includes("placeholder") || addr.includes("YOUR"))
      .map(([coin]) => coin);

    const isHealthy = missingWallets.length === 0 && !!prices;

    return res.json({
      status: isHealthy ? "healthy" : "degraded",
      details: {
        coinGecko: !!prices,
        missingWallets: missingWallets.length > 0 ? missingWallets : null,
        etherscan: !!PAYMENT_CONFIG.ETHERSCAN_API_KEY
      }
    });
  } catch (err) {
    req.log.error({ err }, "Crypto health check failed");
    return res.status(503).json({
      status: "unhealthy",
      error: "Crypto payment services are currently unavailable."
    });
  }
});


// ──────────────────────────────────────────────────────────────
// Standard (Stripe / PayPal / Google Pay) purchase initiation
// ──────────────────────────────────────────────────────────────

const purchaseSchema = z.object({
  productIds: z.array(z.string()).min(1),
});

router.post("/purchase", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const parse = purchaseSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid product IDs array" });
  }

  const requestedIds: string[] = parse.data.productIds;
  const PRODUCTS = await getConfiguredProducts();

  // Validate
  const invalid = requestedIds.find(id => !PRODUCTS.find(p => p.id === id));
  if (invalid) return res.status(404).json({ error: `Product not found: ${invalid}` });

  const inviteOnlyRequested = requestedIds.find(id => {
    const product = PRODUCTS.find(p => p.id === id);
    return product?.inviteOnly;
  });
  if (inviteOnlyRequested) {
    return res.status(403).json({ error: `Product ${inviteOnlyRequested} is invite-only and must be redeemed via invite code before purchase.` });
  }

  // Build quantity map
  const qtyMap: Record<string, number> = {};
  for (const id of requestedIds) qtyMap[id] = (qtyMap[id] || 0) + 1;

  let totalAmount = 0;
  const singles: any[] = [];

  // Apply bulk pricing where configured
  for (const [id, qty] of Object.entries(qtyMap)) {
    const product = PRODUCTS.find(p => p.id === id)!;
    if (qty > 1 && product.bulkQuantity && product.bulkDiscountPercent && qty >= product.bulkQuantity) {
      const discountedUnit = product.price * (1 - (product.bulkDiscountPercent / 100));
      totalAmount += discountedUnit * qty;
    } else if (qty > 1) {
      // add qty copies to singles for bundle calculation
      for (let i = 0; i < qty; i++) singles.push(product);
    } else {
      singles.push(product);
    }
  }

  // Apply bundle multipliers to singles (sort by price desc)
  singles.sort((a, b) => b.price - a.price);
  singles.forEach((product, index) => {
    let multiplier = 1.0;
    if (index === 1) multiplier = 0.75;
    else if (index >= 2) multiplier = 0.50;
    totalAmount += product.price * multiplier;
  });

  // If Stripe is configured, create a Checkout Session and return its URL
  if (PAYMENT_CONFIG.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(PAYMENT_CONFIG.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Scootware Purchase",
                description: `Products: ${requestedIds.join(",")}`
              },
              unit_amount: Math.round(totalAmount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          productIds: JSON.stringify(requestedIds),
          userId: String((req.user as any)?.id ?? "")
        },
        success_url: `${siteUrl}/?checkout_success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/store?checkout_cancel=1`,
      });

      return res.json({
        totalAmount: Number(totalAmount.toFixed(2)),
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        config: PAYMENT_CONFIG,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to create Stripe Checkout session");
      // Fall through to legacy simulated clientSecret fallback
    }
  }

  const clientSecret = `pi_test_${Math.random().toString(36).substring(7)}_secret_${Math.random().toString(36).substring(7)}`;

  return res.json({
    totalAmount: Number(totalAmount.toFixed(2)),
    clientSecret,
    config: PAYMENT_CONFIG,
  });
});

const redeemInviteSchema = z.object({
  productId: z.string().min(1),
  code: z.string().min(1),
});

router.post('/redeem-invite', requireAuth, async (req: Request, res: Response) => {
  const parse = redeemInviteSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid request' });

  const { productId, code } = parse.data;
  const user = req.user as any;

  try {
    const products = await getConfiguredProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.inviteOnly) {
      return res.status(400).json({ error: 'This product does not require an invite to redeem' });
    }

    const [invite] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, code.toUpperCase())).limit(1);
    if (!invite || invite.isBanned || invite.isUsed) {
      return res.status(400).json({ error: 'Invalid or already used invite code' });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }
    if (invite.productId && invite.productId !== productId) {
      return res.status(400).json({ error: 'Invite code not valid for this product' });
    }

    await db.update(inviteCodesTable).set({ isUsed: true, usedBy: user.id, usedAt: new Date() }).where(eq(inviteCodesTable.id, invite.id));
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
    await db.insert(productAccessTable).values({ userId: user.id, productId, expiresAt: expiry, paymentRef: `invite-${invite.id}` });

    return res.json({ message: 'Invite redeemed, product access granted', productId, accessUntil: expiry });
  } catch (err) {
    req.log.error({ err }, 'Redeem invite error');
    return res.status(500).json({ error: 'Failed to redeem invite' });
  }
});

// ──────────────────────────────────────────────────────────────
// Standard payment verification (Stripe / PayPal / Google Pay webhook path)
// ──────────────────────────────────────────────────────────────

const verifySchema = z.object({
  clientSecret: z.string(),
  productIds: z.array(z.string())
});

router.post("/verify-payment", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = req.user as any;
  const parse = verifySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid payload" });

  try {
    const { productAccessTable, usersTable, db } = await import("@workspace/db");

    // Grant access for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Get the first product to set as the main subscription type
    const firstProduct = parse.data.productIds[0];
    const upgradeType = firstProduct ? `${firstProduct}_PREMIUM` : null;

    for (const productId of parse.data.productIds) {
      await db.insert(productAccessTable).values({
        userId: user.id,
        productId,
        expiresAt,
        paymentRef: parse.data.clientSecret
      });
    }

    // Also update legacy single-upgrade field for layout compatibility
    await db.update(usersTable).set({
      upgradeType,
      upgradeExpiresAt: expiresAt
    }).where(eq(usersTable.id, user.id));

    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

// ──────────────────────────────────────────────────────────────
// Crypto payment: initiate
// POST /api/upgrades/crypto/initiate
// Body: { upgradeIds: string[], coin: "BTC"|"ETH"|"LTC"|"USDT"|"USDC"|"SOL" }
// Returns: { requestId, walletAddress, expectedAmount, coin, expiresAt, usdAmount }
// ──────────────────────────────────────────────────────────────

const cryptoInitiateSchema = z.object({
  productIds: z.array(z.string()).min(1),
  coin: z.enum(["BTC", "ETH", "LTC", "USDT", "USDC", "SOL"]),
});

router.post(
  "/crypto/initiate",
  requireAuth,
  async (req: Request, res: Response): Promise<any> => {
    const user = req.user as any;
    const parse = cryptoInitiateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid payload", details: parse.error.flatten() });
    }

    const { productIds, coin } = parse.data as { productIds: string[]; coin: SupportedCoin };

    // Validate product IDs and load configured products
    const PRODUCTS = await getConfiguredProducts();
    const invalid = productIds.find(id => !PRODUCTS.find(p => p.id === id));
    if (invalid) return res.status(404).json({ error: `One or more product IDs are invalid: ${invalid}` });

    // Build qty map
    const qtyMap: Record<string, number> = {};
    for (const id of productIds) qtyMap[id] = (qtyMap[id] || 0) + 1;

    let usdTotal = 0;
    const singles: any[] = [];

    // Apply bulk pricing
    for (const [id, qty] of Object.entries(qtyMap)) {
      const product = PRODUCTS.find(p => p.id === id)!;
      if (qty > 1 && product.bulkQuantity && product.bulkDiscountPercent && qty >= product.bulkQuantity) {
        const discountedUnit = product.price * (1 - (product.bulkDiscountPercent / 100));
        usdTotal += discountedUnit * qty;
      } else if (qty > 1) {
        for (let i = 0; i < qty; i++) singles.push(product);
      } else {
        singles.push(product);
      }
    }

    // Apply bundle multipliers to singles
    singles.sort((a, b) => b.price - a.price);
    singles.forEach((product, index) => {
      let multiplier = 1.0;
      if (index === 1) multiplier = 0.75;
      else if (index >= 2) multiplier = 0.50;
      usdTotal += product.price * multiplier;
    });
    usdTotal = parseFloat(usdTotal.toFixed(4));

    // Add micro-offset to make this payment uniquely identifiable on-chain
    const microOffsetUsd = generateMicroOffsetUsd();
    const totalWithOffset = parseFloat((usdTotal + microOffsetUsd).toFixed(6));

    // Convert USD → coin amount
    let expectedAmount: number;
    try {
      expectedAmount = await usdToCoin(totalWithOffset, coin);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch coin price");
      return res.status(503).json({ error: "Could not fetch current coin price. Please try again." });
    }

    // Resolve wallet address for chosen coin
    const walletMap: Record<SupportedCoin, string> = {
      BTC: PAYMENT_CONFIG.CRYPTO_WALLETS.BTC,
      ETH: PAYMENT_CONFIG.CRYPTO_WALLETS.ETH,
      LTC: PAYMENT_CONFIG.CRYPTO_WALLETS.LTC,
      USDT: PAYMENT_CONFIG.CRYPTO_WALLETS.USDT,
      USDC: PAYMENT_CONFIG.CRYPTO_WALLETS.USDC,
      SOL: PAYMENT_CONFIG.CRYPTO_WALLETS.SOL,
    };
    const walletAddress = walletMap[coin];

    // Map client-friendly names into DB enum values
    const dbCoinMap: Record<SupportedCoin, "BTC" | "ETH" | "LTC" | "USDT_ERC20" | "USDC_ERC20" | "SOL"> = {
      BTC: "BTC",
      ETH: "ETH",
      LTC: "LTC",
      USDT: "USDT_ERC20",
      USDC: "USDC_ERC20",
      SOL: "SOL",
    };
    const dbCoin = dbCoinMap[coin];

    // Payment expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1_000);

    try {
      const { cryptoPaymentRequestsTable, db } = await import("@workspace/db");

      const [inserted] = await db
        .insert(cryptoPaymentRequestsTable)
        .values({
          userId: user.id,
          upgradeIds: JSON.stringify(productIds),
          coin: dbCoin,
          walletAddress,
          expectedAmount: expectedAmount.toString(),
          usdAmount: usdTotal.toString(),
          microOffsetCents: (microOffsetUsd * 100).toString(),
          expiresAt,
        })
        .returning();

      return res.status(201).json({
        requestId: inserted.id,
        walletAddress,
        expectedAmount,
        coin,
        expiresAt: expiresAt.toISOString(),
        usdAmount: usdTotal,
        microOffsetCents: parseFloat((microOffsetUsd * 100).toFixed(4)),
        productIds,
        message: `Send EXACTLY ${expectedAmount} ${coin} to the address above. Do not round — the exact amount identifies your order.`,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to create crypto payment request");
      return res.status(500).json({ error: "Failed to create payment request" });
    }
  }
);

// ──────────────────────────────────────────────────────────────
// Crypto payment: status poll
// GET /api/upgrades/crypto/status/:requestId
// Returns: { status, txHash, confirmedBlock, expiresAt, coin, expectedAmount }
// ──────────────────────────────────────────────────────────────

router.get(
  "/crypto/status/:requestId",
  requireAuth,
  async (req: Request, res: Response): Promise<any> => {
    const user = req.user as any;
    const requestId = parseInt(req.params.requestId as string, 10);
    if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

    try {
      const { cryptoPaymentRequestsTable, db } = await import("@workspace/db");

      const [record] = await db
        .select()
        .from(cryptoPaymentRequestsTable)
        .where(eq(cryptoPaymentRequestsTable.id, requestId));

      if (!record) return res.status(404).json({ error: "Payment request not found" });
      if (record.userId !== user.id) return res.status(403).json({ error: "Forbidden" });

      return res.json({
        requestId: record.id,
        status: record.status,
        coin: record.coin,
        walletAddress: record.walletAddress,
        expectedAmount: parseFloat(record.expectedAmount as unknown as string),
        usdAmount: parseFloat(record.usdAmount as unknown as string),
        txHash: record.txHash,
        confirmedBlock: record.confirmedBlock,
        expiresAt: record.expiresAt.toISOString(),
        productIds: JSON.parse(record.upgradeIds),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch crypto payment status");
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

// Stripe webhook endpoint (expects raw body captured by app.json verify)
router.post("/stripe-webhook", async (req: Request, res: Response) => {
  const sig = (req.headers["stripe-signature"] as string) || undefined;
  const rawBody = (req as any).rawBody;

  if (!PAYMENT_CONFIG.STRIPE_SECRET_KEY || !PAYMENT_CONFIG.STRIPE_WEBHOOK_SECRET) {
    req.log?.warn("Stripe webhook called but Stripe is not configured");
    return res.status(400).send("Stripe not configured");
  }

  const stripe = new Stripe(PAYMENT_CONFIG.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig as string, PAYMENT_CONFIG.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    req.log?.error({ err }, "Invalid Stripe webhook signature");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const metadata = session.metadata || {};
    const productIds = metadata.productIds ? JSON.parse(metadata.productIds) : [];
    const userId = metadata.userId ? parseInt(metadata.userId, 10) : null;

    try {
      const { productAccessTable, usersTable, db } = await import("@workspace/db");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      if (userId) {
        // Get the first product to set as the main subscription type
        const firstProduct = productIds[0];
        const upgradeType = firstProduct ? `${firstProduct}_PREMIUM` : null;

        for (const productId of productIds) {
          await db.insert(productAccessTable).values({
            userId,
            productId,
            expiresAt,
            paymentRef: `stripe:${session.payment_intent ?? session.id}`,
          });
        }

        await db.update(usersTable).set({ upgradeType, upgradeExpiresAt: expiresAt }).where(eq(usersTable.id, userId));
      } else {
        req.log?.warn({ session }, "Stripe checkout completed with no userId metadata");
      }
    } catch (err) {
      req.log?.error({ err }, "Failed granting access after Stripe checkout");
    }
  }

  return res.json({ received: true });
});

// ──────────────────────────────────────────────────────────────
// Crypto payment: real-time notifications (Server-Sent Events)
// GET /api/upgrades/crypto/subscribe
// Subscribes to payment confirmation events for the current user.
// ──────────────────────────────────────────────────────────────

router.get("/crypto/subscribe", requireAuth, (req: Request, res: Response): any => {
  const user = req.user as any;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send initial connection confirmation
  res.write(`:connected\n\n`);

  // Handle payment confirmation events for this user
  const handlePaymentConfirmed = (event: any) => {
    if (event.userId === userId) {
      res.write(
        `data: ${JSON.stringify({
          type: "payment-confirmed",
          requestId: event.requestId,
          productIds: event.productIds,
          coin: event.coin,
          txHash: event.txHash,
          confirmedAt: event.timestamp,
        })}\n\n`
      );
    }
  };

  // Subscribe to events
  paymentNotifications.on("payment-confirmed", handlePaymentConfirmed);

  // Handle client disconnect
  req.on("close", () => {
    paymentNotifications.off("payment-confirmed", handlePaymentConfirmed);
    res.end();
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000); // Send heartbeat every 30 seconds

  req.on("close", () => {
    clearInterval(heartbeat);
  });
});

// ──────────────────────────────────────────────────────────────
// Email Template Management (Admin Only)
// GET /api/upgrades/admin/email-templates/:templateKey
// Returns the email template for editing
// ──────────────────────────────────────────────────────────────

router.get("/admin/email-templates/:templateKey", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = req.user as any;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const templateKey = req.params.templateKey;
    const template = await getEmailTemplate(templateKey);
    return res.json({ templateKey, template });
  } catch (err) {
    req.log?.error({ err }, "Failed to fetch email template");
    return res.status(500).json({ error: "Failed to fetch email template" });
  }
});

// ──────────────────────────────────────────────────────────────
// Email Template Management (Admin Only)
// POST /api/upgrades/admin/email-templates/:templateKey
// Saves the email template
// ──────────────────────────────────────────────────────────────

const emailTemplateSchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

router.post("/admin/email-templates/:templateKey", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = req.user as any;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const templateKey = req.params.templateKey;
    const parse = emailTemplateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid template data" });
    }

    const templateData = parse.data;
    await db
      .insert(siteConfigTable)
      .values({ key: templateKey, value: JSON.stringify(templateData) })
      .onConflictDoUpdate({
        target: siteConfigTable.key,
        set: { value: JSON.stringify(templateData) },
      });

    req.log?.info({ templateKey }, "Email template updated");
    return res.json({ message: "Email template updated successfully", templateKey });
  } catch (err) {
    req.log?.error({ err }, "Failed to save email template");
    return res.status(500).json({ error: "Failed to save email template" });
  }
});

// ──────────────────────────────────────────────────────────────
// Get All Email Templates Info (Admin Only)
// GET /api/upgrades/admin/email-templates
// Returns list of all available templates
// ──────────────────────────────────────────────────────────────

router.get("/admin/email-templates", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = req.user as any;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const templates = [
    {
      key: "purchase_confirmation",
      name: "Purchase Confirmation",
      description: "Email sent when a customer completes a purchase",
      variables: [
        "~username~ - Customer's username",
        "~product~ - Product name(s)",
        "~method~ - Payment method (CRYPTO, STRIPE, etc.)",
        "~transaction_id~ - Transaction/Order ID",
        "~expiry_date~ - Access expiration date",
      ],
    },
  ];

  return res.json({ templates });
});

export default router;
