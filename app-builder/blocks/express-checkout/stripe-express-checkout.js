/* global Stripe */

import * as orderApi from '@dropins/storefront-order/api.js';
import { events } from '@dropins/tools/event-bus.js';
import {
  STATUS,
  STYLESHEET_URL,
  DIAGNOSTICS,
  STRIPE,
  MESSAGES,
  SUPPORTED_PAYMENT_STATUSES,
  EVENTS,
  HIDDEN_CLASS,
  LOADING_CLASS,
  BLOCK_CLASS,
  HEADING_CLASS,
  STATUS_CLASS,
  SEPARATOR_CLASS,
  WALLETS_CLASS,
  GATE_CLASS,
} from './constants.js';
import { loadCSS } from '../../scripts/aem.js';
import { reuseCustomerAddresses } from './checkout-addresses.js';
import { state } from './checkout-state.js';
import {
  isCompleteBillingAddress,
  getCheckoutPhone,
  isVirtualCart,
  hasRequiredMagentoShipping,
  toStripeBillingDetails,
  toStripeShippingDetails,
  toStripeShippingDetailsFromCommerce,
  getCheckoutShippingAddress,
  cartNeedsWalletAddresses,
  toWalletAddress,
} from './addresses.js';
import {
  syncMagentoShippingRates,
  getCartMoney,
  updateMountedElementsAmount,
  ensureSelectedShippingOnCart,
  getWalletElementsAmount,
  synchronizeWalletDetails,
  handleShippingAddressChange,
  handleShippingRateChange,
} from './shipping.js';
import {
  getActiveCartId,
  createPaymentIntent,
  persistStripePaymentMethod,
  isStripePaymentMethodAvailable,
  loadStripeJs,
  parseRuntimeConfig,
  fetchInitParams,
} from './stripe-api.js';
import { wallets, primaryWallet } from './wallets.js';
import {
  getWalletLineItems,
  loadOrderSummarySettings,
} from './order-summary.js';
import {
  setCheckoutBlocked,
  setPaymentStatus,
  clearPaymentStatus,
  syncWalletVisibility,
  hideExpressCheckout,
} from './checkout-view.js';

loadCSS(STYLESHEET_URL);

// Wallet configuration

/**
 * Build deferred Elements options from cart totals and backend payment settings.
 * @returns {Object}
 */
function getElementsOptions() {
  const money = getCartMoney();
  const { captureMethod, paymentMethodOptions } = state.initParams?.elementsOptions || {};
  return {
    mode: 'payment',
    amount: money.amount,
    currency: money.currency,
    ...(captureMethod ? { captureMethod } : {}),
    ...(paymentMethodOptions
      ? {
        paymentMethodOptions,
      }
      : {}),
  };
}

/**
 * Validate Magento-owned checkout fields before opening or confirming a wallet.
 * Terms and the shipping/billing forms apply to every wallet, Amazon included.
 * @returns {Promise<string|null>} Customer-facing error, or null when valid.
 */
async function getCheckoutValidationError() {
  if (state.validateShipping && !(await state.validateShipping())) {
    return MESSAGES.CHECKOUT_FIELDS_REQUIRED;
  }
  if (state.validateCheckout && !(await state.validateCheckout())) {
    return MESSAGES.TERMS_REQUIRED;
  }
  return null;
}

/**
 * Report whether the wallets must stay shut, without touching the form.
 * This runs on every cart and checkout update, so it only reads state; the
 * visible field errors belong to a real click.
 * @returns {boolean}
 */
function isExpressCheckoutGated() {
  if (!hasRequiredMagentoShipping()) {
    return true;
  }
  return state.isCheckoutReady ? !state.isCheckoutReady() : false;
}

/**
 * Cover the wallets so a click cannot reach the button inside Stripe's iframe.
 * Stripe opens Amazon Pay from the raw click gesture, before the `click` event
 * we handle, so `reject()` cannot keep that window shut. Blocking the click
 * itself is the only way to validate before any wallet appears.
 * @returns {void}
 */
function syncWalletGate() {
  const gated = isExpressCheckoutGated();
  if (state.gateOverlay) {
    state.gateOverlay.hidden = !gated;
  }
  wallets.forEach((wallet) => {
    if (wallet.container) {
      wallet.container.inert = gated;
    }
  });
}

/**
 * Explain an intercepted click with the same errors a real click would raise.
 * @returns {Promise<void>}
 */
