/**
 * Crypto Transaction Monitor
 * ============================================================
 * Polls public blockchain APIs to verify that a user has sent
 * the *exact* expected amount to the correct wallet address.
 *
 * Supported coins:
 *   BTC  — Blockstream.info REST API (no key required)
 *   ETH  — Etherscan API (free key required)
 *   LTC  — litecoinspace.org REST API (no key required – Esplora)
 *   USDT — Etherscan API (same key as ETH)
 *
 * Unique-amount strategy
 * ----------------------
 * When a payment request is created we add a random micro-offset
 * (between 0 and 1.99 cents USD) to the base price before
 * converting to coins. The resulting `expectedAmount` is unique
 * enough that two simultaneous orders for the same product can
 * be distinguished purely by the on-chain amount.
 *
 * Tolerance
 * ---------
 * We accept a payment if the received amount is within ±0.5% of
 * `expectedAmount` (to absorb tiny miner-fee rounding differences
 * on USDT transfers or dust).
 */

import { db, cryptoPaymentRequestsTable, productAccessTable, usersTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { PAYMENT_CONFIG } from "../config/payments";
import { paymentNotifications } from "./payment-notifications";
import { sendPurchaseConfirmationEmail } from "./email";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type SupportedCoin = "BTC" | "ETH" | "LTC" | "USDT" | "USDC" | "SOL";

/** Coin price cache so we don't hammer CoinGecko on every request */
interface PriceCache {
  usdPerBtc: number;
  usdPerEth: number;
  usdPerLtc: number;
  usdPerSol: number;
  fetchedAt: number; // epoch ms
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const CRYPTO_MONITOR_ENABLED = process.env.CRYPTO_MONITOR_ENABLED === "true";
const POLL_INTERVAL_MS = Number(process.env.CRYPTO_MONITOR_POLL_INTERVAL_MS || "30000"); // 30 seconds
const MAX_PENDING_CHECKS = Number(process.env.CRYPTO_MONITOR_MAX_PENDING || "20");
const TOLERANCE = 0.005; // ±0.5%
const PRICE_TTL_MS = 5 * 60 * 1_000; // refresh prices every 5 min
const USDT_DECIMALS = 1_000_000; // USDT uses 6 decimals on Ethereum
const SATOSHIS_PER_BTC = 1e8;
const WEI_PER_ETH = 1e18;
const LITOSHIS_PER_LTC = 1e8;

// ──────────────────────────────────────────────────────────────
// Price fetching
// ──────────────────────────────────────────────────────────────

let priceCache: PriceCache | null = null;

export async function fetchCoinPrices(): Promise<PriceCache> {
  const now = Date.now();
  if (priceCache && now - priceCache.fetchedAt < PRICE_TTL_MS) {
    return priceCache;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,solana&vs_currencies=usd",
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json() as any;
    priceCache = {
      usdPerBtc: data.bitcoin.usd,
      usdPerEth: data.ethereum.usd,
      usdPerLtc: data.litecoin.usd,
      usdPerSol: data.solana.usd,
      fetchedAt: now,
    };
    return priceCache;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch coin prices from CoinGecko");
    // Return last known prices, or throw if we have none
    if (priceCache) return priceCache;
    throw err;
  }
}

/**
 * Convert a USD amount to the specified coin, returning the coin amount
 * rounded to 8 decimal places.
 */
export async function usdToCoin(usd: number, coin: SupportedCoin): Promise<number> {
  const prices = await fetchCoinPrices();
  switch (coin) {
    case "BTC": return parseFloat((usd / prices.usdPerBtc).toFixed(8));
    case "ETH": return parseFloat((usd / prices.usdPerEth).toFixed(8));
    case "LTC": return parseFloat((usd / prices.usdPerLtc).toFixed(8));
    case "SOL": return parseFloat((usd / prices.usdPerSol).toFixed(8));
    case "USDT": return parseFloat(usd.toFixed(6)); // 1 USDT ≈ 1 USD
    case "USDC": return parseFloat(usd.toFixed(6)); // 1 USDC ≈ 1 USD
  }
}

/**
 * Generate a random micro-offset in USD cents (0 – 1.99 cents).
 * Returns the value in USD (so 0 – 0.0199).
 */
export function generateMicroOffsetUsd(): number {
  const cents = Math.random() * 1.99; // 0 – 1.99 cents
  return parseFloat((cents / 100).toFixed(6));
}

// ──────────────────────────────────────────────────────────────
// Blockchain API helpers
// ──────────────────────────────────────────────────────────────

/** Returns list of UTXOs/txs for a BTC address via Blockstream */
async function fetchBtcTransactions(address: string): Promise<Array<{ txid: string; value: number; block_height: number | null }>> {
  const res = await fetch(
    `https://blockstream.info/api/address/${address}/txs`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const txs = await res.json() as any[];
  const results: Array<{ txid: string; value: number; block_height: number | null }> = [];

  for (const tx of txs) {
    for (const vout of tx.vout as any[]) {
      if (vout.scriptpubkey_address === address) {
        results.push({
          txid: tx.txid,
          value: vout.value / SATOSHIS_PER_BTC,
          block_height: tx.status?.block_height ?? null,
        });
      }
    }
  }
  return results;
}

/** Returns ETH or USDT/USDC-ERC20 transfers for an address via Etherscan */
async function fetchEthTransactions(
  address: string,
  coin: "ETH" | "USDT" | "USDC"
): Promise<Array<{ txid: string; value: number; block_height: number | null }>> {
  const apiKey = PAYMENT_CONFIG.ETHERSCAN_API_KEY;

  let url: string;
  if (coin === "ETH") {
    url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  } else {
    // USDT or USDC contract on mainnet
    const contract = coin === "USDT"
      ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
      : "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC
    url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${contract}&address=${address}&sort=desc&apikey=${apiKey}`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json() as any;
    if (data.status !== "1") return [];

    return data.result.map((tx: any) => ({
      txid: tx.hash,
      value: coin === "ETH"
        ? parseInt(tx.value, 10) / WEI_PER_ETH
        : parseInt(tx.value, 10) / USDT_DECIMALS,
      block_height: tx.blockNumber ? parseInt(tx.blockNumber, 10) : null,
    }));
  } catch {
    return [];
  }
}

/** Returns LTC transactions via litecoinspace.org (Esplora-compatible API) */
async function fetchLtcTransactions(address: string): Promise<Array<{ txid: string; value: number; block_height: number | null }>> {
  try {
    const res = await fetch(
      `https://litecoinspace.org/api/address/${address}/txs`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const txs = await res.json() as any[];
    const results: Array<{ txid: string; value: number; block_height: number | null }> = [];

    for (const tx of txs) {
      for (const vout of tx.vout as any[]) {
        if (vout.scriptpubkey_address === address) {
          results.push({
            txid: tx.txid,
            value: vout.value / LITOSHIS_PER_LTC,
            block_height: tx.status?.block_height ?? null,
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

/** Returns SOL transactions via Public Solana RPC with batch optimization */
async function fetchSolTransactions(address: string): Promise<Array<{ txid: string; value: number; block_height: number | null }>> {
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit: 5 }] // Reduced from 10 to 5 to minimize RPC calls
      }),
      signal: AbortSignal.timeout(8_000)
    });

    if (!res.ok) return [];
    const data = await res.json() as any;
    if (!data.result) return [];

    const signatures = data.result.map((s: any) => s.signature);
    const results: Array<{ txid: string; value: number; block_height: number | null }> = [];

    // Use batch RPC calls instead of sequential to reduce RPC count
    // Create batch requests for up to 5 transactions
    const batchPayload = signatures.slice(0, 5).map((sig: string, idx: number) => ({
      jsonrpc: "2.0",
      id: idx + 1,
      method: "getTransaction",
      params: [sig, { encoding: "json", maxSupportedTransactionVersion: 0 }]
    }));

    if (batchPayload.length === 0) return [];

    const batchRes = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPayload),
      signal: AbortSignal.timeout(12_000)
    });

    if (!batchRes.ok) return [];
    const batchData = await batchRes.json() as any;
    if (!Array.isArray(batchData)) return [];

    // Process batch results
    for (const txResult of batchData) {
      if (!txResult.result) continue;
      const tx = txResult.result;

      // Calculate balance change for the monitored address
      const accountIndex = tx.transaction.message.accountKeys.findIndex((k: any) => k === address);
      if (accountIndex === -1) continue;

      const preBalance = tx.meta.preBalances[accountIndex];
      const postBalance = tx.meta.postBalances[accountIndex];
      const change = (postBalance - preBalance) / 1e9; // Lamports to SOL

      if (change > 0) {
        results.push({
          txid: signatures[txResult.id - 1],
          value: change,
          block_height: tx.slot,
        });
      }
    }
    return results;
  } catch (err) {
    logger.warn({ err, address }, "Error fetching Solana transactions");
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Payment verification logic
// ──────────────────────────────────────────────────────────────

// Rate limiting per coin to prevent API throttling
const coinRequestTimes = new Map<string, number>(); // coin -> last request time (ms)
const MIN_REQUEST_INTERVAL_MS = Number(process.env.CRYPTO_MIN_REQUEST_INTERVAL_MS || "1000"); // 1 second between same-coin requests

function isWithinTolerance(received: number, expected: number): boolean {
  if (expected === 0) return false;
  return Math.abs(received - expected) / expected <= TOLERANCE;
}

/**
 * Check if enough time has passed since the last request for this coin
 */
function canMakeRequest(coin: string): boolean {
  const lastTime = coinRequestTimes.get(coin) || 0;
  const now = Date.now();
  return now - lastTime >= MIN_REQUEST_INTERVAL_MS;
}

/**
 * Record that a request was made for this coin
 */
function recordRequest(coin: string): void {
  coinRequestTimes.set(coin, Date.now());
}

async function checkPendingRequest(
  req: typeof cryptoPaymentRequestsTable.$inferSelect
): Promise<void> {
  const expected = parseFloat(req.expectedAmount as unknown as string);
  
  // Rate limit: skip if this coin was checked recently
  if (!canMakeRequest(req.coin)) {
    logger.debug({ requestId: req.id, coin: req.coin }, "Rate limited - skipping check");
    return;
  }

  let txs: Array<{ txid: string; value: number; block_height: number | null }> = [];

  try {
    switch (req.coin) {
      case "BTC":
        txs = await fetchBtcTransactions(req.walletAddress);
        break;
      case "ETH":
        txs = await fetchEthTransactions(req.walletAddress, "ETH");
        break;
      case "LTC":
        txs = await fetchLtcTransactions(req.walletAddress);
        break;
      case "USDT_ERC20":
        txs = await fetchEthTransactions(req.walletAddress, "USDT");
        break;
      case "USDC_ERC20":
        txs = await fetchEthTransactions(req.walletAddress, "USDC");
        break;
      case "SOL":
        txs = await fetchSolTransactions(req.walletAddress);
        break;
    }
    
    // Record that we made a request for this coin
    recordRequest(req.coin);
  } catch (err) {
    logger.warn({ err, requestId: req.id }, "Error fetching blockchain data");
    return;
  }

  const match = txs.find(tx => isWithinTolerance(tx.value, expected));
  if (!match) return;

  logger.info({ requestId: req.id, txHash: match.txid, coin: req.coin }, "Crypto payment confirmed!");

  // Mark confirmed
  await db
    .update(cryptoPaymentRequestsTable)
    .set({
      status: "confirmed",
      txHash: match.txid,
      confirmedBlock: match.block_height ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(cryptoPaymentRequestsTable.id, req.id));

  // Grant product access for 30 days
  try {
    const productIds: string[] = JSON.parse(req.upgradeIds);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Get the first product to set as the main subscription type
    const firstProduct = productIds[0];
    const upgradeType = firstProduct ? `${firstProduct}_PREMIUM` : null;

    for (const productId of productIds) {
      await db.insert(productAccessTable).values({
        userId: req.userId,
        productId,
        expiresAt,
        paymentRef: `crypto:${req.coin}:${match.txid}`,
      });
    }

    await db
      .update(usersTable)
      .set({ upgradeType, upgradeExpiresAt: expiresAt })
      .where(eq(usersTable.id, req.userId));

    logger.info(
      { userId: req.userId, productIds },
      "Product access granted after crypto payment"
    );

    // Emit real-time notification for immediate client update
    paymentNotifications.emitPaymentConfirmed({
      requestId: req.id,
      userId: req.userId,
      productIds,
      coin: req.coin,
      txHash: match.txid,
      confirmedBlock: match.block_height ?? null,
      timestamp: new Date(),
    });

    // Send purchase confirmation email to user
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
    if (user.length > 0) {
      const userEmail = user[0].email;
      const productNames = productIds.length > 0 ? productIds.map(id => id.toUpperCase()).join(" + ") : "Products";
      
      // Determine crypto method label
      let methodLabel: string = req.coin;
      if (req.coin === "USDT_ERC20" || req.coin === "USDC_ERC20") {
        methodLabel = req.coin.replace("_ERC20", " (ERC-20)");
      }

      await sendPurchaseConfirmationEmail(
        userEmail,
        user[0].username || "User",
        productIds,
        "crypto",
        match.txid,
        expiresAt
      );
      
      logger.info({ userId: req.userId, email: userEmail }, "Purchase confirmation email sent");
    }
  } catch (err) {
    logger.error({ err, requestId: req.id }, "Failed to grant product access after crypto confirmation");
  }
}

async function expireStaleRequests(): Promise<void> {
  const now = new Date();
  const result = await db
    .update(cryptoPaymentRequestsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(cryptoPaymentRequestsTable.status, "pending"),
        lt(cryptoPaymentRequestsTable.expiresAt, now)
      )
    );
  if ((result as any).rowCount > 0) {
    logger.info({ count: (result as any).rowCount }, "Expired stale crypto payment requests");
  }
}

// ──────────────────────────────────────────────────────────────
// Main poll loop
// ──────────────────────────────────────────────────────────────

let monitorRunning = false;
let monitorInFlight = false;

export async function startCryptoMonitor(): Promise<void> {
  if (!CRYPTO_MONITOR_ENABLED) {
    logger.info("Crypto payment monitor disabled (CRYPTO_MONITOR_ENABLED is not 'true')");
    return;
  }

  if (monitorRunning) {
    logger.warn("Crypto payment monitor already running");
    return;
  }

  monitorRunning = true;
  logger.info("Crypto payment monitor started");

  const tick = async () => {
    if (monitorInFlight) {
      logger.warn("Crypto monitor tick skipped: previous tick still in progress");
      return;
    }

    monitorInFlight = true;
    try {
      await expireStaleRequests();

      const pending = await db
        .select()
        .from(cryptoPaymentRequestsTable)
        .where(eq(cryptoPaymentRequestsTable.status, "pending"))
        .limit(MAX_PENDING_CHECKS);

      if (pending.length === 0) {
        logger.debug("No pending crypto requests to check");
      } else {
        logger.info({ count: pending.length }, "Checking pending crypto requests");
      }

      await Promise.allSettled(pending.map((payReq: typeof cryptoPaymentRequestsTable.$inferSelect) => checkPendingRequest(payReq)));
    } catch (err) {
      logger.error({ err }, "Error in crypto monitor tick");
    } finally {
      monitorInFlight = false;
    }
  };

  // Start after short delay to avoid app startup race conditions
  setTimeout(tick, 1_000);
  setInterval(tick, POLL_INTERVAL_MS);
}
