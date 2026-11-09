/**
 * Shared state for the single Express Checkout surface on a page.
 * Wallet SDK resources live in wallet descriptors; this object owns cart,
 * confirmation, and UI state. Remount cleanup deliberately preserves cart data.
 */
export const state = {
  // Stripe.js loading is shared with the regular payment form across remounts.
  /** @type {Promise<void>|null} */
  stripeLoadingPromise: null,
  /** @type {Object|null} Stripe client for the mounted wallets. */
  stripe: null,
  /** @type {Object|null} Elements instance selected for the current attempt. */
  elements: null,
  /** @type {Object|null} Public initialization response from App Builder. */
  initParams: null,
  /** @type {Object|null} Action URLs supplied by the Commerce payment method. */
  runtimeConfig: null,
  /** @type {Object|null} Commerce tax-display settings used for wallet line items. */
  summaryDisplaySettings: null,

  // Cart models are refreshed independently by their respective Drop-ins.
  /** @type {Object|null} Checkout Drop-in cart model. */
  checkoutData: null,
  /** @type {Object|null} Cart Drop-in model with authoritative totals. */
  cartData: null,
  /** @type {number|null} Amount currently displayed in Stripe minor units. */
  currentAmount: null,
  /** @type {string|null} Lowercase ISO currency code. */
  currentCurrency: null,
  /** @type {Object[]} Rates displayed in the wallet shipping sheet. */
  currentShippingRates: [],
  /** @type {Map<string, Object>} Stripe rate IDs mapped to Commerce methods. */
  shippingMethodsByRateId: new Map(),
  /** @type {Object|null} Most recently selected wallet shipping method. */
  pendingShippingMethod: null,

  // UI resources are owned by the checkout slot.
  /** @type {Element|null} */
  blockContainer: null,
  /** @type {Element|null} */
  statusContainer: null,
  /** @type {Object|null} Rendered Drop-in alert with a remove method. */
  statusAlert: null,

  // Mounting and confirmation gates retain their original reset semantics.
  /** @type {boolean} */
  mountInProgress: false,
  /** @type {boolean} */
  modalOpen: false,
  /** @type {boolean} */
  confirmationInProgress: false,
  /** @type {Promise<boolean>|null} Shared promise for overlapping confirm events. */
  activeConfirmation: null,
  /** @type {string|null} Serialized fields that require a wallet remount. */
  mountedConfigurationKey: null,
  /** @type {string|null} Cart ID recorded after successful order placement. */
  confirmedCartId: null,
  /** @type {boolean} Shipping policy of the active wallet. */
  walletShippingRequired: false,
  /** @type {boolean} Whether wallet shipping was persisted during this mount. */
  walletShippingAddressPersisted: false,
  /** @type {boolean} Whether the shopper must authorize a changed total again. */
  walletReauthorizationRequired: false,
  /** @type {(function(): Promise<boolean>)|null} Checkout terms validator. */
  validateCheckout: null,
  /** @type {(function(): Promise<boolean>)|null} Magento shipping/billing form validator. */
  validateShipping: null,
  /** @type {(function(): boolean)|null} Side-effect free checkout readiness probe. */
  isCheckoutReady: null,
  /** @type {Element|null} Overlay that absorbs wallet clicks while gated. */
  gateOverlay: null,
};
