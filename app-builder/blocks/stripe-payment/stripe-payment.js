/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* global Stripe */

// Dropin Tools
import { events } from '@dropins/tools/event-bus.js';

// Checkout Dropin
import * as checkoutApi from '@dropins/storefront-checkout/api.js';

import { loadCSS } from '../../scripts/aem.js';

/**
 * Stripe Payment Block
 *
 * This block integrates Stripe payment processing into the Adobe Commerce EDS checkout flow.
 * It dynamically loads Stripe.js, initializes the payment form, and handles payment processing.
 */

// Load the CSS for this block
loadCSS('/blocks/stripe-payment/stripe-payment.css');

// Define the Stripe payment method code as a constant
const STRIPE_PAYMENT_METHOD_CODE = 'oope_stripe';
const STRIPE_REQUEST_TIMEOUT = 15000;
const STRIPE_LOADING_PROMISE_KEY = '__stripeJsLoadingPromise';

// Store the loading promise to avoid multiple loading attempts
let stripeLoadingPromise = null;

// Global state
let checkoutData = null;
let cartData = null;
let elements = null;
let paymentElement = null;
let stripe = null;
let paymentFormComplete = false;
let pendingClientSecret = null;
let pendingReturnUrl = null;
let persistedPaymentMethodClientSecret = null;
let paymentFormMounting = false;

async function fetchStripeResource(resource, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), STRIPE_REQUEST_TIMEOUT);

  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Stripe did not respond in time. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

const STRIPE_THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'JOD', 'KWD', 'OMR', 'TND',
]);

// Helper to ensure Stripe.js is loaded
const loadStripeJs = () => {
  // If there's already a loading promise in progress, return it
  if (stripeLoadingPromise) {
    return stripeLoadingPromise;
  }

  if (window[STRIPE_LOADING_PROMISE_KEY]) {
    stripeLoadingPromise = window[STRIPE_LOADING_PROMISE_KEY];
    return stripeLoadingPromise;
  }

  // If Stripe is already defined, resolve immediately
  if (typeof Stripe !== 'undefined') {
    return Promise.resolve();
  }

  // Create a new loading promise
  stripeLoadingPromise = new Promise((resolve, reject) => {
    // Loading Stripe.js dynamically...
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    const timeoutId = window.setTimeout(() => {
      stripeLoadingPromise = null;
      window[STRIPE_LOADING_PROMISE_KEY] = null;
      script.remove();
      reject(new Error('Stripe.js did not load in time.'));
    }, STRIPE_REQUEST_TIMEOUT);
    script.onload = () => {
      // Stripe.js loaded successfully
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = (error) => {
      // Failed to load Stripe.js
      window.clearTimeout(timeoutId);
      stripeLoadingPromise = null; // Reset so we can try again next time
      window[STRIPE_LOADING_PROMISE_KEY] = null;
      reject(new Error('Failed to load Stripe.js'));
    };
    document.head.appendChild(script);
  });
  window[STRIPE_LOADING_PROMISE_KEY] = stripeLoadingPromise;

  return stripeLoadingPromise;
};

// Helper to display Stripe payment errors
function displayStripeError(message, containerId = 'stripe-elements-container') {
  const container = document.querySelector(`#${containerId}`);
  if (!container) {
    console.error('Error container not found:', containerId);
    return;
  }

  // Create error container if it doesn't exist
  let errorContainer = container.querySelector('.stripe-error');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.className = 'stripe-error';
    container.appendChild(errorContainer);
  }

  errorContainer.textContent = message;

  // Scroll to error for visibility
  errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  setTimeout(() => {
    clearStripeError(containerId);
  }, 10000);
}

// Helper to clear Stripe payment errors
function clearStripeError(containerId = 'stripe-elements-container') {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;

  const errorContainer = container.querySelector('.stripe-error');
  if (errorContainer) {
    errorContainer.remove();
  }
}

