/** Amazon-specific configuration stays outside the shared confirmation flow. */
const AMAZON_PAY = Object.freeze({
  containerId: 'stripe-express-checkout-amazon',
  otherMethodsDisabled: Object.freeze({
    applePay: 'never',
    googlePay: 'never',
    link: 'never',
    paypal: 'never',
    klarna: 'never',
  }),
});

/** Payment-only wallets must not inherit Amazon's shipping collection policy. */
export const AMAZON_PAY_DISABLED = Object.freeze({
  amazonPay: 'never',
});

/**
 * Return the first nonempty trimmed address value in precedence order.
 * @param {...*} values Candidate address values in fallback order.
 * @returns {string}
 */
const readWalletValue = (...values) => {
  const normalized = values.map((value) => String(value || '').trim()).find(Boolean);
  return normalized || '';
};

/**
 * Normalize Stripe fields and legacy Amazon aliases without changing precedence.
 * An empty first street line keeps the second-line fallback.
 * @param {Object} source Source cart or wallet model.
 * @returns {Object|null}
 */
function normalizeAmazonPayAddress(source) {
  if (!source) {
    return null;
  }
  const nested = source.address && typeof source.address === 'object' ? source.address : null;
  const streetLine1 = readWalletValue(
    nested?.line1,
    nested?.addressLine1,
    source.line1,
    source.addressLine1,
  );
  const streetLine2 = readWalletValue(
    nested?.line2,
    nested?.addressLine2,
    source.line2,
    source.addressLine2,
  );
  const address = {
    line1: streetLine1 || streetLine2,
    line2: streetLine1 ? streetLine2 || undefined : undefined,
    city: readWalletValue(nested?.city, source.city),
    state:
      readWalletValue(
        nested?.state,
        nested?.stateOrRegion,
        source.state,
        source.stateOrRegion,
      ) || undefined,
    country: readWalletValue(
      nested?.country,
      nested?.countryCode,
      source.country,
      source.countryCode,
    ),
    postal_code: readWalletValue(
      nested?.postal_code,
      nested?.postalCode,
      source.postal_code,
      source.postalCode,
    ),
  };
  const name = readWalletValue(source.name, nested?.name);
  const phone = readWalletValue(
    source.phone,
    source.phoneNumber,
    nested?.phone,
    nested?.phoneNumber,
  ) || undefined;
  if (
    !name
    && !address.line1
    && !address.city
    && !address.country
    && !address.postal_code
  ) {
    return null;
  }
  return {
    name,
    phone,
    address,
  };
}

/**
 * Create the Amazon descriptor, retaining shipping collection for physical carts.
 * This policy preserves the onInit callback workaround.
 * @returns {import('./wallets.js').WalletDescriptor} Unmounted Amazon wallet.
 */
export function createAmazonPayWallet() {
  return {
    containerId: AMAZON_PAY.containerId,
    containerClassName: AMAZON_PAY.containerId,
    collectsShipping: true,
    isEnabled: (virtualCart) => !virtualCart,
    getOptions: (fields, shippingRates) => ({
      ...fields,
      shippingAddressRequired: true,
      shippingRates,
      paymentMethods: AMAZON_PAY.otherMethodsDisabled,
    }),
    container: null,
    element: null,
    elements: null,
    available: false,
  };
}

export { normalizeAmazonPayAddress };
