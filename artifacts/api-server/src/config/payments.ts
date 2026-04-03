const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optionalEnv = (key: string, defaultValue = ""): string => process.env[key] ?? defaultValue;

export const PAYMENT_CONFIG = {
  // Stripe Settings (can be absent in non-Stripe deployments)
  STRIPE_PUBLIC_KEY: optionalEnv("STRIPE_PUBLIC_KEY"),
  STRIPE_SECRET_KEY: optionalEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optionalEnv("STRIPE_WEBHOOK_SECRET"),

  // PayPal Settings (can be absent in non-PayPal deployments)
  PAYPAL_CLIENT_ID: optionalEnv("PAYPAL_CLIENT_ID"),
  PAYPAL_CLIENT_SECRET: optionalEnv("PAYPAL_CLIENT_SECRET"),
  PAYPAL_ENVIRONMENT: optionalEnv("PAYPAL_ENVIRONMENT", "sandbox"),

  // Google Pay Settings
  GPLAY_MERCHANT_ID: optionalEnv("GPLAY_MERCHANT_ID"),

  // Crypto Wallet Addresses (must be configured in env)
  CRYPTO_WALLETS: {
    BTC: requiredEnv("CRYPTO_BTC_WALLET"),
    ETH: requiredEnv("CRYPTO_ETH_WALLET"),
    LTC: requiredEnv("CRYPTO_LTC_WALLET"),
    USDT: requiredEnv("CRYPTO_USDT_WALLET"),
    USDC: requiredEnv("CRYPTO_USDC_WALLET"),
    SOL: requiredEnv("CRYPTO_SOL_WALLET"),
  },

  // Blockchain explorer API keys (Etherscan required for ETH/USDT/USDC checks)
  ETHERSCAN_API_KEY: requiredEnv("ETHERSCAN_API_KEY"),
};