async function handleGatedWalletClick() {
  const validationError = await getCheckoutValidationError();
  if (!validationError) {
    syncWalletGate();
    return;
  }
  await setPaymentStatus(validationError, STATUS.ERROR);
}

/**
 * Supply rates only for a wallet configured to collect shipping.
 * @param {boolean} collectShipping Whether this wallet collects shipping.
 * @returns {Object}
 */
function getClickResolvePayload(collectShipping) {
  return {
    lineItems: getWalletLineItems(),
    ...(collectShipping ? { shippingRates: state.currentShippingRates } : {}),
  };
}

/**
 * Request only contact and billing fields absent from checkout state.
 * @returns {Object}
 */
function getSharedExpressCheckoutFields() {
  return {
    billingAddressRequired: !isCompleteBillingAddress(),
    emailRequired: !state.checkoutData?.email,
    phoneNumberRequired: !getCheckoutPhone(),
  };
}

/**
 * Identify changes that require remounting the wallet elements.
 * @returns {string}
 */
function getConfigurationKey() {
  syncMagentoShippingRates();
  const options = getSharedExpressCheckoutFields();
  return JSON.stringify({
    cartId: getActiveCartId(),
    billingAddressRequired: options.billingAddressRequired,
    emailRequired: options.emailRequired,
    phoneNumberRequired: options.phoneNumberRequired,
    shippingWallet: wallets.some(
      (wallet) => wallet.collectsShipping && wallet.isEnabled(isVirtualCart()),
    ),
  });
}

/**
 * Destroy an Stripe element without interrupting checkout cleanup.
 * @param {Object} walletElement Mounted Stripe Express Checkout Element.
 * @returns {void}
 */
function destroyWalletElement(walletElement) {
  if (!walletElement) {
    return;
  }
  try {
    walletElement.destroy();
  } catch (error) {
    console.warn(DIAGNOSTICS.ELEMENT_DESTROY_FAILED, error);
  }
}

/**
 * Dispose of mounted wallets and reset the per-mount payment state.
 * @returns {void}
 */
function destroyExpressCheckout() {
  wallets.forEach((wallet) => {
    destroyWalletElement(wallet.element);
    wallet.element = null;
    wallet.elements = null;
    wallet.available = false;
  });
  state.elements = null;
  state.stripe = null;
  state.initParams = null;
  state.runtimeConfig = null;
  state.mountedConfigurationKey = null;
  state.currentAmount = null;
  state.currentCurrency = null;
  state.currentShippingRates = [];
  state.shippingMethodsByRateId = new Map();
  state.pendingShippingMethod = null;
  state.walletShippingRequired = false;
  state.walletShippingAddressPersisted = false;
  state.walletReauthorizationRequired = false;
  state.modalOpen = false;
  state.confirmationInProgress = false;
  state.activeConfirmation = null;
  setCheckoutBlocked(false);
}

// Payment confirmation

/**
 * Report a failure to Stripe when the wallet event supports it.
 * @param {Object} event Stripe Express Checkout event.
 * @param {string} [reason] Stripe payment failure reason.
 * @returns {void}
 */
function notifyPaymentFailure(event, reason = STRIPE.FAIL) {
  if (typeof event?.paymentFailed === 'function') {
    event.paymentFailed({
      reason,
    });
  }
}

/**
 * Require another authorization if refreshed totals differ from the wallet amount.
 * @param {Object} event Stripe Express Checkout event.
 * @returns {Promise<boolean>}
 */
async function syncAmountAfterWalletUpdate(event) {
  const money = getCartMoney();
  if (money.currency !== state.currentCurrency || money.amount !== state.currentAmount) {
    if (money.currency === state.currentCurrency) {
      await updateMountedElementsAmount(money.amount);
    }
    state.walletReauthorizationRequired = true;
    await setPaymentStatus(MESSAGES.TOTAL_CHANGED, STATUS.ERROR);
    notifyPaymentFailure(event);
    return false;
  }
  return true;
}

/**
 * Execute the validation, token, payment, and Commerce order sequence.
 * @param {Object} event Stripe Express Checkout event.
 * @returns {Promise<boolean>}
 */
