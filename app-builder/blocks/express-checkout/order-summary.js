import * as cartApi from '@dropins/storefront-cart/api.js';
import { state } from './checkout-state.js';
import { getSelectedShippingMethod, isVirtualCart } from './addresses.js';
import { toStripeMinorUnits } from './money.js';
import { DIAGNOSTICS, ORDER_SUMMARY, TAX_DISPLAY } from './constants.js';

/**
 * Read a nonnegative money value without accepting missing or mixed-currency data.
 * @param {Object} money Commerce money object.
 * @param {string} currency Expected ISO currency code.
 * @returns {number|null} Integer minor units, or null for unavailable data.
 */
function readAmount(money, currency) {
  if (money?.value == null || money.value === ''
    || String(money.currency).toLowerCase() !== currency.toLowerCase()) return null;
  const value = Number(money.value);
  if (!Number.isFinite(value) || value < 0) return null;
  const amount = toStripeMinorUnits(value, currency);
  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Sum monetary fields, rejecting partial data rather than treating it as zero.
 * @param {Object[]} values Commerce money objects.
 * @param {string} currency Expected currency.
 * @returns {number|null} Sum in minor units.
 */
function sumAmounts(values, currency) {
  const amounts = values.map((value) => readAmount(value, currency));
  return amounts.includes(null) ? null : amounts.reduce((sum, value) => sum + value, 0);
}

/**
 * Read a cart aggregate or its component modifiers without counting both.
 * @param {Object} cart Cart Drop-in model.
 * @param {string} aggregate Aggregate property name.
 * @param {string} components Modifier array property name.
 * @param {string} currency Expected currency.
 * @returns {number|null} Aggregate in minor units.
 */
function readAggregate(cart, aggregate, components, currency) {
  if (cart[aggregate] != null) return readAmount(cart[aggregate], currency);
  return Array.isArray(cart[components])
    ? sumAmounts(cart[components].map((entry) => entry?.amount), currency) : null;
}

/**
 * Interpret Commerce's display mode. For dual display, use the inclusive value
 * because an ECE row can contain only one amount.
 * @param {string|number} setting Commerce display setting.
 * @returns {boolean|null} Whether tax is included; null for an unknown setting.
 */
function includesTax(setting) {
  if ([TAX_DISPLAY.INCLUDING, TAX_DISPLAY.BOTH, TAX_DISPLAY.BOTH_CHECKOUT,
    2, 3, '2', '3'].includes(setting)) return true;
  if ([TAX_DISPLAY.EXCLUDING, 1, '1'].includes(setting)) return false;
  return null;
}

/**
 * Read subtotal amounts, using row totals only when the aggregate is absent.
 * Row totals already account for quantity; unit prices must not be summed here.
 * @param {Object} cart Cart Drop-in model.
 * @param {boolean} inclusive Whether to include item tax.
 * @param {string} currency Expected currency.
 * @returns {number|null} Subtotal in minor units.
 */
function readSubtotal(cart, inclusive, currency) {
  const key = inclusive ? 'includingTax' : 'excludingTax';
  if (cart.subtotal?.[key] != null) return readAmount(cart.subtotal[key], currency);
  if (!Array.isArray(cart.items) || !cart.items.length) return null;
  return sumAmounts(cart.items.map((item) => (
    inclusive ? item?.rowTotalIncludingTax : item?.rowTotal
  )), currency);
}

/**
 * Build a summary only when its rows exactly equal Magento's total, including
 * a negative Discount row when a coupon is applied. Missing data or rounding
 * differences collapse to one Grand Total row. No taxes are calculated from
 * rates here.
 * @param {Object} cart Cart Drop-in model.
 * @param {Object|null} method Selected Commerce shipping method.
 * @param {Object|null} settings Commerce tax-display settings.
 * @param {boolean} virtualCart Whether shipping is unnecessary.
 * @returns {Array<{name: string, amount: number}>} Stripe line items.
 */
function buildOrderSummary(cart, method, settings, virtualCart = false) {
  const currency = String(cart?.total?.includingTax?.currency || '').toLowerCase();
  const grandTotal = readAmount(cart?.total?.includingTax, currency);
  if (grandTotal === null) return [];
  const fallback = [{ name: ORDER_SUMMARY.GRAND_TOTAL, amount: grandTotal }];
  const inclusiveItems = includesTax(settings?.subtotal ?? settings?.price);
  const inclusiveShipping = virtualCart ? false : includesTax(settings?.shipping);
  if (inclusiveItems === null || inclusiveShipping === null) return fallback;

  const subtotal = readSubtotal(cart, inclusiveItems, currency);
  const subtotalExcl = readSubtotal(cart, false, currency);
  const tax = readAggregate(cart, 'totalTax', 'appliedTaxes', currency);
  const discount = cart.discount?.value ? readAmount(cart.discount, currency) : 0;
  if (
    subtotal === null || tax === null || discount === null
    || (inclusiveItems && subtotalExcl === null)
  ) {
    return fallback;
  }
  let embeddedTax = inclusiveItems ? subtotal - subtotalExcl : 0;
  if (embeddedTax < 0) return fallback;
  const rows = [{ name: ORDER_SUMMARY.SUBTOTAL, amount: subtotal }];
  if (!virtualCart) {
    if (!method) return fallback;
    const shipping = readAmount(
      (inclusiveShipping ? method.amountInclTax : method.amountExclTax)
        ?? method.amount ?? cart.shipping,
      currency,
    );
    const shippingExcl = readAmount(method.amountExclTax, currency);
    if (shipping === null || (inclusiveShipping && shippingExcl === null)) return fallback;
    const shippingTax = inclusiveShipping ? shipping - shippingExcl : 0;
    if (shippingTax < 0) return fallback;
    embeddedTax += shippingTax;
    const methodName = [method.carrier?.title, method.title].filter(Boolean).join(' - ');
    rows.push({
      name: methodName ? `${ORDER_SUMMARY.SHIPPING} (${methodName})` : ORDER_SUMMARY.SHIPPING,
      amount: shipping,
    });
  }
  const remainingTax = tax - embeddedTax;
  if (remainingTax < 0) return fallback;
  if (remainingTax > 0 || settings?.zeroTax) {
    rows.push({ name: ORDER_SUMMARY.TAX, amount: remainingTax });
  }
  if (discount > 0) {
    rows.push({ name: ORDER_SUMMARY.DISCOUNT, amount: -discount });
  }
  return rows.reduce((sum, row) => sum + row.amount, 0) === grandTotal ? rows : fallback;
}

/**
 * Load settings before mounting, keeping network requests out of wallet clicks.
 * A settings failure leaves the Grand Total fallback available.
 * @returns {Promise<void>}
 */
async function loadOrderSummarySettings() {
  try {
    const config = await cartApi.getStoreConfig();
    state.summaryDisplaySettings = config?.shoppingCartDisplaySetting || null;
  } catch (error) {
    state.summaryDisplaySettings = null;
    console.warn(DIAGNOSTICS.SUMMARY_SETTINGS_FAILED, error);
  }
}

/**
 * Get the current Magento breakdown or its authoritative Grand Total fallback.
 * Wallet shipping estimates must never supply the fallback amount.
 * @returns {Array<{name: string, amount: number}>} Rows matching Magento's total.
 */
function getWalletLineItems() {
  return buildOrderSummary(
    state.cartData,
    getSelectedShippingMethod(),
    state.summaryDisplaySettings,
    isVirtualCart(),
  );
}

export {
  buildOrderSummary,
  getWalletLineItems,
  loadOrderSummarySettings,
  readAmount,
};
