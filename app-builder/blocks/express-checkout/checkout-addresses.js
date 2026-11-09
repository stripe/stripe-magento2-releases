import * as checkoutApi from '@dropins/storefront-checkout/api.js';

const CUSTOMER_ADDRESSES = `query CheckoutCustomerAddresses {
  customer {
    addresses {
      id
      firstname
      middlename
      lastname
      prefix
      suffix
      company
      street
      city
      country_code
      region { region region_code region_id }
      postcode
      telephone
      fax
      vat_id
      custom_attributesV2 { ... on AttributeValue { code value } }
    }
  }
}`;

const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Compare customer GraphQL addresses with the Checkout Drop-in cart model. */
function addressKey(address) {
  const region = address.region || {};
  const attributes = address.customAttributes || address.custom_attributesV2 || [];
  return JSON.stringify([
    address.firstName ?? address.firstname,
    address.middleName ?? address.middlename,
    address.lastName ?? address.lastname,
    address.prefix,
    address.suffix,
    address.company,
    address.city,
    address.country?.code ?? address.country_code,
    region.code || region.region_code || region.name || region.region,
    address.postCode ?? address.postcode,
    address.telephone,
    address.fax,
    address.vatId ?? address.vat_id,
  ].map(normalize).concat([
    (address.street || []).map(normalize).filter(Boolean),
    attributes.map(({ code, value }) => [code, String(value ?? '')])
      .sort(([left], [right]) => left.localeCompare(right)),
  ]));
}

/**
 * Reuse matching saved addresses before payment/order submission. Unmatched
 * cart addresses retain the shopper's existing save-in-address-book choice.
 * Lookup/mutation failures propagate to stop submission when verification fails.
 * @param {Object} cart Current Checkout Drop-in cart.
 */
export async function reuseCustomerAddresses(cart) {
  if (!cart) throw new Error('Unable to verify checkout addresses. Please try again.');
  if (cart.isGuest !== false) return;

  const shipping = cart.isVirtual ? null : cart.shippingAddresses?.[0] || cart.shippingAddress;
  const billing = cart.billingAddress;
  const isNewAddress = (address) => address && !address.id;
  if (![shipping, billing].some(isNewAddress)) return;

  const response = await checkoutApi.fetchGraphQl(CUSTOMER_ADDRESSES, {
    method: 'GET',
    cache: 'no-cache',
  });
  if (response.errors?.length || !Array.isArray(response.data?.customer?.addresses)) {
    throw new Error('Unable to verify saved addresses. Please try again.');
  }
  const savedAddresses = response.data.customer.addresses.filter((address) => address?.id);
  const findSavedAddress = (address) => {
    if (!isNewAddress(address)) return undefined;
    const key = addressKey(address);
    return savedAddresses.find((saved) => addressKey(saved) === key);
  };
  const savedShipping = findSavedAddress(shipping);
  const savedBilling = findSavedAddress(billing);

  // Shipping may also set billing when Bill to shipping is checked. Keep the
  // updates sequential and compare against the original selected addresses.
  if (savedShipping) {
    await checkoutApi.setShippingAddress({ customerAddressId: savedShipping.id });
  }
  if (savedBilling) {
    await checkoutApi.setBillingAddress({ customerAddressId: savedBilling.id });
  }
}