async function runConfirmation(event) {
  state.confirmationInProgress = true;
  state.modalOpen = true;
  setCheckoutBlocked(true);
  try {
    await setPaymentStatus(MESSAGES.PROCESSING);
    const cartId = getActiveCartId();
    if (!cartId) {
      throw new Error(MESSAGES.CART_UNAVAILABLE);
    }
    const validationError = await getCheckoutValidationError();
    if (validationError) {
      await setPaymentStatus(validationError, STATUS.ERROR);
      notifyPaymentFailure(event);
      return false;
    }
    if (!hasRequiredMagentoShipping()) {
      await setPaymentStatus(MESSAGES.SHIPPING_REQUIRED, STATUS.ERROR);
      notifyPaymentFailure(event);
      return false;
    }
    if (!state.walletShippingRequired) {
      await ensureSelectedShippingOnCart();
      const money = getWalletElementsAmount();
      if (
        money.currency === state.currentCurrency
        && money.amount !== state.currentAmount
      ) {
        await updateMountedElementsAmount(money.amount);
        state.walletReauthorizationRequired = true;
      }
    }
    if (state.walletReauthorizationRequired) {
      await setPaymentStatus(MESSAGES.TOTAL_CHANGED, STATUS.ERROR);
      notifyPaymentFailure(event);
      return false;
    }
    await reuseCustomerAddresses(state.checkoutData);
    await synchronizeWalletDetails(event);
    if (!(await syncAmountAfterWalletUpdate(event))) {
      return false;
    }
    const submitResult = await state.elements.submit();
    if (submitResult?.error) {
      await setPaymentStatus(
        submitResult.error.message || MESSAGES.SUBMIT_FAILED,
        STATUS.ERROR,
      );
      notifyPaymentFailure(event, STRIPE.INVALID_PAYMENT_DATA);
      return false;
    }
    const billingDetails = toStripeBillingDetails(event.billingDetails);
    const shippingDetails = (state.walletShippingRequired
      ? toStripeShippingDetails(event.shippingAddress, event.billingDetails?.phone)
      : null)
      || toStripeShippingDetailsFromCommerce(
        getCheckoutShippingAddress(),
        event.billingDetails?.phone || getCheckoutPhone(),
      );
    const confirmationTokenResult = await state.stripe.createConfirmationToken({
      elements: state.elements,
      params: {
        ...(billingDetails
          ? {
            payment_method_data: {
              billing_details: billingDetails,
            },
          }
          : {}),
        ...(shippingDetails
          ? {
            shipping: shippingDetails,
          }
          : {}),
      },
    });
    if (confirmationTokenResult.error || !confirmationTokenResult.confirmationToken?.id) {
      await setPaymentStatus(
        confirmationTokenResult.error?.message || MESSAGES.TOKEN_FAILED,
        STATUS.ERROR,
      );
      notifyPaymentFailure(event, STRIPE.INVALID_PAYMENT_DATA);
      return false;
    }
    const { confirmationToken } = confirmationTokenResult;
    const confirmationTokenId = confirmationToken.id;
    if (cartNeedsWalletAddresses()) {
      await synchronizeWalletDetails(event, {
        shipping: toWalletAddress(confirmationToken.shipping),
        billing: toWalletAddress(
          confirmationToken.payment_method_preview?.billing_details,
        ),
      });
      if (!(await syncAmountAfterWalletUpdate(event))) {
        return false;
      }
    }
    if (cartNeedsWalletAddresses()) {
      await setPaymentStatus(MESSAGES.ADDRESS_INCOMPLETE, STATUS.ERROR);
      notifyPaymentFailure(event);
      return false;
    }
    const paymentIntentData = await createPaymentIntent(confirmationTokenId);
    await persistStripePaymentMethod(paymentIntentData.client_secret);
    const confirmParams = {
      confirmation_token: confirmationTokenId,
    };
    if (paymentIntentData.return_url) {
      confirmParams.return_url = paymentIntentData.return_url;
    }
    const confirmationResult = await state.stripe.confirmPayment({
      clientSecret: paymentIntentData.client_secret,
      confirmParams,
      redirect: STRIPE.REDIRECT_IF_REQUIRED,
    });
    if (confirmationResult.error) {
      await setPaymentStatus(
        confirmationResult.error.message || MESSAGES.CONFIRM_FAILED,
        STATUS.ERROR,
      );
      notifyPaymentFailure(event);
      return false;
    }
    if (
      confirmationResult.paymentIntent?.status
      && !SUPPORTED_PAYMENT_STATUSES.has(confirmationResult.paymentIntent.status)
    ) {
      await setPaymentStatus(MESSAGES.PAYMENT_INCOMPLETE, STATUS.ERROR);
      notifyPaymentFailure(event);
      return false;
    }

    // Payment Methods can auto-sync its previously selected fallback method.
    // Reassert and verify Stripe immediately before Commerce creates the order.
    await persistStripePaymentMethod(paymentIntentData.client_secret);
    await setPaymentStatus(MESSAGES.CREATING_ORDER);
    const order = await orderApi.placeOrder(cartId);
    if (!order) {
      throw new Error(MESSAGES.ORDER_FAILED);
    }
    state.confirmedCartId = cartId;
    await setPaymentStatus(MESSAGES.ORDER_PLACED, STATUS.SUCCESS);
    return true;
  } catch (error) {
    console.warn(DIAGNOSTICS.CONFIRMATION_FAILED, error);
    await setPaymentStatus(error.message || MESSAGES.PAYMENT_FAILED, STATUS.ERROR);
    notifyPaymentFailure(event);
    return false;
  } finally {
    state.confirmationInProgress = false;
    state.modalOpen = false;
    setCheckoutBlocked(false);
  }
}