// Helper to get the customer auth token from cookie (set by storefront-auth dropin)
function getCustomerTokenFromCookie() {
  const match = document.cookie.match(
    /(?:^|;\s*)auth_dropin_user_token=([^;]+)/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getActiveCartId(preferredCartId = null) {
  return (
    preferredCartId
    || cartData?.id
    || events.lastPayload('cart/updated')?.id
    || events.lastPayload('cart/initialized')?.id
    || window.sessionStorage.getItem('DROPINS_CART_ID')
    || null
  );
}

function getStripeAmount(cartDataParam = cartData) {
  const total = cartDataParam?.total?.includingTax;
  const value = Number(total?.value);
  const currency = total?.currency?.toUpperCase();

  if (!Number.isFinite(value) || value <= 0 || !currency) {
    throw new Error('Cart total is unavailable for Stripe payment initialization.');
  }

  let fractionDigits = 2;
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency)) fractionDigits = 0;
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(currency)) fractionDigits = 3;

  return {
    amount: Math.round(value * (10 ** fractionDigits)),
    currency: currency.toLowerCase(),
  };
}

function parseStripeRuntimeConfig(stripePaymentMethod) {
  const backendIntegrationUrl = stripePaymentMethod
    ?.oope_payment_method_config?.backend_integration_url;

  if (!backendIntegrationUrl) {
    console.error(
      'Stripe backend integration URL is missing in Commerce payment configuration.',
    );
    throw new Error('Stripe payment configuration is invalid.');
  }

  let paymentConfig;
  try {
    paymentConfig = JSON.parse(backendIntegrationUrl);
  } catch (error) {
    console.error('Stripe backend integration URL is not valid JSON.', error);
    throw new Error('Stripe payment configuration is invalid.');
  }

  if (
    !paymentConfig.getInitParamsUrl
    || !paymentConfig.createPaymentIntentUrl
  ) {
    console.error(
      'Stripe runtime URLs are missing in the Commerce payment configuration.',
    );
    throw new Error('Stripe payment configuration is invalid.');
  }

  return paymentConfig;
}

// Function to create a payment session with the OOPE payment gateway (Stripe)
async function createPaymentIntent(endpoint, request) {
  const headers = { 'Content-Type': 'application/json' };
  const customerToken = getCustomerTokenFromCookie();
  if (customerToken) {
    headers.Authorization = `Bearer ${customerToken}`;
  }

  const selectedStore = window.localStorage.getItem('store-view') || 'default';
  headers.Store = selectedStore;

  const response = await fetchStripeResource(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      data.error || data.message || 'Unable to create Stripe session.',
    );
  }

  return data;
}

function shouldRetryPaymentFormMount() {
  return Boolean(
    checkoutData
      && isStripePaymentMethodAvailable()
      && getActiveCartId()
      && document.querySelector('#stripe-elements-container')
      && !paymentElement
      && !pendingClientSecret
      && !paymentFormMounting,
  );
}

function retryPaymentFormMount() {
  if (!shouldRetryPaymentFormMount()) {
    return;
  }

  mountPaymentForm('#stripe-elements-container');
}

function resetMountedPaymentElement() {
  if (paymentElement) {
    try {
      paymentElement.destroy();
    } catch (error) {
      console.warn('Unable to destroy Stripe payment element:', error);
    }
  }

  paymentElement = null;
  elements = null;
  paymentFormComplete = false;
  persistedPaymentMethodClientSecret = null;
  pendingClientSecret = null;
  pendingReturnUrl = null;
}

