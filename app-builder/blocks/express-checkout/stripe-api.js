/* global Stripe */

import { events } from '@dropins/tools/event-bus.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import {
  DEFAULT_STORE_VIEW, CUSTOMER_TOKEN_COOKIE_PATTERN,
  STRIPE_REQUEST_TIMEOUT,
  MESSAGES,
  STRIPE_LOADING_PROMISE_KEY,
  STRIPE_JS_URL,
  EVENTS,
  CART_ID_KEY,
  STRIPE_PAYMENT_METHOD_CODE,
  STORE_VIEW_KEY,
  STRIPE_PAYMENT_METHOD_TITLE,
} from './constants.js';
import { state } from './checkout-state.js';
import { getCommerceCustomerName } from './addresses.js';

/**
 * Fetch an App Builder resource with the request timeout.
 * @param {string} resource Configured App Builder action URL.
 * @param {RequestInit} [options] Fetch request options.
 * @returns {Promise<Response>}
 */
async function fetchStripeResource(resource, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), STRIPE_REQUEST_TIMEOUT);
  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(MESSAGES.REQUEST_TIMEOUT);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Reuse the Stripe.js loading promise shared with the regular payment form.
 * @returns {Promise<void>}
 */
function loadStripeJs() {
  if (state.stripeLoadingPromise) {
    return state.stripeLoadingPromise;
  }
  if (window[STRIPE_LOADING_PROMISE_KEY]) {
    state.stripeLoadingPromise = window[STRIPE_LOADING_PROMISE_KEY];
    return state.stripeLoadingPromise;
  }
  if (typeof Stripe !== 'undefined') {
    return Promise.resolve();
  }
  state.stripeLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STRIPE_JS_URL;
    const timeoutId = window.setTimeout(() => {
      state.stripeLoadingPromise = null;
      window[STRIPE_LOADING_PROMISE_KEY] = null;
      script.remove();
      reject(new Error(MESSAGES.SDK_TIMEOUT));
    }, STRIPE_REQUEST_TIMEOUT);
    script.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      state.stripeLoadingPromise = null;
      window[STRIPE_LOADING_PROMISE_KEY] = null;
      reject(new Error(MESSAGES.SDK_LOAD_FAILED));
    };
    document.head.appendChild(script);
  });
  window[STRIPE_LOADING_PROMISE_KEY] = state.stripeLoadingPromise;
  return state.stripeLoadingPromise;
}

/**
 * Read the current customer bearer token from the Drop-in cookie.
 * @returns {string|null}
 */
function getCustomerTokenFromCookie() {
  const match = document.cookie.match(CUSTOMER_TOKEN_COOKIE_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolve the active cart ID using the event and storage fallback order.
 * @param {string|null} [preferredCartId] Explicit cart ID to prefer over stored state.
 * @returns {string|null}
 */
function getActiveCartId(preferredCartId = null) {
  return (
    preferredCartId
    || state.cartData?.id
    || state.checkoutData?.id
    || events.lastPayload(EVENTS.CART_UPDATED)?.id
    || events.lastPayload(EVENTS.CART_INITIALIZED)?.id
    || window.sessionStorage.getItem(CART_ID_KEY)
    || null
  );
}

/**
 * Find the Stripe method and its Commerce-provided runtime configuration.
 * @returns {Object|undefined}
 */
function getStripePaymentMethod() {
  const paymentMethods = [
    state.checkoutData?.selectedPaymentMethod,
    ...(state.checkoutData?.availablePaymentMethods || []),
  ].filter(Boolean);
  return paymentMethods.find((method) => method.code === STRIPE_PAYMENT_METHOD_CODE);
}

/**
 * Check whether Commerce exposes the Stripe payment method.
 * @returns {boolean}
 */
function isStripePaymentMethodAvailable() {
  return Boolean(getStripePaymentMethod());
}

/**
 * Read the required App Builder action URLs from the Commerce payment method.
 * @returns {Object}
 */
function parseRuntimeConfig() {
  const backendIntegrationUrl = getStripePaymentMethod()?.oope_payment_method_config
    ?.backend_integration_url;
  if (!backendIntegrationUrl) {
    throw new Error(MESSAGES.CONFIG_UNAVAILABLE);
  }
  const parsedConfig = JSON.parse(backendIntegrationUrl);
  if (!parsedConfig.getInitParamsUrl || !parsedConfig.createPaymentIntentUrl) {
    throw new Error(MESSAGES.CONFIG_INCOMPLETE);
  }
  return parsedConfig;
}

/**
 * Fetch and validate the public Stripe initialization response.
 * @param {string} endpoint Configured initialization action URL.
 * @returns {Promise<Object>}
 */
async function fetchInitParams(endpoint) {
  const response = await fetchStripeResource(endpoint);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.publishableKey) {
    throw new Error(MESSAGES.INIT_UNAVAILABLE);
  }
  return data;
}

/**
 * Build the store and optional customer-authentication headers.
 * @returns {Object}
 */
function getPaymentIntentHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  const customerToken = getCustomerTokenFromCookie();
  if (customerToken) {
    headers.Authorization = `Bearer ${customerToken}`;
  }
  headers.Store = window.localStorage.getItem(STORE_VIEW_KEY) || DEFAULT_STORE_VIEW;
  return headers;
}

