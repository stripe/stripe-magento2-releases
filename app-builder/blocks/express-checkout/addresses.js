import { state } from './checkout-state.js';
import { normalizeAmazonPayAddress } from './amazon-pay.js';
import { MESSAGES } from './constants.js';

/**
 * Read shipping from supported Commerce cart model shapes.
 * @returns {Object|null}
 */
function getCheckoutShippingAddress() {
  return (
    state.checkoutData?.shippingAddress
    || state.checkoutData?.shippingAddresses?.[0]
    || state.checkoutData?.shipping_address
    || state.checkoutData?.shipping_addresses?.[0]
    || null
  );
}

/**
 * Read billing from supported Commerce cart model shapes.
 * @returns {Object|null}
 */
function getCheckoutBillingAddress() {
  return (
    state.checkoutData?.billingAddress || state.checkoutData?.billing_address || null
  );
}

/**
 * Resolve a Commerce region code or its label fallback.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {string}
 */
function getAddressRegion(address) {
  return (
    address?.region?.code
    || address?.region?.label
    || (typeof address?.region === 'string' ? address.region : '')
    || address?.regionCode
    || address?.region_code
    || ''
  );
}

/**
 * Resolve the country code from a Commerce address.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {string}
 */
function getAddressCountry(address) {
  return (
    address?.country?.code
    || address?.country?.value
    || address?.countryCode
    || address?.country_code
    || ''
  );
}

/**
 * Read the postcode from supported Commerce field names.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {string}
 */
function getAddressPostcode(address) {
  return address?.postCode || address?.postcode || address?.postal_code || '';
}

/**
 * Read the street lines without changing their order.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {string[]}
 */
function getAddressStreet(address) {
  if (Array.isArray(address?.street)) {
    return address.street;
  }
  return [address?.line1, address?.line2].filter(Boolean);
}

/**
 * Check the required name and address fields used by this integration.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @returns {boolean}
 */
function isCompleteCommerceAddress(address) {
  const street = getAddressStreet(address);
  return Boolean(
    (address?.firstName || address?.firstname)
      && (address?.lastName || address?.lastname)
      && street[0]
      && address?.city
      && getAddressCountry(address)
      && getAddressPostcode(address),
  );
}

/**
 * Read the shipping method selected on the Commerce address.
 * @param {Object} [address] Address in the supported Commerce or wallet format.
 * @returns {Object|null}
 */
function getSelectedShippingMethod(address = getCheckoutShippingAddress()) {
  return address?.selectedShippingMethod || address?.selected_shipping_method || null;
}

/**
 * Check whether either cart model identifies a virtual cart.
 * @returns {boolean}
 */
function isVirtualCart() {
  return Boolean(state.checkoutData?.isVirtual || state.cartData?.isVirtual);
}

/**
 * Read the shipping phone, falling back to the billing phone.
 * @returns {string}
 */
function getCheckoutPhone() {
  return (
    getCheckoutShippingAddress()?.telephone
    || getCheckoutBillingAddress()?.telephone
    || ''
  );
}

/**
 * Check the shipping-address and delivery-method confirmation gate.
 * @returns {boolean}
 */
function hasRequiredMagentoShipping() {
  return (
    isVirtualCart()
    || (isCompleteCommerceAddress(getCheckoutShippingAddress())
      && Boolean(getSelectedShippingMethod()))
  );
}

/**
 * Accept complete billing or the bill-to-shipping fallback.
 * @returns {boolean}
 */
function isCompleteBillingAddress() {
  return (
    isCompleteCommerceAddress(getCheckoutBillingAddress())
    || isCompleteCommerceAddress(getCheckoutShippingAddress())
  );
}

/**
 * Split a full name into the first and remaining names required by Commerce.
 * @param {string} name Customer full name.
 * @returns {Object|null}
 */
function splitCustomerName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return {
    firstName: parts.shift(),
    lastName: parts.join(' '),
  };
}

/**
 * Resolve the cart customer name using billing before shipping.
 * @returns {string}
 */
function getCommerceCustomerName() {
  const billingAddress = getCheckoutBillingAddress();
  const shippingAddress = getCheckoutShippingAddress();
  const firstName = billingAddress?.firstName
    || billingAddress?.firstname
    || shippingAddress?.firstName
    || shippingAddress?.firstname
    || '';
  const lastName = billingAddress?.lastName
    || billingAddress?.lastname
    || shippingAddress?.lastName
    || shippingAddress?.lastname
    || '';
  return `${firstName} ${lastName}`.trim();
}

/**
 * Normalize wallet address payloads through the compatibility adapter.
 * @param {Object} source Source cart or wallet model.
 * @returns {Object|null}
 */
