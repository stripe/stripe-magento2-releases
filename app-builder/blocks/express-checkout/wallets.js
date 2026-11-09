import { ELEMENT_CONTAINER_ID } from './constants.js';
import { createAmazonPayWallet } from './amazon-pay.js';

/**
 * A wallet's configuration and mounted resources. Policy callbacks are pure;
 * mounted resources are updated by the shared checkout lifecycle.
 * @typedef {Object} WalletDescriptor
 * @property {string} containerId Stable DOM mount ID.
 * @property {string} containerClassName Additional wallet-specific styling class.
 * @property {boolean} collectsShipping Whether Stripe requests shipping in the sheet.
 * @property {function(boolean): boolean} isEnabled Check eligibility for a virtual cart.
 * @property {function(Object, Object[]): Object} getOptions Build Stripe create options.
 * @property {Element|null} container Host DOM node.
 * @property {Object|null} element Mounted Express Checkout Element.
 * @property {Object|null} elements Owning Stripe Elements instance.
 * @property {boolean} available Most recently reported wallet availability.
 */

const PAYMENT_METHODS = ['link', 'amazonPay', 'applePay', 'googlePay', 'paypal', 'klarna'];

/**
 * Give each payment-only wallet its own grid item while keeping Magento shipping.
 * @param {string} method Stripe payment method name.
 * @param {string} name CSS suffix for the wallet.
 * @returns {WalletDescriptor} Unmounted wallet.
 */
function createPaymentWallet(method, name) {
  return {
    containerId: method === 'link' ? ELEMENT_CONTAINER_ID : `stripe-express-checkout-${name}`,
    containerClassName: `stripe-express-checkout-${name}`,
    collectsShipping: false,
    isEnabled: () => true,
    getOptions: (fields) => ({
      ...fields,
      shippingAddressRequired: false,
      paymentMethods: Object.fromEntries(PAYMENT_METHODS.map((key) => [
        key, key === method ? 'auto' : 'never',
      ])),
    }),
    container: null,
    element: null,
    elements: null,
    available: false,
  };
}

/** @type {WalletDescriptor} Link retains the primary mount and lifecycle reference. */
export const primaryWallet = createPaymentWallet('link', 'link');

/** @type {WalletDescriptor[]} DOM order matches the visual and keyboard order. */
export const wallets = [
  primaryWallet,
  createAmazonPayWallet(),
  createPaymentWallet('applePay', 'apple-pay'),
  createPaymentWallet('googlePay', 'google-pay'),
  createPaymentWallet('paypal', 'paypal'),
  createPaymentWallet('klarna', 'klarna'),
];