// Create the PaymentIntent only after checkout and Stripe forms pass validation.
async function startPayment(cartDataParam, checkoutDataParam) {
  // Locate the Stripe payment method
  const stripePaymentMethod = checkoutDataParam.availablePaymentMethods.find(
    (method) => method.code === STRIPE_PAYMENT_METHOD_CODE,
  );

  if (!stripePaymentMethod) {
    console.error('Stripe payment method configuration is missing.');
    throw new Error('Stripe payment method is not available.');
  }

  const paymentConfig = parseStripeRuntimeConfig(stripePaymentMethod);

  const runtimeCreatePaymentIntentUrl = paymentConfig.createPaymentIntentUrl;
  const cartId = getActiveCartId(cartDataParam?.id);

  if (!cartId) {
    throw new Error(
      'Cart ID is not available for Stripe payment initialization.',
    );
  }

  const cartFullName = `${checkoutDataParam?.billingAddress?.firstName || ''} ${checkoutDataParam?.billingAddress?.lastName || ''}`.trim();
  const beginCreatePaymentIntent = await createPaymentIntent(
    runtimeCreatePaymentIntentUrl,
    {
      cartId,
      cartFullName,
    },
  );

  if (!beginCreatePaymentIntent || !beginCreatePaymentIntent.client_secret) {
    displayStripeError('Payment error: Unable to create Stripe session.');
    return { client_secret: null };
  }

  return {
    client_secret: beginCreatePaymentIntent.client_secret,
    return_url: beginCreatePaymentIntent.return_url || null,
  };
}

async function persistStripePaymentMethod(clientSecret) {
  if (persistedPaymentMethodClientSecret === clientSecret) {
    return true;
  }

  const paymentMethodResponse = await checkoutApi.setPaymentMethod({
    code: STRIPE_PAYMENT_METHOD_CODE,
    additional_data: [{ key: 'client_secret', value: clientSecret }],
  });

  if (!paymentMethodResponse) {
    return false;
  }

  persistedPaymentMethodClientSecret = clientSecret;
  return true;
}

function getCurrentBillingDetails() {
  const billingAddress = checkoutData?.billingAddress || {};
  const billingCountry = billingAddress?.country?.code
    || billingAddress?.country?.value
    || billingAddress?.countryCode
    || '';

  return {
    name: `${billingAddress?.firstName || ''} ${billingAddress?.lastName || ''}`.trim(),
    email: checkoutData?.email || '',
    phone: billingAddress?.telephone || '',
    address: {
      line1: billingAddress?.street?.[0] || '',
      line2: billingAddress?.street?.[1] || '',
      city: billingAddress?.city || '',
      state: billingAddress?.region?.code || '',
      country: billingCountry,
      postal_code: billingAddress?.postCode || billingAddress?.postcode || '',
    },
  };
}

function removeEmptyStripeValues(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((result, [key, fieldValue]) => {
    if (fieldValue === '' || fieldValue === null || fieldValue === undefined) {
      return result;
    }

    if (typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
      const nestedValue = removeEmptyStripeValues(fieldValue);
      if (Object.keys(nestedValue).length === 0) {
        return result;
      }
      result[key] = nestedValue;
      return result;
    }

    result[key] = fieldValue;
    return result;
  }, {});
}

function getPaymentElementOptions() {
  const currentBillingDetails = getCurrentBillingDetails();

  return {
    layout: 'accordion',
    fields: {
      billingDetails: {
        name: 'never',
        email: 'never',
        phone: (currentBillingDetails.phone ? 'never' : 'auto'),
        address: {
          line1: (currentBillingDetails.address.line1 ? 'never' : 'auto'),
          line2: (currentBillingDetails.address.line2 ? 'never' : 'auto'),
          city: (currentBillingDetails.address.city ? 'never' : 'auto'),
          state: (currentBillingDetails.address.state ? 'never' : 'auto'),
          country: (currentBillingDetails.address.country ? 'never' : 'auto'),
          postalCode: (currentBillingDetails.address.postal_code ? 'never' : 'auto'),
        },
      },
    },
    defaultValues: {
      billingDetails: getCurrentBillingDetails(),
    },
  };
}

function updateStripeBillingDetails() {
  if (paymentElement && paymentElement.update) {
    paymentElement.update(getPaymentElementOptions());
  }
}

function updateStripeCartTotal() {
  if (!elements || pendingClientSecret || !elements.update) {
    return;
  }

  try {
    elements.update(getStripeAmount());
  } catch (error) {
    console.warn('Unable to update Stripe payment amount:', error);
  }
}