/**
 * Send cart context and the Confirmation Token ID to the configured action.
 * @param {string} confirmationTokenId Stripe Confirmation Token ID.
 * @returns {Promise<Object>}
 */
async function createPaymentIntent(confirmationTokenId) {
  const cartId = getActiveCartId();
  const selectedStore = window.localStorage.getItem(STORE_VIEW_KEY) || DEFAULT_STORE_VIEW;
  const response = await fetchStripeResource(state.runtimeConfig.createPaymentIntentUrl, {
    method: 'POST',
    headers: getPaymentIntentHeaders(),
    body: JSON.stringify({
      cartId,
      cartFullName: getCommerceCustomerName(),
      confirmationTokenId,
      storeCode: selectedStore,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.client_secret) {
    throw new Error(data?.error || data?.message || MESSAGES.INTENT_FAILED);
  }
  return data;
}

/**
 * Select Stripe in the UI and verify Commerce persisted its client secret.
 * @param {string} clientSecret PaymentIntent client secret returned by App Builder.
 * @returns {Promise<Object>}
 */
async function persistStripePaymentMethod(clientSecret) {
  const stripePaymentMethod = getStripePaymentMethod() || {
    code: STRIPE_PAYMENT_METHOD_CODE,
    title: STRIPE_PAYMENT_METHOD_TITLE,
  };
  const checkoutValues = events.lastPayload(EVENTS.CHECKOUT_VALUES) || {};
  events.emit(EVENTS.CHECKOUT_VALUES, {
    ...checkoutValues,
    selectedPaymentMethod: stripePaymentMethod,
  });
  const updatedCheckout = await checkoutApi.setPaymentMethod({
    code: STRIPE_PAYMENT_METHOD_CODE,
    additional_data: [
      {
        key: 'client_secret',
        value: clientSecret,
      },
    ],
  });
  if (updatedCheckout?.selectedPaymentMethod?.code !== STRIPE_PAYMENT_METHOD_CODE) {
    throw new Error(MESSAGES.METHOD_NOT_PERSISTED);
  }
  state.checkoutData = {
    ...state.checkoutData,
    ...updatedCheckout,
    availablePaymentMethods:
      updatedCheckout.availablePaymentMethods
      || state.checkoutData?.availablePaymentMethods,
  };
  events.emit(EVENTS.CHECKOUT_VALUES, {
    ...(events.lastPayload(EVENTS.CHECKOUT_VALUES) || {}),
    selectedPaymentMethod: updatedCheckout.selectedPaymentMethod,
  });
  return updatedCheckout;
}

export {
  getCustomerTokenFromCookie,
  getActiveCartId,
  createPaymentIntent,
  persistStripePaymentMethod,
  isStripePaymentMethodAvailable,
  loadStripeJs,
  parseRuntimeConfig,
  fetchInitParams,
};
