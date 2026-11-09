import { STRIPE_ZERO_DECIMAL_CURRENCIES, STRIPE_THREE_DECIMAL_CURRENCIES, MESSAGES } from './constants.js';

/**
 * Resolve the Stripe minor-unit precision for a currency.
 * @param {string} currency ISO currency code.
 * @returns {number}
 */
function getStripeFractionDigits(currency) {
  const normalizedCurrency = String(currency || '').toUpperCase();
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) return 0;
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(normalizedCurrency)) return 3;
  return 2;
}

/**
 * Convert a monetary value to the integer amount expected by Stripe.
 * @param {number|string} value Monetary value in major currency units.
 * @param {string} currency ISO currency code.
 * @returns {number}
 */
function toStripeMinorUnits(value, currency) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(MESSAGES.AMOUNT_UNAVAILABLE);
  }
  return Math.round(numericValue * 10 ** getStripeFractionDigits(currency));
}

export { toStripeMinorUnits };
