/* eslint-env node, jest */
/* eslint-disable no-await-in-loop */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STRIPE_BLOCK_PATH = process.env.EXPRESS_CHECKOUT_SOURCE
  || path.join(__dirname, 'stripe-express-checkout.js');

function flushPromises() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function waitForMount(block, expectedMounts = 1) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (block.expressCheckoutElement.mount.mock.calls.length >= expectedMounts) {
      return;
    }
    await flushPromises();
  }

  throw new Error(
    `Express Checkout Element did not mount (${block.expressCheckoutElement.mount.mock.calls.length}/${expectedMounts}).`,
  );
}

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: jest.fn((key) => values.get(key) || null),
    setItem: jest.fn((key, value) => {
      values.set(key, String(value));
    }),
    removeItem: jest.fn((key) => {
      values.delete(key);
    }),
  };
}

function createElement(tagName) {
  const element = {
    tagName,
    children: [],
    id: '',
    className: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    parentElement: null,
    attributes: {},
    scrollIntoView: jest.fn(),
    classList: {
      add: jest.fn((className) => {
        element.className = [element.className, className].filter(Boolean).join(' ');
      }),
      remove: jest.fn((className) => {
        element.className = element.className
          .split(' ')
          .filter((value) => value && value !== className)
          .join(' ');
      }),
      contains: jest.fn((className) => (element.className || '').split(' ').includes(className)),
      toggle: jest.fn((className, force) => {
        const tokens = (element.className || '').split(' ').filter(Boolean);
        const has = tokens.includes(className);
        const shouldHave = force === true || (force !== false && !has);
        element.className = shouldHave
          ? [...tokens.filter((token) => token !== className), className].join(' ')
          : tokens.filter((token) => token !== className).join(' ');
        return shouldHave;
      }),
    },
    appendChild: jest.fn((child) => {
      child.parentElement = element;
      element.children.push(child);
      return child;
    }),
    replaceChildren: jest.fn((...children) => {
      element.children.forEach((child) => {
        child.parentElement = null;
      });
      element.children = children;
      children.forEach((child) => {
        child.parentElement = element;
      });
    }),
    remove: jest.fn(() => {
      if (!element.parentElement) {
        return;
      }
      element.parentElement.children = element.parentElement.children.filter(
        (child) => child !== element,
      );
      element.parentElement = null;
    }),
    closest: jest.fn((selector) => {
      const className = selector.startsWith('.') ? selector.slice(1) : selector;
      let current = element;
      while (current) {
        if ((current.className || '').split(' ').includes(className)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }),
    querySelector: jest.fn((selector) => findElement(element, selector)),
    setAttribute: jest.fn((name, value) => {
      element.attributes[name] = String(value);
    }),
    removeAttribute: jest.fn((name) => {
      delete element.attributes[name];
    }),
    getAttribute: jest.fn((name) => element.attributes[name] || null),
    listeners: new Map(),
    addEventListener: jest.fn((eventName, handler) => {
      const handlers = element.listeners.get(eventName) || [];
      handlers.push(handler);
      element.listeners.set(eventName, handlers);
    }),
    dispatch: (eventName, payload) => Promise.all(
      (element.listeners.get(eventName) || []).map((handler) => handler(payload)),
    ),
  };

  return element;
}

function findElement(root, selector) {
  const isIdSelector = selector.startsWith('#');
  const selectorValue = selector.slice(1);
  const matches = (element) => {
    if (isIdSelector) {
      return element.id === selectorValue;
    }
    return (element.className || '').split(' ').includes(selectorValue);
  };

  const stack = [...root.children];
  while (stack.length > 0) {
    const element = stack.shift();
    if (matches(element)) {
      return element;
    }
    stack.push(...element.children);
  }

  return null;
}

function createDocument() {
  const body = createElement('body');
  const head = createElement('head');
  const checkoutRoot = createElement('div');
  checkoutRoot.className = 'commerce-checkout';
  body.appendChild(checkoutRoot);

  return {
    body,
    head,
    checkoutRoot,
    cookie: '',
    createElement: jest.fn(createElement),
    querySelector: jest.fn((selector) => findElement(body, selector)),
  };
}

/**
 * Load the block's small ES module graph in isolated VM contexts without a build.
 * Only module declarations are adapted; production function bodies stay intact.
 * @param {string} source ES module source.
 * @returns {string} Source using the test loader's module bindings.
 */
function transformStripeBlockSource(source) {
  const namedExports = [];
  let defaultExport;
  const transformed = source
    .replace(
      /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g,
      (_match, bindings, specifier) => {
        const binding = bindings.trim();
        const declaration = binding.startsWith('* as ')
          ? binding.slice(5)
          : binding.replace(/\bas\b/g, ':');
        return `const ${declaration} = __require('${specifier}');`;
      },
    )
    .replace(/export default function (\w+)/g, (_match, name) => {
      defaultExport = name;
      return `function ${name}`;
    })
    .replace(/export (const|function|async function) (\w+)/g, (_match, kind, name) => {
      namedExports.push(name);
      return `${kind} ${name}`;
    })
    .replace(/export \{([\s\S]*?)\};?/g, (_match, names) => {
      namedExports.push(
        ...names
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      );
      return '';
    });
  return `${transformed}\nObject.assign(module.exports, { ${namedExports.join(', ')} });\n${defaultExport ? `module.exports.default = ${defaultExport};` : ''}`;
}

function stripePaymentMethod() {
  return {
    code: 'oope_stripe',
    oope_payment_method_config: {
      backend_integration_url: JSON.stringify({
        getInitParamsUrl: 'https://commerce-config.example/init-params',
        createPaymentIntentUrl: 'https://commerce-config.example/payment-intent',
      }),
    },
  };
}

function shippingMethod() {
  return {
    carrier: { code: 'flatrate', title: 'Flat Rate' },
    code: 'flatrate',
    title: 'Fixed',
    amount: { value: 5, currency: 'USD' },
  };
}

function tableRateShippingMethod() {
  return {
    carrier: { code: 'tablerate', title: 'Best Way' },
    code: 'bestway',
    title: 'Table Rate',
    amount: { value: 15, currency: 'USD' },
  };
}

function commerceAddress() {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    telephone: '020 7946 0000',
    street: ['1 Algorithm Way', ''],
    city: 'London',
    region: { code: '' },
    country: { code: 'GB' },
    postcode: 'SW1A 1AA',
  };
}

function walletAddress() {
  return {
    name: 'Ada Lovelace',
    phone: '020 7946 0000',
    address: {
      line1: '1 Algorithm Way',
      city: 'London',
      country: 'GB',
      postal_code: 'SW1A 1AA',
    },
  };
}

function cartPayload(overrides = {}) {
  return {
    id: 'cart_123',
    isGuestCart: true,
    total: { includingTax: { value: 42, currency: 'USD' } },
    ...overrides,
  };
}

/** A taxed cart with separate item and shipping tax, matching the requested UI. */
function summaryFixture() {
  const price = (value) => ({ value, currency: 'USD' });
  const method = {
    ...shippingMethod(),
    amountExclTax: price(5),
    amountInclTax: price(5.23),
  };
  return {
    cart: cartPayload({
      total: { includingTax: price(15.83) },
      subtotal: { excludingTax: price(10), includingTax: price(10.60) },
      totalTax: price(0.83),
      discount: price(0),
      appliedDiscounts: [],
    }),
    checkout: checkoutPayload({
      shippingAddress: {
        ...commerceAddress(),
        country: { code: 'US' },
        region: { code: 'MI' },
        selectedShippingMethod: method,
        availableShippingMethods: [method],
      },
    }),
    method,
  };
}

function checkoutPayload(overrides = {}) {
  return {
    email: 'customer@example.com',
    isGuest: true,
    availablePaymentMethods: [stripePaymentMethod()],
    billingAddress: commerceAddress(),
    shippingAddress: {
      ...commerceAddress(),
      selectedShippingMethod: shippingMethod(),
      availableShippingMethods: [shippingMethod()],
    },
    ...overrides,
  };
}

function incompleteCheckoutPayload() {
  return checkoutPayload({
    email: '',
    isGuest: true,
    billingAddress: null,
    shippingAddress: null,
  });
}

function initParamsPayload(overrides = {}) {
  return {
    publishableKey: 'pk_test_123',
    options: { locale: 'auto' },
    appInfo: { name: 'Stripe Adobe Commerce App Builder' },
    elementsOptions: {
      paymentMethodOptions: {
        us_bank_account: {
          verification_method: 'instant',
          setup_future_usage: 'off_session',
        },
      },
    },
    ...overrides,
  };
}

function loadStripeExpressCheckoutBlock({
  search = '',
  initParams = initParamsPayload(),
  separateWalletInstances = false,
  displaySettings = { subtotal: 'EXCLUDING_TAX', shipping: 'EXCLUDING_TAX' },
} = {}) {
  const handlers = new Map();
  const lastPayloads = new Map();

  const events = {
    on: jest.fn((eventName, handler, options = {}) => {
      handlers.set(eventName, [...(handlers.get(eventName) || []), handler]);
      if (options.eager && lastPayloads.has(eventName)) {
        handler(lastPayloads.get(eventName));
      }
    }),
    lastPayload: jest.fn((eventName) => lastPayloads.get(eventName)),
    emit: async (eventName, payload) => {
      lastPayloads.set(eventName, payload);
      await Promise.all(
        (handlers.get(eventName) || []).map((handler) => handler(payload)),
      );
      await flushPromises();
    },
  };

  const document = createDocument();
  const localStorage = createStorage({ 'store-view': 'de_store' });
  const sessionStorage = createStorage();
  const uiRender = jest.fn((_component, props) => async (container) => {
    const alert = createElement('div');
    alert.className = 'dropin-in-line-alert';
    alert.textContent = [props.heading, props.description].filter(Boolean).join(' ');
    container.appendChild(alert);
    return alert;
  });

  const expressCheckoutElement = {
    mount: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  };
  const amazonExpressCheckoutElement = {
    mount: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  };
  const additionalWallets = Object.fromEntries(['applePay', 'googlePay', 'paypal', 'klarna'].map((method) => {
    const element = { mount: jest.fn(), on: jest.fn(), destroy: jest.fn() };
    return [method, {
      element,
      elements: {
        create: jest.fn(() => element),
        submit: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue(undefined),
      },
    }];
  }));
  const elements = {
    create: jest.fn((type, options = {}) => {
      if (options.shippingAddressRequired) return amazonExpressCheckoutElement;
      const method = Object.keys(additionalWallets)
        .find((key) => options.paymentMethods?.[key] === 'auto');
      return method ? additionalWallets[method].element : expressCheckoutElement;
    }),
    submit: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const amazonElements = {
    create: jest.fn(() => amazonExpressCheckoutElement),
    submit: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const stripeInstance = {
    registerAppInfo: jest.fn(),
    elements: jest.fn(() => elements),
    createConfirmationToken: jest.fn().mockResolvedValue({
      confirmationToken: { id: 'ctoken_123' },
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      paymentIntent: { id: 'pi_123', status: 'succeeded' },
    }),
    createPaymentMethod: jest.fn(),
  };
  if (separateWalletInstances) {
    stripeInstance.elements
      .mockImplementationOnce(() => elements)
      .mockImplementationOnce(() => amazonElements);
    Object.values(additionalWallets).forEach((wallet) => {
      stripeInstance.elements.mockImplementationOnce(() => wallet.elements);
    });
  }

  const fetch = jest.fn(async (url) => {
    if (url.endsWith('/init-params')) {
      return {
        ok: true,
        json: async () => initParams,
      };
    }

    if (url.endsWith('/payment-intent')) {
      return {
        ok: true,
        json: async () => ({
          client_secret: 'pi_123_secret_abc',
          return_url: 'https://runtime.example/payment-return?cart_id=cart_123',
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const context = {
    __exports: {},
    __mocks: {
      events,
      cartApi: {
        getStoreConfig: jest.fn().mockResolvedValue({
          shoppingCartDisplaySetting: displaySettings,
        }),
        refreshCart: jest.fn().mockResolvedValue(null),
      },
      checkoutApi: {
        fetchGraphQl: jest.fn().mockResolvedValue({ data: { customer: { addresses: [] } } }),
        setPaymentMethod: jest.fn().mockResolvedValue({
          selectedPaymentMethod: {
            code: 'oope_stripe',
            title: 'Stripe Payment Method',
          },
        }),
        setShippingAddress: jest.fn().mockResolvedValue(null),
        estimateShippingMethods: jest.fn().mockResolvedValue([shippingMethod()]),
        setShippingMethods: jest.fn().mockResolvedValue(null),
        setGuestEmailOnCart: jest.fn().mockResolvedValue(undefined),
        setBillingAddress: jest.fn().mockResolvedValue(null),
        getCart: jest.fn().mockResolvedValue(null),
      },
      orderApi: {
        placeOrder: jest.fn().mockResolvedValue({ number: '000000001' }),
      },
      Icon: jest.fn(),
      InLineAlert: jest.fn(),
      UI: { render: uiRender },
      h: jest.fn((component, props) => ({ component, props })),
      loadCSS: jest.fn(),
    },
    console,
    document,
    fetch,
    AbortController,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: jest.fn(),
    URLSearchParams,
    Stripe: jest.fn(() => stripeInstance),
    window: {
      location: { search },
      localStorage,
      sessionStorage,
      setTimeout: jest.fn(),
      clearTimeout: jest.fn(),
    },
  };

  vm.createContext(context);
  const moduleCache = new Map();
  const externals = {
    '@dropins/tools/event-bus.js': { events },
    '@dropins/storefront-cart/api.js': context.__mocks.cartApi,
    '@dropins/storefront-checkout/api.js': context.__mocks.checkoutApi,
    '@dropins/storefront-order/api.js': context.__mocks.orderApi,
    '@dropins/tools/components.js': {
      Icon: context.__mocks.Icon,
      InLineAlert: context.__mocks.InLineAlert,
      provider: context.__mocks.UI,
    },
    '@dropins/tools/preact.js': { h: context.__mocks.h },
    '../../scripts/aem.js': { loadCSS: context.__mocks.loadCSS },
  };
  const loadModule = (filename) => {
    if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
    const module = { exports: {} };
    moduleCache.set(filename, module);
    const source = transformStripeBlockSource(fs.readFileSync(filename, 'utf8'));
    const execute = new vm.Script(`(function(__require, module) { ${source}\n})`, {
      filename,
    }).runInContext(context);
    execute((specifier) => {
      if (externals[specifier]) return externals[specifier];
      if (!specifier.startsWith('.')) throw new Error(`Unexpected module: ${specifier}`);
      return loadModule(path.resolve(path.dirname(filename), specifier));
    }, module);
    return module.exports;
  };
  context.__exports = loadModule(STRIPE_BLOCK_PATH);

  return {
    state: loadModule(path.join(path.dirname(STRIPE_BLOCK_PATH), 'checkout-state.js')).state,
    exports: context.__exports,
    mocks: context.__mocks,
    events,
    document,
    checkoutRoot: document.checkoutRoot,
    localStorage,
    fetch,
    Stripe: context.Stripe,
    elements,
    amazonElements,
    expressCheckoutElement,
    amazonExpressCheckoutElement,
    additionalWallets,
    stripeInstance,
    uiRender,
    summary: loadModule(path.join(__dirname, 'order-summary.js')),
  };
}

async function renderAndMount(block, {
  cart,
  checkout,
  handleValidation,
  handleShippingValidation,
  handleReadiness,
} = {}) {
  const ctx = {
    replaceHTML: jest.fn((content) => {
      block.checkoutRoot.appendChild(content);
    }),
  };

  block.exports.renderStripePaymentMethod(ctx, {
    handleValidation,
    handleShippingValidation,
    handleReadiness,
  });
  await flushPromises();
  await block.events.emit('cart/initialized', cart || cartPayload());
  await block.events.emit('checkout/initialized', checkout || checkoutPayload());
  await waitForMount(block);
  return ctx;
}

function getHandler(block, eventName, wallet = 'default') {
  const element = block.additionalWallets[wallet]?.element || (wallet === 'amazon'
    ? block.amazonExpressCheckoutElement
    : block.expressCheckoutElement);
  const call = element.on.mock.calls.find(([name]) => name === eventName);
  return call?.[1];
}

function createConfirmEvent(overrides = {}) {
  return {
    billingDetails: {
      ...walletAddress(),
      email: 'customer@example.com',
    },
    shippingAddress: walletAddress(),
    shippingRate: { id: 'flatrate:flatrate', amount: 500 },
    paymentFailed: jest.fn(),
    ...overrides,
  };
}

describe('stripe-express-checkout EDS block', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(console.error).not.toHaveBeenCalled();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  test('mounts deferred ECE from init-params and ignores an untrusted App Builder override', async () => {
    const block = loadStripeExpressCheckoutBlock({
      search: '?stripeAppBuilderBaseUrl=https://untrusted.example/api/v1/web/stripe/',
    });

    await renderAndMount(block);

    expect(block.fetch).toHaveBeenCalledWith(
      'https://commerce-config.example/init-params',
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(block.fetch).not.toHaveBeenCalledWith(
      'https://commerce-config.example/payment-intent',
      expect.anything(),
    );
    expect(block.Stripe).toHaveBeenCalledWith('pk_test_123', { locale: 'auto' });
    expect(block.stripeInstance.registerAppInfo).toHaveBeenCalledWith({
      name: 'Stripe Adobe Commerce App Builder',
    });
    expect(block.stripeInstance.elements).toHaveBeenCalledTimes(6);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith({
      mode: 'payment',
      amount: 4200,
      currency: 'usd',
      paymentMethodOptions: {
        us_bank_account: {
          verification_method: 'instant',
          setup_future_usage: 'off_session',
        },
      },
    });
    expect(block.stripeInstance.elements.mock.calls[0][0].captureMethod).toBeUndefined();
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        billingAddressRequired: false,
        emailRequired: false,
        phoneNumberRequired: false,
        shippingAddressRequired: false,
        paymentMethods: {
          link: 'auto', amazonPay: 'never', applePay: 'never', googlePay: 'never', paypal: 'never', klarna: 'never',
        },
      }),
    );
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        billingAddressRequired: false,
        emailRequired: false,
        phoneNumberRequired: false,
        shippingAddressRequired: true,
        shippingRates: [
          {
            id: 'flatrate:flatrate',
            displayName: 'Flat Rate - Fixed',
            amount: 500,
          },
        ],
        paymentMethods: {
          applePay: 'never',
          googlePay: 'never',
          link: 'never',
          paypal: 'never',
          klarna: 'never',
        },
      }),
    );
    expect(block.expressCheckoutElement.mount).toHaveBeenCalledWith(
      '#stripe-express-checkout-element',
    );
    expect(block.amazonExpressCheckoutElement.mount).toHaveBeenCalledWith(
      '#stripe-express-checkout-amazon',
    );
    const expressBlock = block.document.querySelector('.stripe-express-checkout');
    expect(expressBlock.children.map((child) => child.className)).toEqual([
      'stripe-express-checkout-heading',
      'stripe-express-checkout-wallets',
      'stripe-express-checkout-status',
      'stripe-express-checkout-separator',
    ]);
    expect(expressBlock.children[1].children.map((child) => child.className)).toEqual([
      'stripe-express-checkout-link stripe-express-checkout-loading',
      'stripe-express-checkout-amazon stripe-express-checkout-loading',
      'stripe-express-checkout-apple-pay stripe-express-checkout-loading',
      'stripe-express-checkout-google-pay stripe-express-checkout-loading',
      'stripe-express-checkout-paypal stripe-express-checkout-loading',
      'stripe-express-checkout-klarna stripe-express-checkout-loading',
      'stripe-express-checkout-gate',
    ]);
    expect(expressBlock.children[0].textContent).toBe('Express checkout');
    expect(expressBlock.children[3].textContent).toBe('Or pay another way');
    expect(block.localStorage.setItem).not.toHaveBeenCalled();
  });

  test('passes manual capture from init-params as top-level Elements captureMethod', async () => {
    const block = loadStripeExpressCheckoutBlock({
      initParams: initParamsPayload({
        elementsOptions: {
          captureMethod: 'manual',
          paymentMethodOptions: {
            us_bank_account: { verification_method: 'instant' },
          },
        },
      }),
    });

    await renderAndMount(block);

    expect(block.stripeInstance.elements).toHaveBeenCalledTimes(6);
    block.stripeInstance.elements.mock.calls.forEach(([options]) => {
      expect(options).toEqual({
        mode: 'payment',
        amount: 4200,
        currency: 'usd',
        captureMethod: 'manual',
        paymentMethodOptions: {
          us_bank_account: { verification_method: 'instant' },
        },
      });
    });
  });

  test.each([
    ['JPY', 4200, 4200],
    ['KWD', 42, 42000],
  ])('uses Stripe minor units for %s', async (currency, value, amount) => {
    const block = loadStripeExpressCheckoutBlock();

    await renderAndMount(block, {
      cart: cartPayload({
        total: { includingTax: { value, currency } },
      }),
    });

    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount, currency: currency.toLowerCase() }),
    );
  });

  test('passes automatic capture from init-params as top-level Elements captureMethod', async () => {
    const block = loadStripeExpressCheckoutBlock({
      initParams: initParamsPayload({
        elementsOptions: {
          captureMethod: 'automatic',
          paymentMethodOptions: {
            us_bank_account: { verification_method: 'instant' },
          },
        },
      }),
    });

    await renderAndMount(block);

    expect(block.stripeInstance.elements.mock.calls[0][0].captureMethod).toBe('automatic');
  });

  test('keeps Link without shipping and Amazon Pay with shipping', async () => {
    const block = loadStripeExpressCheckoutBlock();

    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });

    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        billingAddressRequired: true,
        emailRequired: true,
        phoneNumberRequired: true,
        shippingAddressRequired: false,
        paymentMethods: {
          link: 'auto', amazonPay: 'never', applePay: 'never', googlePay: 'never', paypal: 'never', klarna: 'never',
        },
      }),
    );
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        shippingAddressRequired: true,
        paymentMethods: expect.objectContaining({
          link: 'never',
          applePay: 'never',
        }),
      }),
    );
  });

  test('persists a complete wallet address and resolves Commerce rates', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });
    block.mocks.cartApi.refreshCart.mockResolvedValue(
      cartPayload({
        total: { includingTax: { value: 47, currency: 'USD' } },
      }),
    );
    block.mocks.checkoutApi.setShippingAddress.mockResolvedValue({
      shippingAddress: {
        ...commerceAddress(),
        availableShippingMethods: [shippingMethod()],
      },
    });

    const event = {
      name: 'Ada Lovelace',
      address: walletAddress().address,
      phone: '020 7946 0000',
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingaddresschange')(event);

    expect(block.mocks.checkoutApi.setShippingAddress).toHaveBeenCalledWith({
      address: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        street: ['1 Algorithm Way'],
        city: 'London',
        countryCode: 'GB',
        postcode: 'SW1A 1AA',
        telephone: '020 7946 0000',
        saveInAddressBook: false,
      },
    });
    expect(block.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingMethods).toHaveBeenCalledWith([
      { carrierCode: 'flatrate', methodCode: 'flatrate' },
    ]);
    expect(block.elements.update).toHaveBeenCalledWith({ amount: 4700 });
    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: 4700 }],
      shippingRates: [
        {
          id: 'flatrate:flatrate',
          displayName: 'Flat Rate - Fixed',
          amount: 500,
        },
      ],
    });
    expect(event.reject).not.toHaveBeenCalled();
  });

  test('estimates rates for a redacted address without persisting it', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });

    const event = {
      name: '',
      address: { country: 'GB', postal_code: 'SW1A' },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingaddresschange')(event);

    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.estimateShippingMethods).toHaveBeenCalledWith({
      criteria: {
        country_code: 'GB',
        zip: 'SW1A',
      },
    });
    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: 4200 }],
      shippingRates: [
        {
          id: 'flatrate:flatrate',
          displayName: 'Flat Rate - Fixed',
          amount: 500,
        },
      ],
    });
  });

  test('persists the shipping method on shippingratechange when an address is on the cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });
    block.mocks.checkoutApi.setShippingAddress.mockResolvedValue({
      shippingAddress: {
        ...commerceAddress(),
        availableShippingMethods: [shippingMethod()],
      },
    });
    await getHandler(
      block,
      'shippingaddresschange',
    )({
      name: 'Ada Lovelace',
      address: walletAddress().address,
      phone: '020 7946 0000',
      resolve: jest.fn(),
      reject: jest.fn(),
    });
    block.mocks.checkoutApi.setShippingMethods.mockClear();
    block.mocks.cartApi.refreshCart.mockClear();

    const event = {
      shippingRate: { id: 'flatrate:flatrate', amount: 500 },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingratechange')(event);

    expect(block.mocks.checkoutApi.setShippingMethods).toHaveBeenCalledWith([
      { carrierCode: 'flatrate', methodCode: 'flatrate' },
    ]);
    expect(block.mocks.cartApi.refreshCart).toHaveBeenCalled();
    expect(event.resolve).toHaveBeenCalled();
    expect(event.reject).not.toHaveBeenCalled();
  });

  test('retains Magento total when a redacted wallet address cannot persist a shipping rate', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });
    await getHandler(
      block,
      'shippingaddresschange',
    )({
      name: '',
      address: { country: 'GB', postal_code: 'SW1A' },
      resolve: jest.fn(),
      reject: jest.fn(),
    });

    const event = {
      shippingRate: { id: 'flatrate:flatrate', amount: 500 },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingratechange')(event);

    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(block.elements.update).not.toHaveBeenCalled();
    expect(event.resolve).toHaveBeenCalledWith(expect.objectContaining({
      lineItems: [{ name: 'Grand Total', amount: 4200 }],
    }));
  });

  test('confirms a guest cart with a Confirmation Token then places the order', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, {
      checkout: checkoutPayload({
        email: '',
        billingAddress: null,
      }),
    });
    block.mocks.checkoutApi.getCart.mockResolvedValue(checkoutPayload());
    block.mocks.cartApi.refreshCart.mockResolvedValue(cartPayload());

    const event = createConfirmEvent();
    await getHandler(block, 'confirm')(event);

    expect(block.stripeInstance.createPaymentMethod).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setGuestEmailOnCart).toHaveBeenCalledWith(
      'customer@example.com',
    );
    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.elements.submit).toHaveBeenCalledTimes(1);
    expect(block.stripeInstance.createConfirmationToken).toHaveBeenCalledWith({
      elements: block.elements,
      params: {
        payment_method_data: {
          billing_details: {
            name: 'Ada Lovelace',
            email: 'customer@example.com',
            phone: '020 7946 0000',
            address: walletAddress().address,
          },
        },
        shipping: {
          name: 'Ada Lovelace',
          phone: '020 7946 0000',
          address: {
            line1: '1 Algorithm Way',
            city: 'London',
            country: 'GB',
            postal_code: 'SW1A 1AA',
          },
        },
      },
    });
    expect(block.fetch).toHaveBeenCalledWith(
      'https://commerce-config.example/payment-intent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Store: 'de_store',
        },
        body: JSON.stringify({
          cartId: 'cart_123',
          cartFullName: 'Ada Lovelace',
          confirmationTokenId: 'ctoken_123',
          storeCode: 'de_store',
        }),
      }),
    );
    expect(block.mocks.checkoutApi.setPaymentMethod).toHaveBeenCalledWith({
      code: 'oope_stripe',
      additional_data: [{ key: 'client_secret', value: 'pi_123_secret_abc' }],
    });
    expect(block.mocks.checkoutApi.setPaymentMethod).toHaveBeenCalledTimes(2);
    expect(block.stripeInstance.confirmPayment).toHaveBeenCalledWith({
      clientSecret: 'pi_123_secret_abc',
      confirmParams: {
        confirmation_token: 'ctoken_123',
        return_url: 'https://runtime.example/payment-return?cart_id=cart_123',
      },
      redirect: 'if_required',
    });
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
    expect(block.events.lastPayload('checkout/values').selectedPaymentMethod.code).toBe(
      'oope_stripe',
    );
    expect(event.paymentFailed).not.toHaveBeenCalled();
    const status = block.document.querySelector('.stripe-express-checkout-status');
    expect(status.children[0].textContent).toContain('Payment successful');
    expect(status.children[0].textContent).toContain('order has been placed');
    await expect(block.exports.handleStripePayment('cart_123')).resolves.toBe(true);
  });

  test('does not replace an existing shipping address with wallet billing details', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);

    await getHandler(
      block,
      'confirm',
    )(createConfirmEvent({ shippingAddress: null, shippingRate: null }));

    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
  });

  test('confirms Link with Magento shipping when the wallet has no address', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, {
      checkout: checkoutPayload({
        billingAddress: null,
      }),
    });
    block.mocks.checkoutApi.getCart.mockResolvedValue(checkoutPayload());
    block.mocks.cartApi.refreshCart.mockResolvedValue(cartPayload());

    const event = createConfirmEvent({
      shippingAddress: null,
      shippingRate: null,
      billingDetails: {
        name: 'Ada Lovelace',
        email: 'customer@example.com',
        phone: '020 7946 0000',
      },
    });
    await getHandler(block, 'confirm')(event);

    expect(block.mocks.checkoutApi.setBillingAddress).toHaveBeenCalledWith({
      sameAsShipping: true,
    });
    expect(block.stripeInstance.createConfirmationToken).toHaveBeenCalledWith({
      elements: block.elements,
      params: {
        payment_method_data: {
          billing_details: {
            name: 'Ada Lovelace',
            email: 'customer@example.com',
            phone: '020 7946 0000',
          },
        },
        shipping: {
          name: 'Ada Lovelace',
          phone: '020 7946 0000',
          address: {
            line1: '1 Algorithm Way',
            city: 'London',
            country: 'GB',
            postal_code: 'SW1A 1AA',
          },
        },
      },
    });
    expect(event.paymentFailed).not.toHaveBeenCalled();
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
  });

  test('does not save Link billing as another customer address before placing the order', async () => {
    const block = loadStripeExpressCheckoutBlock();
    block.document.cookie = 'auth_dropin_user_token=customer-token-123';
    await renderAndMount(block, {
      checkout: checkoutPayload({
        isGuest: false,
        shippingAddress: { ...commerceAddress(), id: 42, selectedShippingMethod: shippingMethod() },
        billingAddress: null,
      }),
    });
    block.mocks.checkoutApi.getCart.mockResolvedValue(checkoutPayload({ isGuest: false }));

    const event = createConfirmEvent({ expressPaymentType: 'link' });
    await getHandler(block, 'confirm')(event);

    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setBillingAddress).toHaveBeenCalledTimes(1);
    expect(block.mocks.checkoutApi.setBillingAddress).toHaveBeenCalledWith({
      address: expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        street: ['1 Algorithm Way'],
        saveInAddressBook: false,
      }),
    });
    expect(block.mocks.checkoutApi.setBillingAddress.mock.invocationCallOrder[0]).toBeLessThan(
      block.mocks.orderApi.placeOrder.mock.invocationCallOrder[0],
    );
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
    expect(event.paymentFailed).not.toHaveBeenCalled();
  });

  test('retains selected saved shipping and billing addresses when placing a Link order', async () => {
    const block = loadStripeExpressCheckoutBlock();
    block.document.cookie = 'auth_dropin_user_token=customer-token-123';
    await renderAndMount(block, {
      checkout: checkoutPayload({
        isGuest: false,
        shippingAddress: { ...commerceAddress(), id: 42, selectedShippingMethod: shippingMethod() },
        billingAddress: { ...commerceAddress(), id: 43, street: ['2 Billing Road'] },
      }),
    });

    const event = createConfirmEvent({ expressPaymentType: 'link' });
    await getHandler(block, 'confirm')(event);

    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setBillingAddress).not.toHaveBeenCalled();
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
    expect(event.paymentFailed).not.toHaveBeenCalled();
  });

  test('reuses a re-entered saved address before Link payment and order creation', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: checkoutPayload({ isGuest: false }) });
    block.mocks.checkoutApi.fetchGraphQl.mockResolvedValue({
      data: {
        customer: {
          addresses: [{
            id: 42,
            firstname: 'Ada',
            lastname: 'Lovelace',
            street: ['1 Algorithm Way'],
            city: 'London',
            country_code: 'GB',
            postcode: 'SW1A 1AA',
            telephone: '020 7946 0000',
          }],
        },
      },
    });

    await getHandler(block, 'confirm')(createConfirmEvent({ expressPaymentType: 'link' }));

    expect(block.mocks.checkoutApi.setShippingAddress).toHaveBeenCalledWith({
      customerAddressId: 42,
    });
    expect(block.mocks.checkoutApi.setBillingAddress).toHaveBeenCalledWith({
      customerAddressId: 42,
    });
    expect(block.mocks.checkoutApi.setBillingAddress.mock.invocationCallOrder[0]).toBeLessThan(
      block.stripeInstance.confirmPayment.mock.invocationCallOrder[0],
    );
    expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledWith('cart_123');
  });

  test('does not charge or create a Link order if checking saved addresses fails', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: checkoutPayload({ isGuest: false }) });
    block.mocks.checkoutApi.fetchGraphQl.mockRejectedValue(new Error('Address lookup failed'));
    const event = createConfirmEvent({ expressPaymentType: 'link' });

    await getHandler(block, 'confirm')(event);

    expect(block.stripeInstance.confirmPayment).not.toHaveBeenCalled();
    expect(block.mocks.orderApi.placeOrder).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalled();
  });

  test('does not place an order when Commerce keeps a fallback payment method', async () => {
    const block = loadStripeExpressCheckoutBlock();
    block.mocks.checkoutApi.setPaymentMethod.mockResolvedValue({
      selectedPaymentMethod: {
        code: 'checkmo',
        title: 'Check / Money order',
      },
    });
    await renderAndMount(block);

    const event = createConfirmEvent();
    await getHandler(block, 'confirm')(event);

    expect(block.mocks.orderApi.placeOrder).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalledWith({ reason: 'fail' });
  });

  test('forwards the customer bearer token for a registered cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    block.document.cookie = 'auth_dropin_user_token=customer-token-123';
    await renderAndMount(block, {
      cart: cartPayload({ isGuestCart: false }),
      checkout: checkoutPayload({ isGuest: false }),
    });

    await getHandler(block, 'confirm')(createConfirmEvent());

    expect(block.mocks.checkoutApi.setGuestEmailOnCart).not.toHaveBeenCalled();
    expect(block.fetch).toHaveBeenCalledWith(
      'https://commerce-config.example/payment-intent',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer customer-token-123',
          Store: 'de_store',
        },
        body: JSON.stringify({
          cartId: 'cart_123',
          cartFullName: 'Ada Lovelace',
          confirmationTokenId: 'ctoken_123',
          storeCode: 'de_store',
        }),
      }),
    );
  });

  test('does not start payment when checkout validation fails', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleValidation = jest.fn().mockReturnValue(false);
    await renderAndMount(block, { handleValidation });

    const event = createConfirmEvent();
    await getHandler(block, 'confirm')(event);

    expect(handleValidation).toHaveBeenCalledTimes(1);
    expect(block.fetch).not.toHaveBeenCalledWith(
      'https://commerce-config.example/payment-intent',
      expect.anything(),
    );
    expect(block.mocks.orderApi.placeOrder).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalledWith({ reason: 'fail' });
  });

  test('rejects Magento-owned wallet click when the shipping form is invalid', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleShippingValidation = jest.fn().mockReturnValue(false);
    await renderAndMount(block, { handleShippingValidation });
    const clickEvent = { resolve: jest.fn(), reject: jest.fn() };

    await getHandler(block, 'click')(clickEvent);

    expect(handleShippingValidation).toHaveBeenCalledTimes(1);
    expect(clickEvent.reject).toHaveBeenCalledTimes(1);
    expect(clickEvent.resolve).not.toHaveBeenCalled();
    expect(block.checkoutRoot.className).not.toContain('stripe-express-checkout-blocked');
    expect(block.document.querySelector('.stripe-express-checkout-status').children[0].textContent)
      .toContain('Please fix the highlighted required fields');
  });

  test('rejects the Amazon Pay click when the shipping form is invalid', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleShippingValidation = jest.fn().mockReturnValue(false);
    await renderAndMount(block, { handleShippingValidation });
    const clickEvent = { resolve: jest.fn(), reject: jest.fn() };

    await getHandler(block, 'click', 'amazon')(clickEvent);

    expect(handleShippingValidation).toHaveBeenCalledTimes(1);
    expect(clickEvent.reject).toHaveBeenCalledTimes(1);
    expect(clickEvent.resolve).not.toHaveBeenCalled();
  });

  test('covers every wallet so an incomplete checkout cannot open one', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleReadiness = jest.fn().mockReturnValue(false);
    const handleShippingValidation = jest.fn().mockReturnValue(false);
    await renderAndMount(block, { handleReadiness, handleShippingValidation });

    const gate = block.document.querySelector('.stripe-express-checkout-gate');
    expect(gate.hidden).toBe(false);
    expect(block.document.querySelector('.stripe-express-checkout-amazon').inert).toBe(true);
    expect(block.document.querySelector('#stripe-express-checkout-element').inert).toBe(true);

    await gate.dispatch('click');

    expect(handleShippingValidation).toHaveBeenCalledTimes(1);
    expect(block.document.querySelector('.stripe-express-checkout-status').children[0].textContent)
      .toContain('Please fix the highlighted required fields');
  });

  test('uncovers the wallets once the checkout fields are complete', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleReadiness = jest.fn().mockReturnValue(true);
    await renderAndMount(block, { handleReadiness });

    expect(block.document.querySelector('.stripe-express-checkout-gate').hidden).toBe(true);
    expect(block.document.querySelector('.stripe-express-checkout-amazon').inert).toBe(false);
  });

  test('does not confirm Magento-owned payment when the shipping form is invalid', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const handleShippingValidation = jest.fn().mockReturnValue(false);
    await renderAndMount(block, { handleShippingValidation });

    const event = createConfirmEvent();
    await getHandler(block, 'confirm')(event);

    expect(handleShippingValidation).toHaveBeenCalledTimes(1);
    expect(block.stripeInstance.createConfirmationToken).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalledWith({ reason: 'fail' });
    expect(block.document.querySelector('.stripe-express-checkout-status').children[0].textContent)
      .toContain('Please fix the highlighted required fields');
  });

  test('blocks Place Order until Express Checkout has confirmed the cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);

    expect(block.exports.validateStripePayment()).toBe(false);
    await expect(block.exports.handleStripePayment('cart_123')).resolves.toBe(false);
    expect(block.stripeInstance.createConfirmationToken).not.toHaveBeenCalled();
    expect(block.mocks.orderApi.placeOrder).not.toHaveBeenCalled();
  });

  test('logs loaderror, hides ECE, and shows a customer-facing error', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);

    await getHandler(block, 'loaderror')({ error: new Error('wallet failed') });

    expect(console.warn).toHaveBeenCalledWith(
      'Stripe Express Checkout Element failed to load.',
      expect.any(Error),
    );
    const mountEl = block.document.querySelector('#stripe-express-checkout-element');
    expect(mountEl.hidden).toBe(true);
    expect(mountEl.className).toContain('stripe-express-checkout-hidden');
    expect(mountEl.children).toHaveLength(0);
    expect(block.document.querySelector('.stripe-express-checkout').hidden).toBe(false);
    const status = block.document.querySelector('.stripe-express-checkout-status');
    expect(status.children[0].textContent).toContain('Payment failed');
    expect(status.children[0].textContent).toContain(
      'Please use the card payment form below',
    );
  });

  test('hides the complete Express section when no wallet is available', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);

    getHandler(block, 'ready')({ availablePaymentMethods: null });

    expect(block.document.querySelector('.stripe-express-checkout').hidden).toBe(true);
  });

  test('blocks checkout on wallet click and unblocks on cancel and escape', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);
    const clickEvent = { resolve: jest.fn() };

    await getHandler(block, 'click')(clickEvent);

    expect(block.checkoutRoot.className).toContain('stripe-express-checkout-blocked');
    expect(block.checkoutRoot.attributes['aria-busy']).toBe('true');
    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: block.stripeInstance.elements.mock.calls.at(-1)[0].amount }],
    });

    getHandler(block, 'cancel')();
    expect(block.checkoutRoot.className).not.toContain('stripe-express-checkout-blocked');
    expect(block.checkoutRoot.attributes['aria-busy']).toBeUndefined();

    await getHandler(block, 'click')(clickEvent);
    getHandler(block, 'escape')();
    expect(block.checkoutRoot.className).not.toContain('stripe-express-checkout-blocked');
  });

  test('does not pass shippingAddressRequired on Link click', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);
    const clickEvent = {
      expressPaymentType: 'link',
      resolve: jest.fn(),
    };

    await getHandler(block, 'click')(clickEvent);

    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: block.stripeInstance.elements.mock.calls.at(-1)[0].amount }],
    });
    expect(clickEvent.resolve.mock.calls[0][0].shippingAddressRequired).toBeUndefined();
  });

  test('preserves Magento total when shipping persistence has not changed the cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const euroShipping = {
      ...shippingMethod(),
      amount: { value: 5, currency: 'EUR' },
    };
    await renderAndMount(block, {
      cart: cartPayload({
        total: { includingTax: { value: 39.01, currency: 'EUR' } },
        subtotal: { includingTax: { value: 39.01, currency: 'EUR' } },
      }),
      checkout: checkoutPayload({
        shippingAddress: {
          ...commerceAddress(),
          selectedShippingMethod: euroShipping,
          availableShippingMethods: [euroShipping],
        },
      }),
    });
    const clickEvent = { resolve: jest.fn() };

    await getHandler(block, 'click')(clickEvent);

    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3901, currency: 'eur' }),
    );
    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: block.stripeInstance.elements.mock.calls.at(-1)[0].amount }],
    });
    expect(block.elements.update).not.toHaveBeenCalled();

    await block.events.emit(
      'cart/updated',
      cartPayload({
        total: { includingTax: { value: 39.01, currency: 'EUR' } },
        subtotal: { includingTax: { value: 39.01, currency: 'EUR' } },
      }),
    );

    expect(block.elements.update).not.toHaveBeenCalledWith({ amount: 3901 });
  });

  test('uses the selected Magento shipping option instead of the first rate', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const flatRate = shippingMethod();
    const tableRate = tableRateShippingMethod();
    block.mocks.cartApi.refreshCart.mockResolvedValue(
      cartPayload({
        total: { includingTax: { value: 63.71, currency: 'USD' } },
        subtotal: { includingTax: { value: 48.71, currency: 'USD' } },
      }),
    );
    await renderAndMount(block, {
      cart: cartPayload({
        total: { includingTax: { value: 53.71, currency: 'USD' } },
        subtotal: { includingTax: { value: 48.71, currency: 'USD' } },
      }),
      checkout: checkoutPayload({
        shippingAddress: {
          ...commerceAddress(),
          selectedShippingMethod: tableRate,
          availableShippingMethods: [flatRate, tableRate],
        },
      }),
    });

    expect(block.mocks.checkoutApi.setShippingMethods).toHaveBeenCalledWith([
      { carrierCode: 'tablerate', methodCode: 'bestway' },
    ]);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6371, currency: 'usd' }),
    );

    const clickEvent = {
      expressPaymentType: 'link',
      resolve: jest.fn(),
    };
    await getHandler(block, 'click')(clickEvent);

    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: block.stripeInstance.elements.mock.calls.at(-1)[0].amount }],
    });
  });

  test('opens the wallet sheet without waiting for Magento shipping persist', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const flatRate = shippingMethod();
    const tableRate = tableRateShippingMethod();
    await renderAndMount(block, {
      cart: cartPayload({
        total: { includingTax: { value: 53.71, currency: 'USD' } },
        subtotal: { includingTax: { value: 48.71, currency: 'USD' } },
      }),
      checkout: checkoutPayload({
        shippingAddress: {
          ...commerceAddress(),
          selectedShippingMethod: tableRate,
          availableShippingMethods: [flatRate, tableRate],
        },
      }),
    });

    block.mocks.checkoutApi.setShippingMethods.mockImplementation(
      () => new Promise(() => {}),
    );

    const clickEvent = {
      expressPaymentType: 'link',
      resolve: jest.fn(),
    };
    await getHandler(block, 'click')(clickEvent);

    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: block.stripeInstance.elements.mock.calls.at(-1)[0].amount }],
    });
  });

  test('resolves Amazon Pay click immediately with Magento shipping rates', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const checkout = checkoutPayload({
      shippingAddress: {
        ...commerceAddress(),
        selectedShippingMethod: null,
        availableShippingMethods: [shippingMethod()],
      },
    });
    await renderAndMount(block, { checkout });
    const clickEvent = {
      expressPaymentType: 'amazon_pay',
      resolve: jest.fn(),
    };

    await getHandler(block, 'click', 'amazon')(clickEvent);

    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4200 }),
    );
    expect(clickEvent.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: 4200 }],
      shippingRates: [
        {
          id: 'flatrate:flatrate',
          displayName: 'Flat Rate - Fixed',
          amount: 500,
        },
      ],
    });
    expect(block.elements.update).not.toHaveBeenCalled();
  });

  test('keeps Amazon Pay shipping collection after Magento already has address and method', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        shippingAddressRequired: false,
        paymentMethods: {
          link: 'auto', amazonPay: 'never', applePay: 'never', googlePay: 'never', paypal: 'never', klarna: 'never',
        },
      }),
    );
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({ shippingAddressRequired: true }),
    );

    await block.events.emit('checkout/updated', checkoutPayload());
    await waitForMount(block, 2);

    expect(block.expressCheckoutElement.destroy).toHaveBeenCalled();
    expect(block.amazonExpressCheckoutElement.destroy).toHaveBeenCalled();
    const defaultOptions = block.elements.create.mock.calls
      .map(([, options]) => options)
      .filter((options) => options.paymentMethods.link === 'auto')
      .at(-1);
    const amazonOptions = block.elements.create.mock.calls
      .map(([, options]) => options)
      .filter((options) => options.shippingAddressRequired === true)
      .at(-1);
    expect(defaultOptions).toEqual(
      expect.objectContaining({
        shippingAddressRequired: false,
        paymentMethods: {
          link: 'auto', amazonPay: 'never', applePay: 'never', googlePay: 'never', paypal: 'never', klarna: 'never',
        },
      }),
    );
    expect(amazonOptions).toEqual(
      expect.objectContaining({
        shippingAddressRequired: true,
        shippingRates: [
          {
            id: 'flatrate:flatrate',
            displayName: 'Flat Rate - Fixed',
            amount: 500,
          },
        ],
      }),
    );
  });

  test('does not persist a wallet shipping address over a complete Magento address', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);

    await getHandler(
      block,
      'shippingaddresschange',
    )({
      name: 'Ada Lovelace',
      address: {
        ...walletAddress().address,
        country: 'DE',
        postal_code: '85356',
      },
      phone: '020 7946 0000',
      resolve: jest.fn(),
      reject: jest.fn(),
    });

    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
  });

  test.each(['available', 'empty', 'missing'])('preserves Michigan shipping and tax after Amazon cancellation with %s rates', async (rates) => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    const fixture = summaryFixture();
    if (rates === 'empty') fixture.checkout.shippingAddress.availableShippingMethods = [];
    if (rates === 'missing') delete fixture.checkout.shippingAddress.availableShippingMethods;
    const originalCheckout = JSON.parse(JSON.stringify(fixture.checkout));
    const originalCart = JSON.parse(JSON.stringify(fixture.cart));
    const estimateTotals = jest.fn();
    block.events.on('shipping/estimate', estimateTotals);
    block.mocks.checkoutApi.estimateShippingMethods.mockImplementation(async () => {
      await block.events.emit('shipping/estimate', { address: walletAddress().address });
      return [shippingMethod()];
    });
    await renderAndMount(block, fixture);
    const click = { resolve: jest.fn() };
    await getHandler(block, 'click', 'amazon')(click);
    const addressChange = { ...walletAddress(), resolve: jest.fn(), reject: jest.fn() };
    await getHandler(block, 'shippingaddresschange', 'amazon')(addressChange);
    expect(addressChange.reject).not.toHaveBeenCalled();
    const { shippingRates, lineItems } = addressChange.resolve.mock.calls[0][0];
    expect(shippingRates).toHaveLength(1);
    expect(shippingRates[0].id).toBe('flatrate:flatrate');
    expect(lineItems).toContainEqual({ name: 'Tax', amount: 83 });
    expect(lineItems.reduce((sum, item) => sum + item.amount, 0)).toBe(1583);
    const rateChange = { shippingRate: shippingRates[0], resolve: jest.fn(), reject: jest.fn() };
    await getHandler(block, 'shippingratechange', 'amazon')(rateChange);
    expect(rateChange.reject).not.toHaveBeenCalled();
    await getHandler(block, 'cancel', 'amazon')();
    await flushPromises();

    expect(estimateTotals).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(block.state.checkoutData).toEqual(originalCheckout);
    expect(block.state.cartData).toEqual(originalCart);
    expect(block.state.currentAmount).toBe(1583);
    expect(block.state.modalOpen).toBe(false);
    expect(block.elements.update).not.toHaveBeenCalled();
    expect(block.amazonElements.update).not.toHaveBeenCalled();
    const reopen = { resolve: jest.fn() };
    await getHandler(block, 'click', 'amazon')(reopen);
    expect(reopen.resolve.mock.calls[0][0].lineItems).toEqual(lineItems);
  });

  test('rejects Amazon shipping changes when owned shipping has no rates or selected method', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const fixture = summaryFixture();
    fixture.checkout.shippingAddress.availableShippingMethods = [];
    fixture.checkout.shippingAddress.selectedShippingMethod = null;
    await renderAndMount(block, fixture);
    await getHandler(block, 'click', 'amazon')({ resolve: jest.fn() });
    const event = { ...walletAddress(), resolve: jest.fn(), reject: jest.fn() };
    await getHandler(block, 'shippingaddresschange', 'amazon')(event);
    expect(event.reject).toHaveBeenCalledTimes(1);
    expect(event.resolve).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.estimateShippingMethods).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(block.state.currentAmount).toBe(1583);
  });

  test('blocks wallet confirmation until Magento has a shipping address and method', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, { checkout: incompleteCheckoutPayload() });

    const event = createConfirmEvent();
    await getHandler(block, 'confirm')(event);

    expect(block.mocks.orderApi.placeOrder).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalled();
    expect(
      block.document.querySelector('.stripe-express-checkout-status').children[0]
        .textContent,
    ).toContain('shipping address');
  });

  test.each(['default', 'amazon', 'applePay', 'googlePay', 'paypal', 'klarna'])(
    'confirms %s using its own Elements instance',
    async (wallet) => {
      const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
      await renderAndMount(block);
      const event = createConfirmEvent();

      await getHandler(block, 'confirm', wallet)(event);

      const activeElements = block.additionalWallets[wallet]?.elements
        || (wallet === 'amazon' ? block.amazonElements : block.elements);
      const inactiveElements = [block.elements, block.amazonElements,
        ...Object.values(block.additionalWallets).map((entry) => entry.elements)]
        .filter((instance) => instance !== activeElements);
      expect(activeElements.submit).toHaveBeenCalledTimes(1);
      inactiveElements.forEach((instance) => expect(instance.submit).not.toHaveBeenCalled());
      expect(block.stripeInstance.createConfirmationToken).toHaveBeenCalledWith(
        expect.objectContaining({ elements: activeElements }),
      );
      expect(event.paymentFailed).not.toHaveBeenCalled();
      expect(block.mocks.orderApi.placeOrder).toHaveBeenCalledTimes(1);
    },
  );

  test('switches back to Magento shipping after dismissing Amazon and opening Link', async () => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    await renderAndMount(block);
    await getHandler(block, 'click', 'amazon')({ resolve: jest.fn() });
    getHandler(block, 'cancel', 'amazon')();
    await flushPromises();
    const click = { resolve: jest.fn() };
    await getHandler(block, 'click')(click);
    const confirm = createConfirmEvent({ shippingAddress: null, shippingRate: null });
    await getHandler(block, 'confirm')(confirm);

    expect(click.resolve).toHaveBeenCalledWith({ lineItems: [{ name: 'Grand Total', amount: 4200 }] });
    expect(block.amazonElements.submit).not.toHaveBeenCalled();
    expect(block.stripeInstance.createConfirmationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: block.elements,
        params: expect.objectContaining({
          shipping: expect.objectContaining({
            address: expect.objectContaining({ line1: '1 Algorithm Way', country: 'GB' }),
          }),
        }),
      }),
    );
    expect(confirm.paymentFailed).not.toHaveBeenCalled();
  });

  test('updates every distinct Elements instance when the cart amount changes', async () => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    await renderAndMount(block);
    await block.events.emit(
      'cart/updated',
      cartPayload({
        total: { includingTax: { value: 52, currency: 'USD' } },
      }),
    );

    expect(block.elements.update).toHaveBeenCalledTimes(1);
    expect(block.amazonElements.update).toHaveBeenCalledTimes(1);
    Object.values(block.additionalWallets).forEach(({ elements: instance }) => {
      expect(instance.update.mock.calls).toEqual(block.elements.update.mock.calls);
    });
    expect(block.elements.update).toHaveBeenCalledWith({ amount: 5200 });
    expect(block.amazonElements.update).toHaveBeenCalledWith({ amount: 5200 });
  });

  test('keeps Link visible when the Amazon element fails to load', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);
    getHandler(block, 'ready')({ availablePaymentMethods: { link: true } });
    getHandler(
      block,
      'ready',
      'amazon',
    )({ availablePaymentMethods: { amazonPay: true } });
    await getHandler(
      block,
      'loaderror',
      'amazon',
    )({ error: new Error('Amazon unavailable') });

    expect(block.document.querySelector('.stripe-express-checkout').hidden).toBe(false);
    expect(block.document.querySelector('#stripe-express-checkout-element').hidden).toBe(
      false,
    );
    expect(block.document.querySelector('#stripe-express-checkout-amazon').hidden).toBe(
      true,
    );
  });

  test('destroys both wallets on cart reset and remounts them for a new cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block);
    await block.events.emit('cart/reset');
    expect(block.expressCheckoutElement.destroy).toHaveBeenCalledTimes(1);
    expect(block.amazonExpressCheckoutElement.destroy).toHaveBeenCalledTimes(1);
    Object.values(block.additionalWallets).forEach(({ element }) => {
      expect(element.destroy).toHaveBeenCalledTimes(1);
    });

    await block.events.emit('cart/initialized', cartPayload({ id: 'cart_456' }));
    await block.events.emit('checkout/initialized', checkoutPayload({ id: 'cart_456' }));
    await waitForMount(block, 2);
    expect(block.amazonExpressCheckoutElement.mount).toHaveBeenCalledTimes(2);
    Object.values(block.additionalWallets).forEach(({ element }) => {
      expect(element.mount).toHaveBeenCalledTimes(2);
    });
    expect(block.exports.validateStripePayment()).toBe(false);
  });

  test('mounts only the payment-only wallet group for a virtual cart', async () => {
    const block = loadStripeExpressCheckoutBlock();
    await renderAndMount(block, {
      cart: cartPayload({ isVirtual: true }),
      checkout: checkoutPayload({ isVirtual: true, shippingAddress: null }),
    });
    expect(block.stripeInstance.elements).toHaveBeenCalledTimes(5);
    expect(block.amazonExpressCheckoutElement.mount).not.toHaveBeenCalled();
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({
        shippingAddressRequired: false,
        paymentMethods: {
          link: 'auto', amazonPay: 'never', applePay: 'never', googlePay: 'never', paypal: 'never', klarna: 'never',
        },
      }),
    );
  });

  test('shows the reconciled Michigan order summary on create and immediate Link click', async () => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    const fixture = summaryFixture();
    const lineItems = [
      { name: 'Subtotal', amount: 1000 },
      { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 500 },
      { name: 'Tax', amount: 83 },
    ];
    await renderAndMount(block, fixture);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1583 }),
    );
    expect(block.elements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({ shippingAddressRequired: false, lineItems }),
    );
    expect(block.amazonElements.create).toHaveBeenCalledWith(
      'expressCheckout',
      expect.objectContaining({ shippingAddressRequired: true, lineItems }),
    );
    block.mocks.cartApi.getStoreConfig.mockClear();
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(event.resolve).toHaveBeenCalledWith({ lineItems });
    expect(block.mocks.cartApi.getStoreConfig).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
  });

  test.each([false, true])('refreshes Link tax from cart/data after a country change (Michigan: %s)', async (toMichigan) => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    const michigan = summaryFixture();
    const romania = summaryFixture();
    romania.cart.total.includingTax.value = 15;
    romania.cart.subtotal.includingTax.value = 10;
    romania.cart.totalTax.value = 0;
    romania.method.amountInclTax.value = 5;
    romania.checkout.shippingAddress.country = { code: 'RO' };
    romania.checkout.shippingAddress.region = { code: 'B' };
    const initial = toMichigan ? romania : michigan;
    const updated = toMichigan ? michigan : romania;
    await renderAndMount(block, initial);
    await getHandler(block, 'click')({ resolve: jest.fn() });
    await getHandler(block, 'cancel')();

    // Address mutations refresh the Cart Drop-in via cart/data, without cart/updated.
    await block.events.emit('checkout/updated', updated.checkout);
    await block.events.emit('cart/data', updated.cart);
    await flushPromises();
    const amount = toMichigan ? 1583 : 1500;
    expect(block.elements.update).toHaveBeenLastCalledWith({ amount });
    expect(block.amazonElements.update).toHaveBeenLastCalledWith({ amount });

    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);

    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [
        { name: 'Subtotal', amount: 1000 },
        { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 500 },
        ...(toMichigan ? [{ name: 'Tax', amount: 83 }] : []),
      ],
    });
    expect(block.expressCheckoutElement.mount).toHaveBeenCalledTimes(1);
    expect(block.mocks.cartApi.refreshCart).not.toHaveBeenCalled();
  });

  test.each([
    ['EXCLUDING_TAX', 'EXCLUDING_TAX', [1000, 500, 83]],
    ['INCLUDING_TAX', 'EXCLUDING_TAX', [1060, 500, 23]],
    ['EXCLUDING_TAX', 'INCLUDING_TAX', [1000, 523, 60]],
    ['INCLUDING_TAX', 'INCLUDING_TAX', [1060, 523]],
    ['INCLUDING_EXCLUDING_TAX', 'INCLUDING_AND_EXCLUDING_TAX', [1060, 523]],
  ])('avoids duplicate tax with subtotal %s and shipping %s', (subtotal, shipping, amounts) => {
    const block = loadStripeExpressCheckoutBlock();
    const { cart, method } = summaryFixture();
    const rows = block.summary.buildOrderSummary(cart, method, { subtotal, shipping });
    expect(rows.map((row) => row.amount)).toEqual(amounts);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1583);
    expect(rows[0].name).toBe('Subtotal');
  });

  test.each([
    ['rounding mismatch', (cart) => { cart.total.includingTax.value = 15.84; }],
    ['unknown fee', (cart) => { cart.total.includingTax.value = 18.83; }],
    ['missing taxes', (cart) => { delete cart.totalTax; }],
    ['missing subtotal', (cart) => { delete cart.subtotal; }],
    ['negative subtotal', (cart) => { cart.subtotal.excludingTax.value = -10; }],
    ['mixed currency', (cart) => { cart.subtotal.excludingTax.currency = 'EUR'; }],
    ['null money', (cart) => { cart.subtotal.excludingTax.value = null; }],
  ])('uses the exact Grand Total fallback for %s', (_label, changeCart) => {
    const block = loadStripeExpressCheckoutBlock();
    const { cart, method } = summaryFixture();
    changeCart(cart);
    const rows = block.summary.buildOrderSummary(cart, method, {
      subtotal: 'EXCLUDING_TAX', shipping: 'EXCLUDING_TAX',
    });
    expect(rows).toEqual([
      { name: 'Grand Total', amount: Math.round(cart.total.includingTax.value * 100) },
    ]);
    expect(rows.every((row) => row.amount >= 0)).toBe(true);
  });

  test('uses item row totals and applied taxes when cart aggregates are absent', () => {
    const block = loadStripeExpressCheckoutBlock();
    const { cart, method } = summaryFixture();
    delete cart.subtotal;
    delete cart.totalTax;
    cart.items = [{
      quantity: 2,
      rowTotal: { value: 10, currency: 'USD' },
      rowTotalIncludingTax: { value: 10.60, currency: 'USD' },
    }];
    cart.appliedTaxes = [{ amount: { value: 0.60, currency: 'USD' } },
      { amount: { value: 0.23, currency: 'USD' } }];
    expect(block.summary.buildOrderSummary(cart, method, {
      subtotal: 'INCLUDING_TAX', shipping: 'EXCLUDING_TAX',
    }).map((row) => row.amount)).toEqual([1060, 500, 23]);
  });

  test.each([
    ['JPY', 1000, 60, 1060],
    ['KWD', 1.111, 0.056, 1167],
  ])('reconciles virtual-cart line items in %s minor units', (currency, subtotal, tax, total) => {
    const block = loadStripeExpressCheckoutBlock();
    const { cart } = summaryFixture();
    const factor = currency === 'JPY' ? 1 : 1000;
    cart.total.includingTax = { value: total / factor, currency };
    cart.subtotal.excludingTax = { value: subtotal, currency };
    cart.totalTax = { value: tax, currency };
    expect(block.summary.buildOrderSummary(cart, null, { subtotal: 'EXCLUDING_TAX' }, true))
      .toEqual([{ name: 'Subtotal', amount: Math.round(subtotal * factor) },
        { name: 'Tax', amount: Math.round(tax * factor) }]);
  });

  test('uses fresh line items on click when shipping changes but the total does not', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const fixture = summaryFixture();
    await renderAndMount(block, fixture);
    const renamedMethod = { ...fixture.method, title: 'Express' };
    await block.events.emit('checkout/updated', checkoutPayload({
      shippingAddress: {
        ...fixture.checkout.shippingAddress,
        selectedShippingMethod: renamedMethod,
        availableShippingMethods: [renamedMethod],
      },
    }));
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(event.resolve.mock.calls[0][0].lineItems[1]).toEqual({
      name: 'Shipping & Handling (Flat Rate - Express)', amount: 500,
    });
  });

  test('includes a Discount row reflecting the applied coupon', async () => {
    const block = loadStripeExpressCheckoutBlock();
    const fixture = summaryFixture();
    fixture.cart.discount.value = 2;
    fixture.cart.total.includingTax.value = 13.83;
    await renderAndMount(block, fixture);
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1383 }),
    );
    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [
        { name: 'Subtotal', amount: 1000 },
        { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 500 },
        { name: 'Tax', amount: 83 },
        { name: 'Discount', amount: -200 },
      ],
    });
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
  });

  test.each([
    ['an unrepresented fee', (cart) => { cart.total.includingTax.value = 18.83; }],
    ['missing tax data', (cart) => { delete cart.totalTax; }],
    ['missing subtotal data', (cart) => { delete cart.subtotal; }],
  ])('does not change the authoritative wallet amount for %s', async (_label, changeCart) => {
    const block = loadStripeExpressCheckoutBlock();
    const fixture = summaryFixture();
    changeCart(fixture.cart);
    await renderAndMount(block, fixture);
    const amount = Math.round(fixture.cart.total.includingTax.value * 100);
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(expect.objectContaining({ amount }));
    expect(event.resolve).toHaveBeenCalledWith({ lineItems: [{ name: 'Grand Total', amount }] });
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
  });

  test('uses the inclusive shipping display without changing the charged total', async () => {
    const block = loadStripeExpressCheckoutBlock({
      displaySettings: { subtotal: 'INCLUDING_TAX', shipping: 'INCLUDING_TAX' },
    });
    const fixture = summaryFixture();
    fixture.method.amount = fixture.method.amountInclTax;
    await renderAndMount(block, fixture);
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [
        { name: 'Subtotal', amount: 1060 },
        { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 523 },
      ],
    });
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1583 }),
    );
  });

  test('does not block wallet mounting when tax-display settings are unavailable', async () => {
    const block = loadStripeExpressCheckoutBlock();
    block.mocks.cartApi.getStoreConfig.mockRejectedValue(new Error('Unavailable'));
    await renderAndMount(block, summaryFixture());
    const event = { resolve: jest.fn() };
    await getHandler(block, 'click')(event);
    expect(event.resolve).toHaveBeenCalledWith({
      lineItems: [{ name: 'Grand Total', amount: 1583 }],
    });
  });

  test.each([false, true])('retains Magento total across Amazon estimates (discount: %s)', async (discounted) => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    const fixture = summaryFixture();
    if (discounted) {
      fixture.cart.total.includingTax.value = 13.83;
      fixture.cart.discount.value = 2;
    }
    await renderAndMount(block, fixture);
    const amount = discounted ? 1383 : 1583;
    const lineItems = [
      { name: 'Subtotal', amount: 1000 },
      { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 500 },
      { name: 'Tax', amount: 83 },
      ...(discounted ? [{ name: 'Discount', amount: -200 }] : []),
    ];
    const expensiveMethod = {
      ...tableRateShippingMethod(),
      amountExclTax: { value: 15, currency: 'USD' },
      amountInclTax: { value: 15.69, currency: 'USD' },
    };
    block.mocks.checkoutApi.estimateShippingMethods.mockResolvedValue([expensiveMethod]);
    const event = {
      address: { country: 'US', state: 'MI', postal_code: '48201' },
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingaddresschange', 'amazon')(event);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith(expect.objectContaining({ amount }));
    expect(block.elements.update).not.toHaveBeenCalled();
    expect(block.amazonElements.update).not.toHaveBeenCalled();
    expect(event.resolve.mock.calls[0][0].lineItems).toEqual(lineItems);
    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    const rateEvent = {
      shippingRate: event.resolve.mock.calls[0][0].shippingRates[0],
      resolve: jest.fn(),
      reject: jest.fn(),
    };
    await getHandler(block, 'shippingratechange', 'amazon')(rateEvent);
    expect(rateEvent.resolve.mock.calls[0][0].lineItems).toEqual(lineItems);
    expect(block.mocks.checkoutApi.setShippingMethods).not.toHaveBeenCalled();
    expect(block.elements.update).not.toHaveBeenCalled();
    expect(block.amazonElements.update).not.toHaveBeenCalled();
  });

  test('aligns both wallet amounts and the fallback on Amazon click after a cart change', async () => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    const fixture = summaryFixture();
    await renderAndMount(block, fixture);
    await getHandler(block, 'click', 'amazon')({ resolve: jest.fn() });
    await block.events.emit('cart/updated', {
      ...fixture.cart,
      total: { includingTax: { value: 13.83, currency: 'USD' } },
      discount: { value: 2, currency: 'USD' },
    });
    expect(block.amazonElements.update).not.toHaveBeenCalled();

    const event = { resolve: jest.fn() };
    await getHandler(block, 'click', 'amazon')(event);

    expect(block.elements.update).toHaveBeenLastCalledWith({ amount: 1383 });
    expect(block.amazonElements.update).toHaveBeenLastCalledWith({ amount: 1383 });
    expect(event.resolve).toHaveBeenCalledWith(expect.objectContaining({
      lineItems: [
        { name: 'Subtotal', amount: 1000 },
        { name: 'Shipping & Handling (Flat Rate - Fixed)', amount: 500 },
        { name: 'Tax', amount: 83 },
        { name: 'Discount', amount: -200 },
      ],
    }));
  });

  test.each(['primary', 'amazon'])('rejects %s click if the cart currency changed while the wallet was open', async (wallet) => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    await renderAndMount(block, summaryFixture());
    await getHandler(block, 'click', wallet)({ resolve: jest.fn() });
    await block.events.emit('cart/updated', cartPayload({
      total: { includingTax: { value: 15.83, currency: 'EUR' } },
    }));
    const event = { resolve: jest.fn(), reject: jest.fn() };

    await getHandler(block, 'click', wallet)(event);

    expect(event.resolve).not.toHaveBeenCalled();
    expect(event.reject).toHaveBeenCalledTimes(1);
    expect(block.elements.update).not.toHaveBeenCalled();
    expect(block.amazonElements.update).not.toHaveBeenCalled();
  });

  test.each([
    [
      'second street line',
      {
        name: 'Ada Lovelace',
        address: {
          line1: '',
          line2: '1 Algorithm Way',
          city: 'London',
          country: 'GB',
          postal_code: 'SW1A 1AA',
        },
      },
    ],
    [
      'Amazon aliases',
      {
        name: 'Ada Lovelace',
        addressLine1: '1 Algorithm Way',
        city: 'London',
        countryCode: 'GB',
        postalCode: 'SW1A 1AA',
      },
    ],
    ['empty wallet address', {}],
  ])('preserves Amazon address compatibility for %s', async (_label, shippingAddress) => {
    const block = loadStripeExpressCheckoutBlock({ separateWalletInstances: true });
    await renderAndMount(block);
    const event = createConfirmEvent({ shippingAddress });
    await getHandler(block, 'confirm', 'amazon')(event);

    expect(block.stripeInstance.createConfirmationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: block.amazonElements,
        params: expect.objectContaining({
          shipping: expect.objectContaining({
            address: expect.objectContaining({ line1: '1 Algorithm Way', country: 'GB' }),
          }),
        }),
      }),
    );
    expect(block.mocks.checkoutApi.setShippingAddress).not.toHaveBeenCalled();
    expect(event.paymentFailed).not.toHaveBeenCalled();
  });
});
