# Payment Processors Setup TODO

This document outlines the required steps and keys needed to fully integrate Stripe, PayPal, and Google Pay into the Scootware Forum. 

Currently, the checkout modal uses a simulated "mock" process. To go live, you must fill in the correct keys in your `.env` file and replace the mock payment logic with the respective SDKs.

## 1. Stripe Setup
Stripe is used for processing credit cards and seamlessly handles Apple Pay and Google Pay if configured.
**How to obtain keys:**
1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/register).
2. Create an account and a new business.
3. In the upper right corner, toggle **Test Mode** on while testing.
4. Navigate to **Developers > API Keys**.
5. Copy the **Publishable key** (`pk_test_...` or `pk_live_...`) into `.env` as `STRIPE_PUBLIC_KEY`.
6. Copy the **Secret key** (`sk_test_...` or `sk_live_...`) into `.env` as `STRIPE_SECRET_KEY`.
7. Navigate to **Developers > Webhooks**, add an endpoint (e.g., `https://scootware.us/api/upgrades/stripe-webhook`), and copy the corresponding **Webhook Secret**. Set this as `STRIPE_WEBHOOK_SECRET` in `.env`.

## 2. PayPal Setup
**How to obtain keys:**
1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/).
2. Log in with a PayPal Business account.
3. Go to **Apps & Credentials** and click **Create App**.
4. Choose **Platform** (Web) and define a name.
5. In the app settings, you will find your **Client ID** and **Secret**.
6. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in your `.env`.
7. Update `PAYPAL_ENVIRONMENT` to either `sandbox` or `live`.

## 3. Google Pay Setup
The easiest and recommended way to support Google Pay is by utilizing Stripe Elements (Stripe handles the complex Google Pay configuration and tokens). However, if you are integrating the native Google Pay API directly:
**How to obtain keys:**
1. Log into the [Google Pay and Wallet Console](https://pay.google.com/business/console/).
2. Register as a business and set up a payment profile.
3. Navigate to the **Google Pay API** section to find your **Merchant ID**.
4. Add this ID to `.env` as `GPLAY_MERCHANT_ID`.
5. Associate your account with your chosen Payment Gateway (e.g. Stripe, Braintree) so Google Pay can route its tokens appropriately.

## Developer Next Steps
- **Update `.env`**: Make sure your `.env` contains the required blocks added for Stripe, PayPal, and Google Pay.
- **Frontend** (`artifacts/forum/src/components/CheckoutModal.tsx`):
  - **Stripe**: Install `@stripe/stripe-js` and `@stripe/react-stripe-js` to render the real credit card and Google Pay widgets.
  - **PayPal**: Install `@paypal/react-paypal-js` to render official PayPal buttons.
  - Replace `handleSimulatePayment` logic with the necessary provider code.
- **Backend** (`artifacts/api-server/src/routes/upgrades.ts`):
  - Initialize the `stripe` Node.js client.
  - Fix `/purchase` to return a real `clientSecret` from `stripe.paymentIntents.create(...)`.
  - Listen for webhook events (like `payment_intent.succeeded`) to confidently assign product access to users.
