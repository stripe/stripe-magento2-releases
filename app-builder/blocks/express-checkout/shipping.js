import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import { toStripeMinorUnits } from './money.js';
import {
  getWalletLineItems,
  readAmount,
} from './order-summary.js';
import {
  MESSAGES,
  DIAGNOSTICS,
} from './constants.js';
import { state } from './checkout-state.js';
import {
  getSelectedShippingMethod,
  isVirtualCart,
  getCheckoutShippingAddress,
  toWalletAddress,
  isCompleteCommerceAddress,
  isCompleteWalletAddress,
  toCommerceAddress,
  hasRequiredMagentoShipping,
  firstCompleteWallet,
  getCheckoutBillingAddress,
} from './addresses.js';
import { wallets } from './wallets.js';
import { getCustomerTokenFromCookie } from './stripe-api.js';

/**
 * Resolve the authoritative amount and currency from the cart fallbacks.
 * @param {Object} [source] Source cart or wallet model.
 * @returns {{amount: number, currency: string}}
 */
function getCartMoney(source = state.cartData) {
  const candidates = [
    source?.total?.includingTax,
    source?.total?.excludingTax,
    source?.prices?.grandTotal,
    source?.prices?.grand_total,
    state.checkoutData?.prices?.grandTotal,
    state.checkoutData?.prices?.grand_total,
  ];
  const money = candidates.find(
    (candidate) => candidate && Number.isFinite(Number(candidate.value)) && candidate.currency,
  );
  if (!money) {
    throw new Error(MESSAGES.CART_AMOUNT_UNAVAILABLE);
  }
  return {
    amount: toStripeMinorUnits(money.value, money.currency),
    currency: String(money.currency).toLowerCase(),
  };
}

/**
 * Read the carrier code from a Commerce shipping method.
 * @param {Object} method Commerce shipping method.
 * @returns {string|undefined}
 */
function getShippingMethodCarrierCode(method) {
  return method?.carrier?.code || method?.carrierCode || method?.carrier_code;
}

/**
 * Read the method code from a Commerce shipping method.
 * @param {Object} method Commerce shipping method.
 * @returns {string|undefined}
 */
function getShippingMethodCode(method) {
  return method?.code || method?.methodCode || method?.method_code;
}

/**
 * Build a stable Stripe rate ID from the carrier and method codes.
 * @param {Object} method Commerce shipping method.
 * @returns {string}
 */
function getShippingMethodRateId(method) {
  return `${encodeURIComponent(getShippingMethodCarrierCode(method))}:${encodeURIComponent(getShippingMethodCode(method))}`;
}

/**
 * Convert a Commerce method and register its Stripe rate ID for later selection.
 * @param {Object} method Commerce shipping method.
 * @returns {Object|null}
 */
function toStripeShippingRate(method) {
  const carrierCode = getShippingMethodCarrierCode(method);
  const methodCode = getShippingMethodCode(method);
  const amount = method?.amount || method?.amountInclTax;
  if (!carrierCode || !methodCode || !amount) {
    return null;
  }
  const id = getShippingMethodRateId(method);
  state.shippingMethodsByRateId.set(id, method);
  return {
    id,
    displayName: [method?.carrier?.title, method?.title].filter(Boolean).join(' - '),
    amount: toStripeMinorUnits(amount.value, amount.currency),
  };
}

/**
 * Replace the rate lookup and put the selected Commerce method first.
 * @param {Object[]} [methods] Available Commerce shipping methods.
 * @returns {Object[]}
 */
function setAvailableShippingMethods(methods = []) {
  state.shippingMethodsByRateId = new Map();
  state.currentShippingRates = methods.map(toStripeShippingRate).filter(Boolean);
  const selected = getSelectedShippingMethod();
  if (selected) {
    const selectedId = getShippingMethodRateId(selected);
    state.currentShippingRates.sort((left, right) => {
      if (left.id === selectedId) return -1;
      if (right.id === selectedId) return 1;
      return 0;
    });
  }
  return state.currentShippingRates;
}

/**
 * Read the selected shipping amount in Stripe minor units.
 * @returns {number}
 */
function getSelectedShippingAmountCents() {
  const method = getSelectedShippingMethod();
  const amount = method?.amount || method?.amountInclTax;
  const value = Number(amount?.value);
  return Number.isFinite(value) ? toStripeMinorUnits(value, amount.currency) : 0;
}

/**
 * Convert an available cart price to minor units without inventing a currency.
 * @param {Object} price Commerce price with value and currency.
 * @returns {number|null}
 */