/**
 * Share one confirmation promise across overlapping confirm events.
 * @param {Object} event Stripe Express Checkout event.
 * @returns {Promise<boolean>}
 */
function handleConfirm(event) {
  if (!state.activeConfirmation) {
    state.activeConfirmation = runConfirmation(event).finally(() => {
      state.activeConfirmation = null;
    });
  }
  return state.activeConfirmation;
}

// Wallet events and mounting

/**
 * Unblock a dismissed wallet and synchronize outside active confirmation.
 * @returns {void}
 */
function handleModalDismissed() {
  state.modalOpen = false;
  if (!state.confirmationInProgress) {
    setCheckoutBlocked(false);
    synchronizeMountedElement();
  }
}

/**
 * Select the Elements instance and shipping policy for the current attempt.
 * @param {import('./wallets.js').WalletDescriptor} wallet Wallet and collection policy.
 * @returns {void}
 */
function activateWallet(wallet) {
  state.elements = wallet.elements;
  state.walletShippingRequired = wallet.collectsShipping;
}

/**
 * Connect a wallet descriptor to the shared payment and shipping handlers.
 * @param {import('./wallets.js').WalletDescriptor} wallet Wallet and collection policy.
 * @returns {void}
 */
function registerExpressCheckoutHandlers(wallet) {
  const { element: walletElement, collectsShipping: collectShipping } = wallet;
  walletElement.on(EVENTS.CLICK, async (event) => {
    clearPaymentStatus();
    state.modalOpen = true;
    state.walletReauthorizationRequired = false;
    setCheckoutBlocked(true);
    activateWallet(wallet);
    const checkoutError = await getCheckoutValidationError();
    const money = getWalletElementsAmount();
    const validationError = checkoutError
      || (money.currency !== state.currentCurrency ? MESSAGES.CURRENCY_CHANGED : null);
    if (validationError) {
      state.modalOpen = false;
      setCheckoutBlocked(false);
      if (typeof event.reject === 'function') {
        event.reject();
      }
      await setPaymentStatus(validationError, STATUS.ERROR);
      return;
    }
    if (money.amount !== state.currentAmount) {
      updateMountedElementsAmount(money.amount);
    }
    // Stripe discards the sheet if resolve() waits more than ~1s.
    event.resolve(getClickResolvePayload(collectShipping));
    if (!collectShipping) {
      ensureSelectedShippingOnCart();
    }
  });
  walletElement.on(EVENTS.CONFIRM, (event) => {
    activateWallet(wallet);
    return handleConfirm(event);
  });
  walletElement.on(EVENTS.SHIPPING_ADDRESS_CHANGE, handleShippingAddressChange);
  walletElement.on(EVENTS.SHIPPING_RATE_CHANGE, handleShippingRateChange);
  walletElement.on(EVENTS.CANCEL, handleModalDismissed);
  walletElement.on(EVENTS.ESCAPE, handleModalDismissed);
  walletElement.on(EVENTS.LOAD_ERROR, async (event) => {
    console.warn(DIAGNOSTICS.ELEMENT_LOAD_FAILED, event.error);
    wallet.available = false;
    handleModalDismissed();
    syncWalletVisibility();
    if (!wallets.some((item) => item.available)) {
      if (state.blockContainer) {
        state.blockContainer.hidden = false;
      }
      await setPaymentStatus(MESSAGES.UNAVAILABLE, STATUS.ERROR);
    }
  });
  walletElement.on(EVENTS.READY, (event) => {
    wallet.available = Boolean(event.availablePaymentMethods);
    if (wallets.some((item) => item.available)) {
      clearPaymentStatus();
    }
    syncWalletVisibility();
  });
  walletElement.on(EVENTS.METHODS_CHANGE, (event) => {
    wallet.available = Boolean(event.paymentMethods);
    if (wallets.some((item) => item.available)) {
      clearPaymentStatus();
    }
    syncWalletVisibility();
  });
}