function toWalletAddress(source) {
  return normalizeAmazonPayAddress(source);
}

/**
 * Check the full wallet address fields required before Commerce persistence.
 * @param {Object} walletAddress Wallet address with contact and nested address fields.
 * @returns {boolean}
 */
function isCompleteWalletAddress(walletAddress) {
  const address = walletAddress?.address;
  return Boolean(
    walletAddress?.name
      && address?.line1
      && address?.city
      && address?.country
      && address?.postal_code,
  );
}

/**
 * Select the first complete address from the supplied wallet candidates.
 * @param {...Object} wallets Wallet address candidates in fallback order.
 * @returns {Object|null}
 */
const firstCompleteWallet = (...wallets) => wallets
  .find((wallet) => isCompleteWalletAddress(wallet)) || null;

/**
 * Check whether confirmation still needs a wallet address fallback.
 * @returns {boolean}
 */
function cartNeedsWalletAddresses() {
  return (
    (state.walletShippingRequired
      && !isCompleteCommerceAddress(getCheckoutShippingAddress()))
    || !isCompleteBillingAddress()
  );
}

/**
 * Convert a complete normalized wallet address into Commerce mutation input.
 * @param {Object} walletAddress Wallet address with contact and nested address fields.
 * @param {string} phone Optional phone override.
 * @returns {Object}
 */
function toCommerceAddress(walletAddress, phone) {
  const normalized = toWalletAddress(walletAddress);
  const name = splitCustomerName(normalized?.name);
  if (!name || !isCompleteWalletAddress(normalized)) {
    throw new Error(MESSAGES.WALLET_ADDRESS_INCOMPLETE);
  }
  const { address } = normalized;
  const telephone = phone || normalized.phone;
  return {
    firstName: name.firstName,
    lastName: name.lastName,
    street: [address.line1, address.line2].filter(Boolean),
    city: address.city,
    countryCode: address.country,
    postcode: address.postal_code,
    // Commerce defaults this to true. Wallet details are for this order;
    // saving them again would duplicate customer addresses at order placement.
    saveInAddressBook: false,
    ...(address.state
      ? {
        region: address.state,
      }
      : {}),
    ...(telephone
      ? {
        telephone,
      }
      : {}),
  };
}

/**
 * Include wallet billing contact details and only a complete billing address.
 * @param {Object} billingDetails Billing details supplied by the wallet.
 * @returns {Object|null}
 */
function toStripeBillingDetails(billingDetails) {
  if (!billingDetails) {
    return null;
  }
  const billingWallet = toWalletAddress(billingDetails);
  return {
    name: billingDetails.name,
    email: billingDetails.email,
    phone: billingDetails.phone,
    ...(isCompleteWalletAddress(billingWallet)
      ? {
        address: billingWallet.address,
      }
      : {}),
  };
}

/**
 * Convert complete wallet shipping into Confirmation Token parameters.
 * @param {Object} shippingAddress Shipping details supplied by the wallet.
 * @param {string} phone Optional phone override.
 * @returns {Object|null}
 */
function toStripeShippingDetails(shippingAddress, phone) {
  const walletAddress = toWalletAddress(shippingAddress);
  if (!isCompleteWalletAddress(walletAddress)) {
    return null;
  }
  return {
    name: walletAddress.name,
    phone: phone || walletAddress.phone || null,
    address: walletAddress.address,
  };
}

/**
 * Convert the checkout shipping address into Confirmation Token parameters.
 * @param {Object} address Address in the supported Commerce or wallet format.
 * @param {string} phone Optional phone override.
 * @returns {Object|null}
 */
function toStripeShippingDetailsFromCommerce(address, phone) {
  if (!isCompleteCommerceAddress(address)) {
    return null;
  }
  const street = getAddressStreet(address).filter(Boolean);
  const firstName = address.firstName || address.firstname || '';
  const lastName = address.lastName || address.lastname || '';
  const region = getAddressRegion(address);
  return {
    name: `${firstName} ${lastName}`.trim(),
    phone: phone || address.telephone || null,
    address: {
      line1: street[0],
      ...(street[1]
        ? {
          line2: street[1],
        }
        : {}),
      city: address.city,
      ...(region
        ? {
          state: region,
        }
        : {}),
      country: getAddressCountry(address),
      postal_code: getAddressPostcode(address),
    },
  };
}

export {
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
  getCommerceCustomerName,
  isCompleteBillingAddress,
  getCheckoutPhone,
  toStripeBillingDetails,
  toStripeShippingDetails,
  toStripeShippingDetailsFromCommerce,
  cartNeedsWalletAddresses,
};