function getCartPriceCents(price) {
  const value = Number(price?.value);
  if (!Number.isFinite(value) || !price?.currency) {
    return null;
  }
  return toStripeMinorUnits(value, price.currency);
}

/**
 * Preserve the estimate of shipping already included in the cart total.
 * @param {Object} [money] Cart amount in minor units and its currency.
 * @returns {number}
 */
function getIncludedShippingCents(money = getCartMoney()) {
  const cartShippingCents = getCartPriceCents(state.cartData?.shipping);
  if (cartShippingCents > 0) {
    return cartShippingCents;
  }
  const subtotalCents = getCartPriceCents(
    state.cartData?.subtotal?.includingTax || state.cartData?.subtotal?.excludingTax,
  );
  if (subtotalCents != null) {
    const inferredShipping = money.amount - subtotalCents;
    // Magento often omits cart.shipping while grand total already includes a
    // default rate. Subtract that so a different selected method is not added
    // on top of the rate already in the total.
    if (inferredShipping > 0) {
      return inferredShipping;
    }
  }
  const selectedCents = getSelectedShippingAmountCents();
  if (selectedCents > 0 && subtotalCents != null) {
    return 0;
  }
  return selectedCents;
}

/**
 * Compare selected and included shipping using the minor-unit tolerance.
 * @returns {boolean}
 */
function shippingSelectionMatchesCart() {
  // Checkout's selected method is server-backed. Its explicit tax amounts make
  // subtracting grand total and subtotal unnecessary (and unsafe with fees).
  if (hasCommerceShippingTotals()) return true;
  const selectedCents = getSelectedShippingAmountCents();
  if (selectedCents <= 0) {
    return true;
  }
  return Math.abs(getIncludedShippingCents() - selectedCents) <= 1;
}

/**
 * Identify a selected Commerce method with explicit tax amounts. For these
 * snapshots, preserve the server grand total rather than reconstructing it.
 * @returns {boolean}
 */
function hasCommerceShippingTotals() {
  const method = getSelectedShippingMethod();
  const { currency } = getCartMoney();
  return readAmount(method?.amountExclTax, currency) !== null
    && readAmount(method?.amountInclTax, currency) !== null;
}

/**
 * Persist a mismatched delivery selection and refresh the Commerce totals.
 * @returns {Promise<Object>}
 */
async function ensureSelectedShippingOnCart() {
  const selected = getSelectedShippingMethod();
  if (isVirtualCart() || !selected || shippingSelectionMatchesCart()) {
    return getCartMoney();
  }
  try {
    const updatedCheckout = await checkoutApi.setShippingMethods([
      getShippingMethodInput(selected),
    ]);
    if (updatedCheckout) {
      state.checkoutData = {
        ...state.checkoutData,
        ...updatedCheckout,
        availablePaymentMethods:
          updatedCheckout.availablePaymentMethods
          || state.checkoutData?.availablePaymentMethods,
      };
    }
    return refreshAuthoritativeCart();
  } catch (error) {
    console.warn(DIAGNOSTICS.SHIPPING_SELECTION_FAILED, error);
    return getCartMoney();
  }
}

/**
 * Use Magento's total, including its calculated shipping, taxes, and discounts.
 * @returns {{amount: number, currency: string}}
 */
function getWalletElementsAmount() {
  return getCartMoney();
}

/**
 * Align the wallet amount with Commerce before resolving shipping rows.
 * @returns {Promise<void>}
 */
async function syncWalletAmountFromCart() {
  const money = getWalletElementsAmount();
  if (money.currency !== state.currentCurrency) {
    throw new Error(MESSAGES.CURRENCY_CHANGED);
  }
  if (money.amount !== state.currentAmount) {
    await updateMountedElementsAmount(money.amount);
  }
}

/**
 * Update each distinct Elements instance and record the displayed amount.
 * @param {number} amount New amount in Stripe minor units.
 * @returns {Promise<void>}
 */
async function updateMountedElementsAmount(amount) {
  // Update before yielding so an immediately resolved click sees the same total.
  const updates = [...wallets.map((wallet) => wallet.elements), state.elements]
    .filter(Boolean)
    .filter((instance, index, list) => list.indexOf(instance) === index)
    .map((instance) => instance.update({ amount }));
  state.currentAmount = amount;
  await Promise.all(
    updates,
  );
}

/**
 * Read Commerce rates, falling back to its selected method for partial snapshots.
 * @returns {Object[]}
 */
