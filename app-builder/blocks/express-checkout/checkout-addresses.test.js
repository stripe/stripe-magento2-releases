/* eslint-env node, jest */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const savedAddress = {
  id: 42,
  firstname: 'Ada',
  lastname: 'Lovelace',
  street: ['1 Algorithm Way', 'Apartment 2'],
  city: 'London',
  country_code: 'GB',
  region: { region: 'London', region_code: 'LND', region_id: 1 },
  postcode: 'SW1A 1AA',
  telephone: '020 7946 0000',
};

const cartAddress = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  street: ['1 Algorithm Way', 'Apartment 2'],
  city: 'London',
  country: { code: 'GB' },
  region: { code: 'LND', name: 'London', id: 1 },
  postCode: 'SW1A 1AA',
  telephone: '020 7946 0000',
};

function setup(addresses = [savedAddress]) {
  const checkoutApi = {
    fetchGraphQl: jest.fn().mockResolvedValue({ data: { customer: { addresses } } }),
    setShippingAddress: jest.fn().mockResolvedValue({}),
    setBillingAddress: jest.fn().mockResolvedValue({}),
  };
  const source = fs.readFileSync(path.join(__dirname, 'checkout-addresses.js'), 'utf8')
    .replace("import * as checkoutApi from '@dropins/storefront-checkout/api.js';", '')
    .replace('export async function', 'async function');
  const context = vm.createContext({ checkoutApi });
  vm.runInContext(source, context);
  return { checkoutApi, reuse: context.reuseCustomerAddresses };
}

describe('reuse customer addresses before order placement', () => {
  test.each([true, false])('reuses a saved address for shipping and separate billing (save: %s)', async (saveInAddressBook) => {
    const { reuse, checkoutApi } = setup();
    const address = { ...cartAddress, saveInAddressBook };
    await reuse({ isGuest: false, shippingAddresses: [address], billingAddress: address });

    expect(checkoutApi.fetchGraphQl).toHaveBeenCalledTimes(1);
    expect(checkoutApi.setShippingAddress).toHaveBeenCalledWith({ customerAddressId: 42 });
    expect(checkoutApi.setBillingAddress).toHaveBeenCalledWith({ customerAddressId: 42 });
    expect(checkoutApi.setShippingAddress.mock.invocationCallOrder[0]).toBeLessThan(
      checkoutApi.setBillingAddress.mock.invocationCallOrder[0],
    );
    expect(address.saveInAddressBook).toBe(saveInAddressBook);
  });

  test.each([true, false])('preserves the save choice for genuinely new addresses (save: %s)', async (saveInAddressBook) => {
    const { reuse, checkoutApi } = setup();
    const address = { ...cartAddress, street: ['99 New Road'], saveInAddressBook };
    await reuse({ isGuest: false, shippingAddresses: [address], billingAddress: address });
    expect(checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(checkoutApi.setBillingAddress).not.toHaveBeenCalled();
    expect(address.saveInAddressBook).toBe(saveInAddressBook);
  });

  test.each([
    { street: ['1 Algorithm Way', 'Apartment 3'] },
    { firstName: 'Grace' },
    { telephone: '020 7946 9999' },
    { company: 'Another company' },
    { vatId: 'GB1234' },
    { customAttributes: [{ code: 'delivery_note', value: 'Side door' }] },
  ])('does not substitute an address with different contact or delivery fields: %j', async (changes) => {
    const { reuse, checkoutApi } = setup();
    await reuse({ isGuest: false, billingAddress: { ...cartAddress, ...changes } });
    expect(checkoutApi.setBillingAddress).not.toHaveBeenCalled();
  });

  test('matches casing, surrounding whitespace, empty street lines and reordered custom fields', async () => {
    const { reuse, checkoutApi } = setup([{
      ...savedAddress,
      custom_attributesV2: [{ code: 'b', value: '2' }, { code: 'a', value: '1' }],
    }]);
    await reuse({
      isGuest: false,
      billingAddress: {
        ...cartAddress,
        firstName: ' ADA ',
        street: ['1 algorithm way ', 'Apartment 2', ''],
        customAttributes: [{ code: 'a', value: '1' }, { code: 'b', value: '2' }],
      },
    });
    expect(checkoutApi.setBillingAddress).toHaveBeenCalledWith({ customerAddressId: 42 });
  });

  test('skips guests and addresses already linked to the address book', async () => {
    const { reuse, checkoutApi } = setup();
    await reuse({ isGuest: true, billingAddress: cartAddress });
    await reuse({ isGuest: false, billingAddress: { ...cartAddress, id: 42 } });
    expect(checkoutApi.fetchGraphQl).not.toHaveBeenCalled();
    expect(checkoutApi.setBillingAddress).not.toHaveBeenCalled();
  });

  test('only checks billing for a virtual cart', async () => {
    const { reuse, checkoutApi } = setup();
    await reuse({
      isGuest: false,
      isVirtual: true,
      shippingAddresses: [cartAddress],
      billingAddress: cartAddress,
    });
    expect(checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(checkoutApi.setBillingAddress).toHaveBeenCalledWith({ customerAddressId: 42 });
  });

  test.each([
    { errors: [{ message: 'Unauthorized' }] },
    { data: { customer: null } },
  ])('blocks submission if the address book cannot be checked', async (response) => {
    const { reuse, checkoutApi } = setup();
    checkoutApi.fetchGraphQl.mockResolvedValue(response);
    await expect(reuse({ isGuest: false, billingAddress: cartAddress })).rejects.toThrow(
      'Unable to verify saved addresses',
    );
    expect(checkoutApi.setBillingAddress).not.toHaveBeenCalled();
  });

  test('propagates an address mutation failure to the order handler', async () => {
    const { reuse, checkoutApi } = setup();
    checkoutApi.setBillingAddress.mockRejectedValue(new Error('Address update failed'));
    await expect(reuse({ isGuest: false, billingAddress: cartAddress })).rejects.toThrow(
      'Address update failed',
    );
  });
});
