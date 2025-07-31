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

// Store the loading promise to avoid multiple loading attempts
let stripeLoadingPromise = null;

// Global state
let checkoutData = null;
let cartData = null;
let elements = null;
let paymentElement = null;
let stripe = null;
let paymentFormComplete = false;

// Helper to ensure Stripe.js is loaded
const loadStripeJs = () => {
  // If there's already a loading promise in progress, return it
  if (stripeLoadingPromise) {
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
    script.onload = () => {
      // Stripe.js loaded successfully
      resolve();
    };
    script.onerror = (error) => {
      // Failed to load Stripe.js
      stripeLoadingPromise = null; // Reset so we can try again next time
      reject(new Error('Failed to load Stripe.js'));
    };
    document.head.appendChild(script);
  });

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

// Function to create a payment session with the OOPE payment gateway (Stripe)
async function createPaymentIntent(endpoint, request) {
  return (
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
  ).json();
}

// Function to start payment flow when an OOPE method is selected
async function startPayment(cartDataParam, checkoutDataParam) {
  // Locate the Stripe payment method
  const stripePaymentMethod = checkoutDataParam.availablePaymentMethods.find(
    (method) => method.code === STRIPE_PAYMENT_METHOD_CODE,
  );

  if (!stripePaymentMethod || !stripePaymentMethod.oope_payment_method_config) {
    console.error('Stripe payment method configuration is missing.');
    throw new Error('Stripe payment method is not available.');
  }

  // eslint-disable-next-line max-len
  const paymentConfig = JSON.parse(stripePaymentMethod.oope_payment_method_config.backend_integration_url);

  if (!paymentConfig.createPaymentIntentUrl) {
    console.error('createPaymentIntent URL is missing in the configuration.');
    throw new Error('Stripe payment configuration is invalid.');
  }

  const runtimeCreatePaymentIntentUrl = paymentConfig.createPaymentIntentUrl;
  const cartId = cartDataParam?.id;
  const cartFullName = `${checkoutDataParam?.billingAddress?.firstName || ''} ${checkoutDataParam?.billingAddress?.lastName || ''}`.trim();

  const requestBody = {
    cartId,
    cartFullName,
  };

  const beginCreatePaymentIntent = await createPaymentIntent(
    runtimeCreatePaymentIntentUrl,
    requestBody,
  );

  if (!beginCreatePaymentIntent || !beginCreatePaymentIntent.client_secret) {
    displayStripeError('Payment error: Unable to create Stripe session.');
    return { client_secret: null };
  }
  return {
    client_secret: beginCreatePaymentIntent.client_secret,
  };
}