function getAvailableShippingMethods() {
  const shippingAddress = getCheckoutShippingAddress();
  const methods = (
    shippingAddress?.availableShippingMethods
    || shippingAddress?.available_shipping_methods
    || []
  );
  const selected = getSelectedShippingMethod();
  return methods.length ? methods : [selected].filter(Boolean);
}

/**
 * Refresh the rate lookup, clearing it for virtual carts.
 * @returns {void}
 */
function syncMagentoShippingRates() {
  if (isVirtualCart()) {
    setAvailableShippingMethods([]);
    return;
  }
  setAvailableShippingMethods(getAvailableShippingMethods());
}

/**
 * Build rate-estimation criteria from a potentially redacted wallet address.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {Object}
 */
function getEstimateShippingInput(address) {
  const normalized = toWalletAddress({
    address,
  })?.address || address;
  return {
    criteria: {
      country_code: normalized.country,
      ...(normalized.state
        ? {
          region_name: normalized.state,
        }
        : {}),
      ...(normalized.postal_code
        ? {
          zip: normalized.postal_code,
        }
        : {}),
    },
  };
}

/**
 * Build Commerce shipping-method mutation input.
 * @param {Object} method Commerce shipping method.
 * @returns {Object}
 */
function getShippingMethodInput(method) {
  return {
    carrierCode: getShippingMethodCarrierCode(method),
    methodCode: getShippingMethodCode(method),
  };
}

/**
 * Refresh cart totals and checkout data in the request order.
 * @returns {Promise<Object>}
 */
async function refreshAuthoritativeCart() {
  const refreshedCart = await cartApi.refreshCart();
  if (refreshedCart) {
    state.cartData = refreshedCart;
  }
  const refreshedCheckout = await checkoutApi.getCart();
  if (refreshedCheckout) {
    state.checkoutData = {
      ...state.checkoutData,
      ...refreshedCheckout,
      availablePaymentMethods:
        refreshedCheckout.availablePaymentMethods
        || state.checkoutData?.availablePaymentMethods,
    };
  }
  return getCartMoney();
}

/**
 * Refresh Commerce totals and update Elements when the currency is unchanged.
 * @returns {Promise<Object>}
 */
async function updateElementsAmountFromCart() {
  const money = await refreshAuthoritativeCart();
  if (money.currency !== state.currentCurrency) {
    throw new Error(MESSAGES.CURRENCY_CHANGED);
  }
  if (money.amount !== state.currentAmount) {
    await updateMountedElementsAmount(money.amount);
  }
  return money;
}

/**
 * Estimate wallet rates and persist a full address only when checkout lacks one.
 * @param {Object} event Stripe Express Checkout event.
 * @returns {Promise<void>}
 */
async function handleShippingAddressChange(event) {
  try {
    let persistedCheckout = null;
    const walletAddress = toWalletAddress({
      name: event.name,
      address: event.address,
      phone: event.phone || event.phoneNumber,
    });
    const magentoHasShipping = isCompleteCommerceAddress(getCheckoutShippingAddress());
    if (magentoHasShipping) {
      // Estimation emits shipping/estimate, which makes Order Summary calculate
      // totals with the wallet address. Keep checkout-owned shipping isolated.
      const shippingRates = setAvailableShippingMethods(getAvailableShippingMethods());
      if (!shippingRates.length) {
        event.reject();
        return;
      }
      await syncWalletAmountFromCart();
      event.resolve({ shippingRates, lineItems: getWalletLineItems() });
      return;
    }
    if (isCompleteWalletAddress(walletAddress) && !magentoHasShipping) {
      persistedCheckout = await checkoutApi.setShippingAddress({
        address: toCommerceAddress(walletAddress, walletAddress.phone),
      });
      state.walletShippingAddressPersisted = true;
      if (persistedCheckout) {
        state.checkoutData = {
          ...state.checkoutData,
          ...persistedCheckout,
          availablePaymentMethods:
            persistedCheckout.availablePaymentMethods
            || state.checkoutData?.availablePaymentMethods,
        };
      }
    }
    const persistedMethods = persistedCheckout ? getAvailableShippingMethods() : [];
    let methods = persistedMethods;
    if (methods.length === 0 && event.address) {
      methods = (await checkoutApi.estimateShippingMethods(
        getEstimateShippingInput(event.address),
      )) || [];
    }
    const shippingRates = setAvailableShippingMethods(methods);
    if (shippingRates[0]) {
      [state.pendingShippingMethod] = methods;
      if (state.walletShippingAddressPersisted) {
        await checkoutApi.setShippingMethods([
          getShippingMethodInput(state.pendingShippingMethod),
        ]);
        await updateElementsAmountFromCart();
      }
    }
    await syncWalletAmountFromCart();
    event.resolve({
      shippingRates,
      lineItems: getWalletLineItems(),
    });
  } catch (error) {
    console.warn(DIAGNOSTICS.SHIPPING_ESTIMATE_FAILED, error);
    event.reject();
  }
}

