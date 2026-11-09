/** Stripe and App Builder protocol values. */
export const STRIPE_PAYMENT_METHOD_CODE = 'oope_stripe';

export const STRIPE_PAYMENT_METHOD_TITLE = 'Stripe Payment Method';

export const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

export const STRIPE_REQUEST_TIMEOUT = 15000;

export const STRIPE_LOADING_PROMISE_KEY = '__stripeJsLoadingPromise';

export const STRIPE = Object.freeze({
  INVALID_PAYMENT_DATA: 'invalid_payment_data',
  FAIL: 'fail',
  ELEMENT_TYPE: 'expressCheckout',
  REDIRECT_IF_REQUIRED: 'if_required',
});

export const SUPPORTED_PAYMENT_STATUSES = new Set([
  'processing',
  'requires_capture',
  'succeeded',
]);

/** Commerce storage and authentication. */
export const STORE_VIEW_KEY = 'store-view';

export const DEFAULT_STORE_VIEW = 'default';

export const CART_ID_KEY = 'DROPINS_CART_ID';

export const CUSTOMER_TOKEN_COOKIE_PATTERN = /(?:^|;\s*)auth_dropin_user_token=([^;]+)/;

/** DOM hooks shared with the block stylesheet and checkout host. */
export const STYLESHEET_URL = '/blocks/express-checkout/stripe-express-checkout.css';

export const ELEMENT_CONTAINER_ID = 'stripe-express-checkout-element';

export const BLOCK_CLASS = 'stripe-express-checkout';

export const BLOCKED_CLASS = 'stripe-express-checkout-blocked';

export const HIDDEN_CLASS = 'stripe-express-checkout-hidden';

export const LOADING_CLASS = 'stripe-express-checkout-loading';

export const HEADING_CLASS = 'stripe-express-checkout-heading';

export const STATUS_CLASS = 'stripe-express-checkout-status';

export const SEPARATOR_CLASS = 'stripe-express-checkout-separator';

export const WALLETS_CLASS = 'stripe-express-checkout-wallets';

export const GATE_CLASS = 'stripe-express-checkout-gate';

export const CHECKOUT_SELECTOR = '.commerce-checkout';

/** Currency conversion rules. All amounts sent to Stripe use minor units. */
export const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

export const STRIPE_THREE_DECIMAL_CURRENCIES = new Set([
  'BHD',
  'JOD',
  'KWD',
  'OMR',
  'TND',
]);

/** Commerce event bus and Stripe Element event names. */
export const EVENTS = Object.freeze({
  CHECKOUT_INITIALIZED: 'checkout/initialized',
  CHECKOUT_UPDATED: 'checkout/updated',
  CHECKOUT_VALUES: 'checkout/values',
  CART_INITIALIZED: 'cart/initialized',
  CART_UPDATED: 'cart/updated',
  CART_DATA: 'cart/data',
  CART_RESET: 'cart/reset',
  CLICK: 'click',
  CONFIRM: 'confirm',
  SHIPPING_ADDRESS_CHANGE: 'shippingaddresschange',
  SHIPPING_RATE_CHANGE: 'shippingratechange',
  CANCEL: 'cancel',
  ESCAPE: 'escape',
  LOAD_ERROR: 'loaderror',
  READY: 'ready',
  METHODS_CHANGE: 'availablepaymentmethodschange',
});

/** Customer-facing copy and alert presentation. */
export const STATUS = Object.freeze({ INFO: 'info', SUCCESS: 'success', ERROR: 'error' });

/** Order-summary labels and Commerce tax-display values. */
export const ORDER_SUMMARY = Object.freeze({
  SUBTOTAL: 'Subtotal',
  SHIPPING: 'Shipping & Handling',
  TAX: 'Tax',
  DISCOUNT: 'Discount',
  GRAND_TOTAL: 'Grand Total',
});

export const TAX_DISPLAY = Object.freeze({
  EXCLUDING: 'EXCLUDING_TAX',
  INCLUDING: 'INCLUDING_TAX',
  BOTH: 'INCLUDING_EXCLUDING_TAX',
  BOTH_CHECKOUT: 'INCLUDING_AND_EXCLUDING_TAX',
});