async function mountPaymentForm(mountId) {
  if (paymentElement || paymentFormMounting) {
    return;
  }

  paymentFormMounting = true;
  const mountIdWithoutHash = mountId.startsWith('#')
    ? mountId.substring(1)
    : mountId;

  let initParams;

  try {
    // Ensure Stripe.js is loaded before continuing
    await loadStripeJs();

    // Retrieve Stripe config dynamically
    const stripePaymentMethod = checkoutData.availablePaymentMethods.find(
      (method) => method.code === STRIPE_PAYMENT_METHOD_CODE,
    );

    if (!stripePaymentMethod) {
      console.error('Stripe payment method configuration is missing.');
      throw new Error('Stripe payment method is not available.');
    }

    const paymentConfig = parseStripeRuntimeConfig(stripePaymentMethod);

    // Fetch the Stripe Init Params
    const stripeInitParams = await fetchStripeResource(paymentConfig.getInitParamsUrl);

    if (!stripeInitParams.ok) {
      throw new Error(
        `Failed to load Stripe init params: ${stripeInitParams.statusText}`,
      );
    }

    initParams = await stripeInitParams.json();
  } catch (error) {
    console.error('Error fetching Stripe key:', error);
    // Display the error using our helper function
    displayStripeError(
      'Unable to load payment form. Please refresh and try again.',
      mountIdWithoutHash,
    );
    paymentFormMounting = false;
    return;
  }

  try {
    stripe = Stripe(initParams.publishableKey, initParams.options);
    stripe.registerAppInfo(initParams.appInfo);
    // Must match the PaymentIntent's capture_method (manual capture mode).
    const { captureMethod } = initParams.elementsOptions || {};
    elements = stripe.elements({
      mode: 'payment',
      ...getStripeAmount(),
      ...(captureMethod ? { captureMethod } : {}),
    });

    // Make sure the loading container is removed before mounting
    const container = document.querySelector(mountId);
    if (container && container.closest('.stripe-elements-loading')) {
      container
        .closest('.stripe-elements-loading')
        .classList.remove('stripe-elements-loading');
    }
    if (container) {
      container.innerHTML = '';
    }

    const options = getPaymentElementOptions();
    paymentElement = elements.create('payment', options);
    paymentElement.mount(mountId);

    // Track form completion status
    paymentElement.on('change', (event) => {
      paymentFormComplete = event.complete;
    });

    // Set up event listener for future checkout updates
    events.on('checkout/updated', updateStripeBillingDetails);
    paymentFormMounting = false;
  } catch (error) {
    console.error('Error initializing Stripe payment form:', error);
    // Display the error using our helper function
    displayStripeError(
      'Unable to initialize payment form. Please refresh and try again.',
      mountIdWithoutHash,
    );
    paymentFormMounting = false;
  }
}

// Handle Stripe payment processing during order placement
async function handleStripePayment(cartId) {
  // Clear any previous errors
  clearStripeError();

  const resolvedCartId = getActiveCartId(cartId);

  if (!resolvedCartId) {
    displayStripeError(
      'Cart ID is unavailable. Please refresh checkout and try again.',
    );
    return false;
  }

  if (!validateStripePayment()) {
    displayStripeError('Please complete your payment details');
    return false;
  }

  if (!stripe || !elements) {
    displayStripeError(
      'Stripe payment is not properly initialized. Please refresh and try again.',
    );
    return false;
  }

  try {
    const { error: submitError } = await elements.submit();
    if (submitError) {
      displayStripeError(submitError.message || 'Please complete your payment details');
      return false;
    }
  } catch (elemSubmitError) {
    const errorMessage = elemSubmitError?.message || 'Unknown error submitting payment form';
    displayStripeError(errorMessage);
    return false;
  }

  if (!pendingClientSecret) {
    try {
      const paymentIntentData = await startPayment(cartData, checkoutData);
      pendingClientSecret = paymentIntentData?.client_secret || null;
      pendingReturnUrl = paymentIntentData?.return_url || null;
    } catch (paymentSessionError) {
      displayStripeError(
        paymentSessionError.message || 'Unable to create Stripe session.',
      );
      return false;
    }
  }

  if (!pendingClientSecret) {
    displayStripeError('Unable to create payment session. Please try again.');
    return false;
  }

  const clientSecret = pendingClientSecret;
  const didPersistPaymentMethod = await persistStripePaymentMethod(clientSecret);
  if (!didPersistPaymentMethod) {
    displayStripeError('Failed to set the payment method.');
    return false;
  }

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    redirect: 'if_required',
    clientSecret,
    confirmParams: {
      ...(pendingReturnUrl ? { return_url: pendingReturnUrl } : {}),
      payment_method_data: {
        billing_details: removeEmptyStripeValues(getCurrentBillingDetails()),
      },
    },
  });

  if (error) {
    displayStripeError(
      error.message || 'An error occurred during payment confirmation.',
    );
    return false;
  }

  return true;
}

