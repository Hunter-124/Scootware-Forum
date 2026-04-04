/**
 * Payment Notifications System
 * ============================================================
 * Real-time event emitter for payment confirmations.
 * Allows subscribers (like SSE connections) to be notified
 * immediately when a crypto payment is confirmed.
 */

import { EventEmitter } from "events";

export interface PaymentConfirmedEvent {
  requestId: number;
  userId: number;
  productIds: string[];
  coin: string;
  txHash: string;
  confirmedBlock: number | null;
  timestamp: Date;
}

class PaymentNotificationEmitter extends EventEmitter {
  constructor() {
    super();
    // Prevent memory leak warnings for applications with many listeners
    this.setMaxListeners(100);
  }

  /**
   * Emit a payment confirmation event
   */
  emitPaymentConfirmed(event: PaymentConfirmedEvent): void {
    this.emit("payment-confirmed", event);
    // Also emit user-specific events for targeted notifications
    this.emit(`payment-confirmed:user:${event.userId}`, event);
    this.emit(`payment-confirmed:request:${event.requestId}`, event);
  }

  /**
   * Subscribe to all payment confirmations
   */
  onPaymentConfirmed(callback: (event: PaymentConfirmedEvent) => void): void {
    this.on("payment-confirmed", callback);
  }

  /**
   * Subscribe to payment confirmations for a specific user
   */
  onPaymentConfirmedForUser(userId: number, callback: (event: PaymentConfirmedEvent) => void): void {
    this.on(`payment-confirmed:user:${userId}`, callback);
  }

  /**
   * Subscribe to a specific payment request confirmation
   */
  onPaymentConfirmedForRequest(requestId: number, callback: (event: PaymentConfirmedEvent) => void): void {
    this.on(`payment-confirmed:request:${requestId}`, callback);
  }

  /**
   * Unsubscribe from all payment confirmations
   */
  offPaymentConfirmed(callback: (event: PaymentConfirmedEvent) => void): void {
    this.off("payment-confirmed", callback);
  }

  /**
   * Unsubscribe from user-specific payments
   */
  offPaymentConfirmedForUser(userId: number, callback: (event: PaymentConfirmedEvent) => void): void {
    this.off(`payment-confirmed:user:${userId}`, callback);
  }

  /**
   * Unsubscribe from a specific request
   */
  offPaymentConfirmedForRequest(requestId: number, callback: (event: PaymentConfirmedEvent) => void): void {
    this.off(`payment-confirmed:request:${requestId}`, callback);
  }
}

// Singleton instance
export const paymentNotifications = new PaymentNotificationEmitter();