export const PAYMENT_STATUS = Object.freeze({
  info: {
    heading: 'Payment processing',
    icon: 'InfoFilled',
  },
  success: {
    heading: 'Payment successful',
    icon: 'CheckWithCircle',
    type: 'success',
  },
  error: {
    heading: 'Payment failed',
    icon: 'PaymentError',
    type: 'error',
  },
});

export const MESSAGES = Object.freeze({
  WALLET_ADDRESS_INCOMPLETE: 'The wallet address is incomplete.',
  AMOUNT_UNAVAILABLE: 'A Stripe amount is unavailable.',
  CART_AMOUNT_UNAVAILABLE: 'The authoritative cart amount is unavailable.',
  CURRENCY_CHANGED: 'The cart currency changed during Express Checkout.',
  REQUEST_TIMEOUT: 'Stripe did not respond in time. Please try again.',
  SDK_TIMEOUT: 'Stripe.js did not load in time.',
  SDK_LOAD_FAILED: 'Stripe.js failed to load.',
  CONFIG_UNAVAILABLE: 'Stripe runtime configuration is unavailable.',
  CONFIG_INCOMPLETE: 'Stripe runtime configuration is incomplete.',
  INIT_UNAVAILABLE: 'Stripe initialization parameters are unavailable.',
  INTENT_FAILED: 'PaymentIntent failed.',
  METHOD_NOT_PERSISTED: 'Adobe Commerce did not select Stripe as the payment method.',
  TOTAL_CHANGED:
    'The order total changed. Please reopen your wallet and approve the updated total.',
  PROCESSING: 'We are processing your wallet details and payment.',
  CART_UNAVAILABLE: 'The active cart is unavailable.',
  TERMS_REQUIRED:
    'Please accept the terms and conditions, then try Express Checkout again.',
  CHECKOUT_FIELDS_REQUIRED:
    'Please fix the highlighted required fields, then try Express Checkout again.',
  SHIPPING_REQUIRED:
    'Please fill in your shipping address and select a shipping method, then try Express Checkout again.',
  SUBMIT_FAILED: 'The wallet could not submit this payment.',
  TOKEN_FAILED: 'The wallet payment details could not be confirmed.',
  ADDRESS_INCOMPLETE:
    'The wallet did not provide a complete billing or shipping address.',
  CONFIRM_FAILED: 'Stripe could not confirm the payment.',
  PAYMENT_INCOMPLETE:
    'The payment was not completed. Please try again or use the card form below.',
  CREATING_ORDER: 'Payment confirmed. We are creating your order.',
  ORDER_FAILED: 'Adobe Commerce did not create the order.',
  ORDER_PLACED: 'Your payment was successful and your order has been placed.',
  PAYMENT_FAILED: 'Express Checkout could not complete the payment.',
  UNAVAILABLE: 'Express Checkout is unavailable. Please use the card payment form below.',
  HEADING: 'Express checkout',
  SEPARATOR: 'Or pay another way',
  GATE_LABEL: 'Complete the required checkout fields to use Express Checkout',
});

/** Developer diagnostics; never include payment credentials in these messages. */
export const DIAGNOSTICS = Object.freeze({
  SUMMARY_SETTINGS_FAILED: 'Unable to load Express Checkout tax-display settings.',
  SHIPPING_SELECTION_FAILED: 'Unable to persist the selected Magento shipping method.',
  SHIPPING_ESTIMATE_FAILED: 'Unable to estimate wallet shipping methods.',
  SHIPPING_METHOD_FAILED: 'Unable to persist the wallet shipping method.',
  STATUS_RENDER_FAILED: 'Unable to render Express Checkout payment status.',
  ELEMENT_DESTROY_FAILED: 'Unable to destroy Stripe Express Checkout Element.',
  CONFIRMATION_FAILED: 'Stripe Express Checkout confirmation failed.',
  ELEMENT_LOAD_FAILED: 'Stripe Express Checkout Element failed to load.',
  ELEMENT_INIT_FAILED: 'Unable to initialize Stripe Express Checkout Element.',
});