// Render function for the Stripe payment method slot
function renderStripePaymentMethod(ctx) {
  resetMountedPaymentElement();

  const $content = document.createElement('div');
  $content.id = 'stripe-payment-form'; // Stripe form container

  // Ensure a child element exists for Stripe Elements
  const $stripeContainer = document.createElement('div');
  $stripeContainer.id = 'stripe-elements-container';
  $stripeContainer.classList.add('stripe-elements-loading');

  $content.appendChild($stripeContainer);
  ctx.replaceHTML($content);

  requestAnimationFrame(async () => {
    try {
      await loadStripeJs();
      checkoutData = events.lastPayload('checkout/updated')
        || events.lastPayload('checkout/initialized')
        || checkoutData;
      retryPaymentFormMount();
    } catch (error) {
      $stripeContainer.classList.remove('stripe-elements-loading');
      displayStripeError(
        'Unable to load payment form. Please refresh and try again.',
        'stripe-elements-container',
      );
      console.error('Failed to initialize Stripe payment form:', error);
    }
  });
}

// Initialize the Stripe SDK
function initializeStripePayment() {
  // Update billing details if stripe payment is already initialized
  if (paymentElement) {
    updateStripeBillingDetails();
  }

  // Load Stripe.js for payment processing
  loadStripeJs().catch((error) => {
    console.warn('Failed to load Stripe.js during initialization:', error);
  });
}

// Validate Stripe payment form - called by checkout validation
function validateStripePayment() {
  if (!paymentElement) {
    return true; // Not a Stripe payment, validation passes
  }

  if (!paymentFormComplete) {
    return false;
  }

  return true;
}

// Listen for checkout initialization to set up Stripe payment
events.on(
  'checkout/initialized',
  (data) => {
    checkoutData = data;
    if (!isStripePaymentMethodAvailable()) {
      return; // No Stripe payment method available, skip initialization
    }
    initializeStripePayment();
  },
  { eager: true },
);

// Listen for cart data
events.on(
  'cart/initialized',
  (data) => {
    cartData = data;
    retryPaymentFormMount();
  },
  { eager: true },
);

events.on(
  'cart/updated',
  (data) => {
    cartData = data;
    updateStripeCartTotal();
    retryPaymentFormMount();
  },
  { eager: true },
);

// Listen for checkout updates
events.on('checkout/updated', (data) => {
  checkoutData = data;
  if (!isStripePaymentMethodAvailable()) {
    return;
  }
  initializeStripePayment();
  retryPaymentFormMount();
});

function isStripePaymentMethodAvailable() {
  return checkoutData?.availablePaymentMethods.some(
    (method) => method.code === STRIPE_PAYMENT_METHOD_CODE,
  );
}

// Export the functions that need to be used by other blocks
export {
  renderStripePaymentMethod,
  handleStripePayment,
  validateStripePayment,
};

// Default export for block initialization (if used as a block)
export default function decorate(block) {

}