/**
 * Initialize Stripe and mount eligible wallets in their descriptor order.
 * @returns {Promise<void>}
 */
async function mountExpressCheckout() {
  if (
    state.mountInProgress
    || primaryWallet.element
    || !primaryWallet.container
    || !state.checkoutData
    || !state.cartData
    || !isStripePaymentMethodAvailable()
  ) {
    return;
  }
  state.mountInProgress = true;
  clearPaymentStatus();
  if (state.blockContainer) {
    state.blockContainer.hidden = false;
  }
  wallets.forEach((wallet) => {
    if (!wallet.container) return;
    wallet.container.hidden = false;
    wallet.container.classList.remove(HIDDEN_CLASS);
    wallet.container.classList.add(LOADING_CLASS);
  });
  try {
    await loadStripeJs();
    state.runtimeConfig = parseRuntimeConfig();
    [state.initParams] = await Promise.all([
      fetchInitParams(state.runtimeConfig.getInitParamsUrl),
      loadOrderSummarySettings(),
    ]);
    state.stripe = Stripe(state.initParams.publishableKey, state.initParams.options);
    if (state.initParams.appInfo) {
      state.stripe.registerAppInfo(state.initParams.appInfo);
    }
    const elementsOptions = getElementsOptions();
    syncMagentoShippingRates();
    const walletAmount = getWalletElementsAmount();
    elementsOptions.amount = walletAmount.amount;
    state.currentAmount = elementsOptions.amount;
    state.currentCurrency = elementsOptions.currency;
    wallets.forEach((wallet) => {
      if (!wallet.isEnabled(isVirtualCart()) || !wallet.container) return;
      wallet.elements = state.stripe.elements({
        ...elementsOptions,
      });
      if (wallet === primaryWallet) state.elements = wallet.elements;
      syncMagentoShippingRates();
      wallet.element = wallet.elements.create(
        STRIPE.ELEMENT_TYPE,
        {
          ...wallet.getOptions(getSharedExpressCheckoutFields(), state.currentShippingRates),
          lineItems: getWalletLineItems(),
        },
      );
      registerExpressCheckoutHandlers(wallet);
      wallet.element.mount(`#${wallet.containerId}`);
    });
    state.mountedConfigurationKey = getConfigurationKey();
    syncWalletGate();
  } catch (error) {
    console.warn(DIAGNOSTICS.ELEMENT_INIT_FAILED, error);
    hideExpressCheckout(false);
    await setPaymentStatus(MESSAGES.UNAVAILABLE, STATUS.ERROR);
  } finally {
    state.mountInProgress = false;
  }
}

/**
 * Mount, remount, or refresh totals while no wallet attempt is active.
 * @returns {Promise<void>}
 */
async function synchronizeMountedElement() {
  if (!primaryWallet.container || state.modalOpen || state.confirmationInProgress) {
    return;
  }
  if (!isStripePaymentMethodAvailable()) {
    destroyExpressCheckout();
    clearPaymentStatus();
    hideExpressCheckout();
    return;
  }
  if (!primaryWallet.element) {
    await ensureSelectedShippingOnCart();
    await mountExpressCheckout();
    return;
  }
  const nextConfigurationKey = getConfigurationKey();
  if (nextConfigurationKey !== state.mountedConfigurationKey) {
    destroyExpressCheckout();
    await mountExpressCheckout();
    return;
  }
  await ensureSelectedShippingOnCart();
  const money = getWalletElementsAmount();
  if (money.currency !== state.currentCurrency) {
    destroyExpressCheckout();
    await mountExpressCheckout();
    return;
  }
  if (money.amount !== state.currentAmount) {
    await updateMountedElementsAmount(money.amount);
  }
  syncWalletGate();
}

// Public checkout integration

/**
 * Render the Express payment surface and schedule its initial synchronization.
 * @param {Object} ctx Checkout slot context providing replaceHTML.
 * @param {Object} [options] Checkout integration settings.
 * @param {function(): Promise<boolean>} [options.handleValidation] Terms validation callback.
 * @param {function(): Promise<boolean>} [options.handleShippingValidation] Magento form validation.
 * @param {function(): boolean} [options.handleReadiness] Side-effect free readiness probe.
 * @returns {void}
 */
