/* eslint-env node, jest */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;

/**
 * Loads the express-checkout module graph in a VM context with mocked
 * Drop-in APIs so shipping.js handlers can be exercised directly.
 */
function loadShippingModule() {
  const handlers = new Map();
  const events = {
    on: jest.fn((eventName, handler) => {
      handlers.set(eventName, [...(handlers.get(eventName) || []), handler]);
    }),
    lastPayload: jest.fn(),
    emit: async (eventName, payload) => {
      await Promise.all((handlers.get(eventName) || []).map((handler) => handler(payload)));
    },
  };

  const mocks = {
    cartApi: {
      getStoreConfig: jest.fn().mockResolvedValue({
        shoppingCartDisplaySetting: { subtotal: 'EXCLUDING_TAX', shipping: 'EXCLUDING_TAX' },
      }),
      refreshCart: jest.fn().mockResolvedValue(null),
    },
    checkoutApi: {
      setPaymentMethod: jest.fn().mockResolvedValue(null),
      setShippingAddress: jest.fn().mockResolvedValue(null),
      estimateShippingMethods: jest.fn().mockResolvedValue([
        {
          carrier: { code: 'flatrate', title: 'Flat Rate' },
          code: 'flatrate',
          title: 'Fixed',
          amount: { value: 5, currency: 'USD' },
        },
      ]),
      setShippingMethods: jest.fn().mockResolvedValue(null),
      setGuestEmailOnCart: jest.fn().mockResolvedValue(undefined),
      setBillingAddress: jest.fn().mockResolvedValue(null),
      getCart: jest.fn().mockResolvedValue(null),
    },
    orderApi: { placeOrder: jest.fn().mockResolvedValue(null) },
    loadCSS: jest.fn(),
  };

  const context = {
    console: { warn: jest.fn(), error: jest.fn() },
    document: { createElement: () => ({ classList: { add: jest.fn(), remove: jest.fn() } }) },
    fetch: jest.fn(),
    AbortController,
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Stripe: jest.fn(),
    window: {
      location: { search: '' },
      localStorage: { getItem: jest.fn(() => 'default'), setItem: jest.fn() },
      sessionStorage: { getItem: jest.fn(), setItem: jest.fn() },
      setTimeout,
      clearTimeout,
    },
    __mocks: { events, ...mocks },
  };
  vm.createContext(context);

  const externals = {
    '@dropins/tools/event-bus.js': { events },
    '@dropins/storefront-cart/api.js': mocks.cartApi,
    '@dropins/storefront-checkout/api.js': mocks.checkoutApi,
    '@dropins/storefront-order/api.js': mocks.orderApi,
    '@dropins/tools/components.js': { Icon: jest.fn(), InLineAlert: jest.fn(), provider: { render: jest.fn() } },
    '@dropins/tools/preact.js': { h: jest.fn() },
    '../../scripts/aem.js': { loadCSS: mocks.loadCSS },
  };

  const transform = (source) => {
    const namedExports = [];
    const transformed = source
      .replace(
        /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g,
        (_match, bindings, specifier) => {
          const binding = bindings.trim();
          const declaration = binding.startsWith('* as ') ? binding.slice(5) : binding.replace(/\bas\b/g, ':');
          return `const ${declaration} = __require('${specifier}');`;
        },
      )
      .replace(/export default (function|const) (\w+)/g, (_m, kind, name) => `${kind} ${name}`)
      .replace(/export (const|function|async function) (\w+)/g, (_m, kind, name) => {
        namedExports.push(name);
        return `${kind} ${name}`;
      })
      .replace(/export \{([\s\S]*?)\};?/g, (_m, names) => {
        const list = names.split(',').map((name) => name.trim()).filter(Boolean);
        return `Object.assign(module.exports, { ${list.join(', ')} });`;
      });
    return `${transformed}\nObject.assign(module.exports, { ${namedExports.join(', ')} });`;
  };

  const cache = new Map();
  const load = (filename) => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = transform(fs.readFileSync(filename, 'utf8'));
    new vm.Script(`(function(__require, module) { ${source}\n})`, { filename })
      .runInContext(context)((specifier) => {
        if (externals[specifier]) return externals[specifier];
        if (!specifier.startsWith('./')) throw new Error(`Unexpected module: ${specifier}`);
        return load(path.resolve(path.dirname(filename), specifier));
      }, module);
    return module.exports;
  };

  const { state } = load(path.join(DIR, 'checkout-state.js'));
  state.currentCurrency = 'usd';
  return {
    state,
    shipping: load(path.join(DIR, 'shipping.js')),
    mocks,
    events,
  };
}