/**
 * Persist or retain a wallet delivery selection according to address ownership.
 * @param {Object} event Stripe Express Checkout event.
 * @returns {Promise<void>}
 */
async function handleShippingRateChange(event) {
  try {
    const method = state.shippingMethodsByRateId.get(event.shippingRate?.id);
    if (!method) {
      event.reject();
      return;
    }
    state.pendingShippingMethod = method;
    if (state.walletShippingAddressPersisted && !hasRequiredMagentoShipping()) {
      await checkoutApi.setShippingMethods([getShippingMethodInput(method)]);
      await updateElementsAmountFromCart();
    }
    await syncWalletAmountFromCart();
    event.resolve({
      shippingRates: state.currentShippingRates,
      lineItems: getWalletLineItems(),
    });
  } catch (error) {
    console.warn(DIAGNOSTICS.SHIPPING_METHOD_FAILED, error);
    event.reject();
  }
}

/**
 * Persist complete wallet billing through the Checkout Drop-in.
 * @param {Object} walletAddress Wallet address with contact and nested address fields.
 * @param {string} phone Optional phone override.
 * @returns {Promise<void>}
 */
async function persistBillingAddress(walletAddress, phone) {
  await checkoutApi.setBillingAddress({
    address: toCommerceAddress(walletAddress, phone),
  });
}

/**
 * Synchronize missing contact and address data, preserving complete Magento shipping.
 * @param {Object} event Stripe Express Checkout event.
 * @param {Object} [extraWallets] Optional addresses recovered from a Confirmation Token.
 * @returns {Promise<Object>}
 */
async function synchronizeWalletDetails(event, extraWallets = {}) {
  const isGuest = state.checkoutData?.isGuest
    ?? state.cartData?.isGuestCart
    ?? !getCustomerTokenFromCookie();
  const { billingDetails } = event;
  if (isGuest && !state.checkoutData?.email && billingDetails?.email) {
    await checkoutApi.setGuestEmailOnCart(billingDetails.email);
    state.checkoutData = {
      ...state.checkoutData,
      email: billingDetails.email,
    };
  }
  const magentoHasShipping = isCompleteCommerceAddress(getCheckoutShippingAddress());
  const shippingWallet = state.walletShippingRequired
    ? firstCompleteWallet(
      extraWallets.shipping,
      toWalletAddress(event.shippingAddress),
      magentoHasShipping ? null : toWalletAddress(billingDetails),
    )
    : null;
  const billingWallet = firstCompleteWallet(
    extraWallets.billing,
    toWalletAddress(billingDetails),
    shippingWallet,
  );
  const phone = billingDetails?.phone || shippingWallet?.phone || billingWallet?.phone;
  if (isCompleteWalletAddress(shippingWallet) && !magentoHasShipping) {
    await checkoutApi.setShippingAddress({
      address: toCommerceAddress(shippingWallet, phone),
    });
    state.walletShippingAddressPersisted = true;
  }
  const selectedMethod = state.walletShippingRequired
    ? state.shippingMethodsByRateId.get(event.shippingRate?.id)
      || state.pendingShippingMethod
    : null;
  if (selectedMethod && state.walletShippingAddressPersisted) {
    await checkoutApi.setShippingMethods([getShippingMethodInput(selectedMethod)]);
  }
  if (!isCompleteCommerceAddress(getCheckoutBillingAddress())) {
    if (isCompleteWalletAddress(billingWallet)) {
      await persistBillingAddress(billingWallet, phone);
    } else if (
      state.walletShippingAddressPersisted
      || isCompleteCommerceAddress(getCheckoutShippingAddress())
    ) {
      await checkoutApi.setBillingAddress({
        sameAsShipping: true,
      });
    }
  }
  return refreshAuthoritativeCart();
}

export {
  getCartMoney,
  syncMagentoShippingRates,
  updateMountedElementsAmount,
  ensureSelectedShippingOnCart,
  getWalletElementsAmount,
  synchronizeWalletDetails,
  handleShippingAddressChange,
  handleShippingRateChange,
};