function getCurrentBillingDetails() {
  const billingAddress = checkoutData?.billingAddress || {};

  return {
    name: `${billingAddress?.firstName || ''} ${billingAddress?.lastName || ''}`.trim(),
    email: checkoutData?.email || '',
    phone: billingAddress?.telephone || '',
    address: {
      line1: billingAddress?.street?.[0] || '',
      line2: billingAddress?.street?.[1] || '',
      city: billingAddress?.city || '',
      state: billingAddress?.region?.code || '',
      country: billingAddress?.country?.value || '',
      postal_code: billingAddress?.postCode || '',
    },
  };
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

async function mountPaymentForm(mountId) {
  let initParams;

  try {
    // Ensure Stripe.js is loaded before continuing
    await loadStripeJs();

    // Retrieve Stripe config dynamically
    const stripePaymentMethod = checkoutData.availablePaymentMethods.find(
      (method) => method.code === STRIPE_PAYMENT_METHOD_CODE,
    );

    if (!stripePaymentMethod || !stripePaymentMethod.oope_payment_method_config) {
      console.error('Stripe payment method configuration is missing.');
      throw new Error('Stripe payment method is not available.');
    }
    // Parse the JSON config to get URLs
    // eslint-disable-next-line max-len
    const paymentConfig = JSON.parse(stripePaymentMethod.oope_payment_method_config.backend_integration_url);

    if (!paymentConfig.getInitParamsUrl) {
      console.error('getInitParamsUrl is missing in the configuration.');
      throw new Error('Stripe init params URL is invalid.');
    }

    // Fetch the Stripe Init Params
    const stripeInitParams = await fetch(paymentConfig.getInitParamsUrl);

    if (!stripeInitParams.ok) {
      throw new Error(`Failed to load Stripe init params: ${stripeInitParams.statusText}`);
    }

    initParams = await stripeInitParams.json();
  } catch (error) {
    console.error('Error fetching Stripe key:', error);
    // Display the error using our helper function
    const mountIdWithoutHash = mountId.startsWith('#') ? mountId.substring(1) : mountId;
    displayStripeError('Unable to load payment form. Please refresh and try again.', mountIdWithoutHash);
    return;
  }

  try {
    stripe = Stripe(initParams.publishableKey, initParams.options);
    stripe.registerAppInfo(initParams.appInfo);
    const cartTotal = Math.round(Number(cartData?.total?.includingTax?.value) * 100);
    const cartCurrency = cartData?.total?.includingTax?.currency?.toLowerCase();

    // Dynamically set billing details from checkoutData
    const billingAddress = checkoutData?.billingAddress || {};
    const shippingAddress = checkoutData?.shippingAddress || {};
    const isSameAsShipping = checkoutData?.isBillingSameAsShipping;

    const selectedBillingAddress = isSameAsShipping ? shippingAddress : billingAddress;

    // Construct billing details for Stripe
    const billingDetails = getCurrentBillingDetails;

    // Initialize Stripe elements with billing details
    elements = stripe.elements({
      mode: 'payment',
      amount: cartTotal,
      currency: cartCurrency,
      paymentMethodTypes: ['card', 'link']
    });

    // Make sure the loading container is removed before mounting
    const container = document.querySelector(mountId);
    if (container && container.closest('.stripe-elements-loading')) {
      container.closest('.stripe-elements-loading').classList.remove('stripe-elements-loading');
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
  } catch (error) {
    console.error('Error initializing Stripe payment form:', error);
    // Display the error using our helper function
    const mountIdWithoutHash = mountId.startsWith('#') ? mountId.substring(1) : mountId;
    displayStripeError('Unable to initialize payment form. Please refresh and try again.', mountIdWithoutHash);
  }
}

// Handle Stripe payment processing during order placement
async function handleStripePayment(cartId) {
  // Clear any previous errors
  clearStripeError();

  if (!validateStripePayment()) {
    displayStripeError('Please complete your payment details');
    return false;
  }

  if (!stripe || !elements) {
    displayStripeError('Stripe payment is not properly initialized. Please refresh and try again.');
    return false;
  }

  try {
    await elements.submit();
  } catch (elemSubmitError) {
    const errorMessage = elemSubmitError?.message || 'Unknown error submitting payment form';
    displayStripeError(errorMessage);
    return false;
  }

  const paymentIntentData = await startPayment(cartData, checkoutData);
  if (!paymentIntentData?.client_secret) {
    displayStripeError('Unable to create payment session. Please try again.');
    return false;
  }

  const clientSecret = paymentIntentData.client_secret;

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    redirect: 'if_required', // Avoid unnecessary redirects
    clientSecret, // The client secret from backend
    confirmParams: {
      payment_method_data: {
        billing_details: getCurrentBillingDetails(),
      },
    },
  });

  if (error) {
    displayStripeError(error.message || 'An error occurred during payment confirmation.');
    return false;
  }

  // Set Payment Method in Adobe Commerce
  const paymentMethodResponse = await checkoutApi.setPaymentMethod({
    code: STRIPE_PAYMENT_METHOD_CODE,
    additional_data: [
      { key: 'client_secret', value: clientSecret },
    ],
  });

  if (!paymentMethodResponse) {
    displayStripeError('Failed to set the payment method.');
    return false;
  }

  return true;
}

// Render function for the Stripe payment method slot
function renderStripePaymentMethod(ctx) {
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

      events.on('checkout/initialized', (data) => {
        checkoutData = data;
        mountPaymentForm('#stripe-elements-container');
      }, { eager: true });
    } catch (error) {
      $stripeContainer.classList.remove('stripe-elements-loading');
      displayStripeError('Unable to load payment form. Please refresh and try again.', 'stripe-elements-container');
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

// Listen for checkout initialization to set up Stripe payment
events.on('checkout/initialized', (data) => {
  checkoutData = data;
  if (!isStripePaymentMethodAvailable()) {
    return; // No Stripe payment method available, skip initialization
  }
  initializeStripePayment();
}, { eager: true });

// Listen for cart data
events.on('cart/initialized', (data) => {
  cartData = data;
}, { eager: true });

// Listen for checkout updates
events.on('checkout/updated', (data) => {
  checkoutData = data;
  if (!isStripePaymentMethodAvailable()) {
    return;
  }
  initializeStripePayment();
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

// Default export for block initialization (if used as a block)
export default function decorate(block) {

}