function renderStripePaymentMethod(ctx, options = {}) {
  destroyExpressCheckout();
  clearPaymentStatus();
  state.validateCheckout = options.handleValidation || null;
  state.validateShipping = options.handleShippingValidation || null;
  state.isCheckoutReady = options.handleReadiness || null;
  const content = document.createElement('div');
  content.className = BLOCK_CLASS;
  state.blockContainer = content;
  const heading = document.createElement('h3');
  heading.className = HEADING_CLASS;
  heading.textContent = MESSAGES.HEADING;
  wallets.forEach((wallet) => {
    wallet.container = document.createElement('div');
    wallet.container.id = wallet.containerId;
    wallet.container.className = [LOADING_CLASS, wallet.containerClassName]
      .filter(Boolean)
      .join(' ');
  });
  state.statusContainer = document.createElement('div');
  state.statusContainer.className = STATUS_CLASS;
  const separator = document.createElement('div');
  separator.className = SEPARATOR_CLASS;
  separator.textContent = MESSAGES.SEPARATOR;
  separator.setAttribute('role', 'separator');
  separator.setAttribute('aria-label', MESSAGES.SEPARATOR);
  const walletGroup = document.createElement('div');
  walletGroup.className = WALLETS_CLASS;
  wallets.forEach((wallet) => walletGroup.appendChild(wallet.container));
  state.gateOverlay = document.createElement('button');
  state.gateOverlay.type = 'button';
  state.gateOverlay.className = GATE_CLASS;
  state.gateOverlay.setAttribute('aria-label', MESSAGES.GATE_LABEL);
  state.gateOverlay.addEventListener('click', handleGatedWalletClick);
  walletGroup.appendChild(state.gateOverlay);
  content.appendChild(heading);
  content.appendChild(walletGroup);
  content.appendChild(state.statusContainer);
  content.appendChild(separator);
  ctx.replaceHTML(content);
  syncWalletGate();
  requestAnimationFrame(() => {
    synchronizeMountedElement();
  });
}

/**
 * Report whether Express Checkout already confirmed the requested cart.
 * @param {string} cartId Commerce cart ID.
 * @returns {Promise<boolean>}
 */
async function handleStripePayment(cartId) {
  return Boolean(cartId && state.confirmedCartId === cartId);
}

/**
 * Preserve the public validation contract for the active cart.
 * @returns {boolean}
 */
function validateStripePayment() {
  if (!wallets.some((wallet) => wallet.element)) {
    return true;
  }
  return state.confirmedCartId === getActiveCartId();
}

// Keep event subscriptions at the integration boundary.
events.on(
  EVENTS.CHECKOUT_INITIALIZED,
  (data) => {
    state.checkoutData = data;
    synchronizeMountedElement();
  },
  {
    eager: true,
  },
);
events.on(EVENTS.CHECKOUT_UPDATED, (data) => {
  state.checkoutData = data;
  synchronizeMountedElement();
});
events.on(
  EVENTS.CART_INITIALIZED,
  (data) => {
    state.cartData = data;
    synchronizeMountedElement();
  },
  {
    eager: true,
  },
);
events.on(
  EVENTS.CART_UPDATED,
  (data) => {
    state.cartData = data;
    synchronizeMountedElement();
  },
  {
    eager: true,
  },
);
// Checkout address/method changes refresh totals through cart/data without
// emitting cart/updated. Use the same cart snapshot as Commerce's Order Summary.
events.on(
  EVENTS.CART_DATA,
  (data) => {
    state.cartData = data;
    if (data) synchronizeMountedElement();
  },
  {
    eager: true,
  },
);
events.on(EVENTS.CART_RESET, () => {
  state.cartData = null;
  state.checkoutData = null;
  state.confirmedCartId = null;
  destroyExpressCheckout();
});

/**
 * Decorate the Express Checkout host injected into the Payment Methods title slot.
 * @param {Element} block Host element supplied by checkout.
 * @param {Object} [options] Checkout integration settings.
 * @param {function(): Promise<boolean>} [options.handleValidation] Terms validation callback.
 * @param {function(): Promise<boolean>} [options.handleShippingValidation] Magento form validation.
 * @returns {void}
 */
export default function decorate(block, options = {}) {
  renderStripePaymentMethod(
    {
      replaceHTML: (content) => block.replaceChildren(content),
    },
    options,
  );
}

export { handleStripePayment, renderStripePaymentMethod, validateStripePayment };