const michiganAddress = {
  firstName: 'Ionut',
  lastName: 'Rusu',
  telephone: '0743496556',
  street: ['Strada 22 Decembrie 199', ''],
  city: 'Suceava',
  region: { code: 'MI', label: 'Michigan' },
  country: { code: 'US' },
  postcode: 'SW1A 2AA',
};

function michiganShippingMethod() {
  return {
    carrier: { code: 'flatrate', title: 'Flat Rate' },
    code: 'flatrate',
    title: 'Fixed',
    amount: { value: 5, currency: 'USD' },
    amountExclTax: { value: 5, currency: 'USD' },
    amountInclTax: { value: 5, currency: 'USD' },
  };
}

function ownedCheckout(overrides = {}) {
  return {
    email: 'irusu-c@stripe.com',
    isGuest: true,
    availablePaymentMethods: [{ code: 'oope_stripe', title: 'Stripe Payment Method' }],
    billingAddress: michiganAddress,
    shippingAddress: {
      ...michiganAddress,
      selectedShippingMethod: michiganShippingMethod(),
      availableShippingMethods: [michiganShippingMethod()],
    },
    ...overrides,
  };
}

describe('express-checkout shipping ownership', () => {
  test.each([false, true])('preserves owned shipping even with a previous wallet persist: %s', async (previousPersist) => {
    const ctx = loadShippingModule();
    ctx.state.walletShippingAddressPersisted = previousPersist;
    ctx.state.checkoutData = ownedCheckout();
    ctx.state.cartData = {
      id: 'cart_123',
      total: { includingTax: { value: 53.71, currency: 'USD' } },
      subtotal: { includingTax: { value: 48.71, currency: 'USD' } },
    };

    const event = {
      name: 'Amazon Customer',
      address: { country: 'GB', postal_code: 'SW1A 2AA' },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await ctx.shipping.handleShippingAddressChange(event);

    expect(ctx.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(ctx.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
    expect(ctx.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(ctx.mocks.cartApi.refreshCart).not.toHaveBeenCalled();
    expect(event.reject).not.toHaveBeenCalled();
    expect(event.resolve).toHaveBeenCalledWith({
      shippingRates: [
        { id: 'flatrate:flatrate', displayName: 'Flat Rate - Fixed', amount: 500 },
      ],
      lineItems: [{ name: 'Grand Total', amount: 5371 }],
    });
  });

  test('still estimates with the wallet address when Magento has no shipping yet', async () => {
    const ctx = loadShippingModule();
    ctx.state.checkoutData = ownedCheckout({
      email: '',
      billingAddress: null,
      shippingAddress: null,
    });
    ctx.state.cartData = {
      id: 'cart_123',
      total: { includingTax: { value: 42, currency: 'USD' } },
    };

    const event = {
      name: '',
      address: { country: 'GB', postal_code: 'SW1A' },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await ctx.shipping.handleShippingAddressChange(event);

    expect(ctx.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(ctx.mocks.checkoutApi.estimateShippingMethods).toHaveBeenCalledWith({
      criteria: { country_code: 'GB', zip: 'SW1A' },
    });
    expect(event.reject).not.toHaveBeenCalled();
    expect(event.resolve).toHaveBeenCalled();
  });

  test.each([true, false])('persists wallet shipping only on the cart (isGuest: %s)', async (isGuest) => {
    const ctx = loadShippingModule();
    ctx.state.checkoutData = ownedCheckout({
      isGuest,
      email: '',
      billingAddress: null,
      shippingAddress: null,
    });
    ctx.state.cartData = {
      id: 'cart_123',
      total: { includingTax: { value: 42, currency: 'USD' } },
    };
    ctx.mocks.checkoutApi.setShippingAddress.mockResolvedValue({
      shippingAddress: {
        ...michiganAddress,
        availableShippingMethods: [michiganShippingMethod()],
      },
    });

    const event = {
      name: 'Ionut Rusu',
      address: {
        line1: '1 Algorithm Way', city: 'London', country: 'GB', postal_code: 'SW1A 1AA',
      },
      phone: '020 7946 0000',
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await ctx.shipping.handleShippingAddressChange(event);

    expect(ctx.mocks.checkoutApi.setShippingAddress).toHaveBeenCalledWith({
      address: expect.objectContaining({
        street: ['1 Algorithm Way'],
        saveInAddressBook: false,
      }),
    });
    expect(ctx.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
    expect(ctx.mocks.checkoutApi.setShippingMethods).toHaveBeenCalled();
    expect(event.reject).not.toHaveBeenCalled();
    expect(event.resolve).toHaveBeenCalled();
  });
});
