const fs = require("fs");
const path = require("path");
const vm = require("vm");

const STRIPE_BLOCK_PATH = path.join(__dirname, "stripe-payment.js");

function flushPromises() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
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
    id: "",
    className: "",
    textContent: "",
    innerHTML: "",
    parentElement: null,
    scrollIntoView: jest.fn(),
    classList: {
      add: jest.fn((className) => {
        element.className = [element.className, className]
          .filter(Boolean)
          .join(" ");
      }),
      remove: jest.fn((className) => {
        element.className = element.className
          .split(" ")
          .filter((value) => value && value !== className)
          .join(" ");
      }),
    },
    appendChild: jest.fn((child) => {
      child.parentElement = element;
      element.children.push(child);
      return child;
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
      const className = selector.startsWith(".") ? selector.slice(1) : selector;
      let current = element;
      while (current) {
        if ((current.className || "").split(" ").includes(className)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }),
    querySelector: jest.fn((selector) => findElement(element, selector)),
  };

  return element;
}

function findElement(root, selector) {
  const isIdSelector = selector.startsWith("#");
  const selectorValue = selector.slice(1);
  const matches = (element) => {
    if (isIdSelector) {
      return element.id === selectorValue;
    }
    return (element.className || "").split(" ").includes(selectorValue);
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
  const body = createElement("body");
  const head = createElement("head");

  return {
    body,
    head,
    cookie: "",
    createElement: jest.fn(createElement),
    querySelector: jest.fn((selector) => findElement(body, selector)),
  };
}

function transformStripeBlockSource(source) {
  return source
    .replace(
      /import \{ events \} from ['"]@dropins\/tools\/event-bus\.js['"];/,
      "const { events } = __mocks;",
    )
    .replace(
      /import \* as checkoutApi from ['"]@dropins\/storefront-checkout\/api\.js['"];/,
      "const { checkoutApi } = __mocks;",
    )
    .replace(
      /import \{ loadCSS \} from ['"]\.\.\/\.\.\/scripts\/aem\.js['"];/,
      "const { loadCSS } = __mocks;",
    )
    .replace(
      /export \{\s*renderStripePaymentMethod,\s*handleStripePayment,\s*validateStripePayment,\s*\};/,
      "Object.assign(__exports, { renderStripePaymentMethod, handleStripePayment, validateStripePayment });",
    )
    .replace(
      "export default function decorate(block) {",
      "function decorate(block) {",
    )
    .concat("\n__exports.default = decorate;\n");
}

function initParamsPayload(elementsOptions) {
  return {
    publishableKey: "pk_test_123",
    options: { locale: "auto" },
    appInfo: { name: "Stripe Adobe Commerce App Builder" },
    ...(elementsOptions ? { elementsOptions } : {}),
  };
}

function paymentIntentResponse() {
  return {
    ok: true,
    json: async () => ({
      client_secret: "pi_123_secret_abc",
      return_url: "https://runtime.example/payment-return?cart_id=cart_123",
    }),
  };
}

function loadStripePaymentBlock({
  search = "",
  initParams = initParamsPayload(),
  onPaymentIntent = paymentIntentResponse,
  stripeLoaded = true,
  sharedLoadingPromise = undefined,
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
  const localStorage = createStorage({ "store-view": "de_store" });
  const sessionStorage = createStorage();

  const paymentElement = {
    mount: jest.fn(),
    on: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };
  let paymentElementChangeHandler = null;
  paymentElement.on.mockImplementation((eventName, handler) => {
    if (eventName === "change") {
      paymentElementChangeHandler = handler;
    }
  });

  const elements = {
    create: jest.fn(() => paymentElement),
    submit: jest.fn().mockResolvedValue({}),
    update: jest.fn(),
  };
  const stripeInstance = {
    registerAppInfo: jest.fn(),
    elements: jest.fn(() => elements),
    confirmPayment: jest
      .fn()
      .mockResolvedValue({ paymentIntent: { id: "pi_123" } }),
  };

  const timers = [];
  const fetch = jest.fn(async (url, options) => {
    if (url.endsWith("/init-params")) {
      return {
        ok: true,
        json: async () => initParams,
        options,
      };
    }

    if (url.endsWith("/payment-intent")) {
      return onPaymentIntent(options);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const context = {
    __exports: {},
    __mocks: {
      events,
      checkoutApi: {
        setPaymentMethod: jest.fn().mockResolvedValue({ success: true }),
      },
      loadCSS: jest.fn(),
    },
    AbortController,
    console,
    document,
    fetch,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: jest.fn(),
    URLSearchParams,
    window: {
      location: { search },
      localStorage,
      sessionStorage,
      setTimeout: jest.fn((callback, delay) => {
        timers.push({ callback, delay });
        return timers.length;
      }),
      clearTimeout: jest.fn(),
      ...(sharedLoadingPromise
        ? { __stripeJsLoadingPromise: sharedLoadingPromise }
        : {}),
    },
  };
  if (stripeLoaded) {
    context.Stripe = jest.fn(() => stripeInstance);
  }

  vm.createContext(context);
  const source = transformStripeBlockSource(
    fs.readFileSync(STRIPE_BLOCK_PATH, "utf8"),
  );
  new vm.Script(source, { filename: STRIPE_BLOCK_PATH }).runInContext(context);

  return {
    exports: context.__exports,
    mocks: context.__mocks,
    events,
    document,
    window: context.window,
    localStorage,
    fetch,
    timers,
    elements,
    paymentElement,
    stripeInstance,
    Stripe: context.Stripe,
    emitPaymentComplete: () => paymentElementChangeHandler({ complete: true }),
    paymentIntentCalls: () =>
      fetch.mock.calls.filter(([url]) => url.endsWith("/payment-intent")),
    errorText: () =>
      document.querySelector(".stripe-error")?.textContent || null,
  };
}

function checkoutPayload() {
  return {
    email: "customer@example.com",
    availablePaymentMethods: [
      {
        code: "oope_stripe",
        oope_payment_method_config: {
          backend_integration_url: JSON.stringify({
            getInitParamsUrl: "https://commerce-config.example/init-params",
            createPaymentIntentUrl:
              "https://commerce-config.example/payment-intent",
          }),
        },
      },
    ],
    billingAddress: {
      firstName: "Ada",
      lastName: "Lovelace",
      telephone: "",
      street: ["1 Algorithm Way", ""],
      city: "London",
      region: { code: "" },
      country: { code: "GB" },
      postcode: "SW1A 1AA",
    },
    shippingAddress: {
      firstName: "Ada",
      lastName: "Lovelace",
      telephone: "020 7946 0000",
      street: ["1 Algorithm Way", ""],
      city: "London",
      region: { code: "" },
      country: { code: "GB" },
      postcode: "SW1A 1AA",
    },
  };
}

function cartPayload({ value = 42, currency = "USD" } = {}) {
  return {
    id: "cart_123",
    total: { includingTax: { value, currency } },
  };
}

function createCtx(block) {
  return {
    replaceHTML: jest.fn((content) => {
      block.document.body.appendChild(content);
    }),
  };
}

// Checkout and cart data arrive before the slot renders, as on the real page.
async function renderAndMount(
  block,
  { cart = cartPayload(), checkout = checkoutPayload() } = {},
) {
  await block.events.emit("checkout/initialized", checkout);
  await block.events.emit("cart/initialized", cart);

  block.exports.renderStripePaymentMethod(createCtx(block));
  await flushPromises();
}

describe("stripe-payment EDS block", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(console.error).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  test("mounts deferred Elements from the cart total without creating a PaymentIntent", async () => {
    const block = loadStripePaymentBlock({
      search:
        "?stripeAppBuilderBaseUrl=https://untrusted.example/api/v1/web/stripe/",
    });

    await renderAndMount(block);

    expect(block.fetch).toHaveBeenCalledWith(
      "https://commerce-config.example/init-params",
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(block.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("untrusted.example"),
      expect.anything(),
    );
    expect(block.paymentIntentCalls()).toHaveLength(0);
    expect(block.Stripe).toHaveBeenCalledWith("pk_test_123", {
      locale: "auto",
    });
    expect(block.stripeInstance.registerAppInfo).toHaveBeenCalledWith({
      name: "Stripe Adobe Commerce App Builder",
    });
    expect(block.stripeInstance.elements).toHaveBeenCalledTimes(1);
    expect(block.stripeInstance.elements).toHaveBeenCalledWith({
      mode: "payment",
      amount: 4200,
      currency: "usd",
    });
    expect(block.stripeInstance.elements.mock.calls[0][0]).not.toHaveProperty(
      "clientSecret",
    );
    expect(block.stripeInstance.elements.mock.calls[0][0]).not.toHaveProperty(
      "captureMethod",
    );
    expect(block.paymentElement.mount).toHaveBeenCalledWith(
      "#stripe-elements-container",
    );
    expect(block.mocks.checkoutApi.setPaymentMethod).not.toHaveBeenCalled();
    expect(block.localStorage.setItem).not.toHaveBeenCalled();
  });

  test.each(["manual", "automatic"])(
    "passes %s capture from init-params as top-level Elements captureMethod",
    async (captureMethod) => {
      const block = loadStripePaymentBlock({
        initParams: initParamsPayload({
          captureMethod,
          paymentMethodOptions: {
            us_bank_account: { verification_method: "instant" },
          },
        }),
      });

      await renderAndMount(block);

      expect(block.stripeInstance.elements).toHaveBeenCalledWith({
        mode: "payment",
        amount: 4200,
        currency: "usd",
        captureMethod,
      });
    },
  );

  test.each([
    ["USD", 42, 4200, "usd"],
    ["EUR", 19.99, 1999, "eur"],
    ["JPY", 4200, 4200, "jpy"],
    ["KWD", 4.2, 4200, "kwd"],
  ])(
    "converts a %s cart total of %s to %s minor units",
    async (currency, value, amount, stripeCurrency) => {
      const block = loadStripePaymentBlock();

      await renderAndMount(block, { cart: cartPayload({ value, currency }) });

      expect(block.stripeInstance.elements).toHaveBeenCalledWith({
        mode: "payment",
        amount,
        currency: stripeCurrency,
      });
    },
  );

  test("does not initialize Elements when the cart total is unavailable", async () => {
    const block = loadStripePaymentBlock();

    await renderAndMount(block, { cart: { id: "cart_123" } });

    expect(block.stripeInstance.elements).not.toHaveBeenCalled();
    expect(block.paymentElement.mount).not.toHaveBeenCalled();
    expect(block.paymentIntentCalls()).toHaveLength(0);
    expect(block.errorText()).toBe(
      "Unable to initialize payment form. Please refresh and try again.",
    );
    // The block reports the unusable total instead of failing silently.
    expect(console.error).toHaveBeenCalledWith(
      "Error initializing Stripe payment form:",
      expect.objectContaining({
        message: "Cart total is unavailable for Stripe payment initialization.",
      }),
    );
    console.error.mockClear();
  });

  test("creates the PaymentIntent only on submit, after Stripe validates the form", async () => {
    const block = loadStripePaymentBlock();
    block.document.cookie = "auth_dropin_user_token=customer-token-123";

    await renderAndMount(block);
    expect(block.paymentIntentCalls()).toHaveLength(0);

    block.emitPaymentComplete();
    await expect(block.exports.handleStripePayment("cart_123")).resolves.toBe(
      true,
    );

    expect(block.elements.submit).toHaveBeenCalledTimes(1);
    expect(block.paymentIntentCalls()).toHaveLength(1);
    expect(block.paymentIntentCalls()[0]).toEqual([
      "https://commerce-config.example/payment-intent",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer customer-token-123",
          Store: "de_store",
        },
        body: JSON.stringify({
          cartId: "cart_123",
          cartFullName: "Ada Lovelace",
        }),
      }),
    ]);

    // Stripe validates the form before the backend creates a PaymentIntent.
    const paymentIntentCallIndex = block.fetch.mock.calls.findIndex(([url]) =>
      url.endsWith("/payment-intent"),
    );
    expect(block.elements.submit.mock.invocationCallOrder[0]).toBeLessThan(
      block.fetch.mock.invocationCallOrder[paymentIntentCallIndex],
    );

    expect(block.stripeInstance.confirmPayment).toHaveBeenCalledWith({
      elements: block.elements,
      redirect: "if_required",
      clientSecret: "pi_123_secret_abc",
      confirmParams: {
        return_url: "https://runtime.example/payment-return?cart_id=cart_123",
        payment_method_data: {
          billing_details: {
            name: "Ada Lovelace",
            email: "customer@example.com",
            address: {
              line1: "1 Algorithm Way",
              city: "London",
              country: "GB",
              postal_code: "SW1A 1AA",
            },
          },
        },
      },
    });
    expect(block.mocks.checkoutApi.setPaymentMethod).toHaveBeenCalledTimes(1);
    expect(block.mocks.checkoutApi.setPaymentMethod).toHaveBeenCalledWith({
      code: "oope_stripe",
      additional_data: [{ key: "client_secret", value: "pi_123_secret_abc" }],
    });
  });

  test("blocks order placement until the Stripe Payment Element is complete", async () => {
    const block = loadStripePaymentBlock();

    await renderAndMount(block);

    await expect(block.exports.handleStripePayment("cart_123")).resolves.toBe(
      false,
    );

    expect(block.elements.submit).not.toHaveBeenCalled();
    expect(block.paymentIntentCalls()).toHaveLength(0);
    expect(block.stripeInstance.confirmPayment).not.toHaveBeenCalled();
    expect(block.errorText()).toBe("Please complete your payment details");
  });

  test("does not create a PaymentIntent when Stripe rejects the form", async () => {
    const block = loadStripePaymentBlock();
    block.elements.submit.mockResolvedValue({
      error: { message: "Your card number is incomplete." },
    });

    await renderAndMount(block);

    block.emitPaymentComplete();
    await expect(block.exports.handleStripePayment("cart_123")).resolves.toBe(
      false,
    );

    expect(block.paymentIntentCalls()).toHaveLength(0);
    expect(block.stripeInstance.confirmPayment).not.toHaveBeenCalled();
    expect(block.errorText()).toBe("Your card number is incomplete.");
  });

  test("shows the backend error and does not confirm when PaymentIntent creation fails", async () => {
    const block = loadStripePaymentBlock({
      onPaymentIntent: async () => ({
        ok: false,
        json: async () => ({ error: "Customer name is required." }),
      }),
    });

    await renderAndMount(block);

    block.emitPaymentComplete();
    await expect(block.exports.handleStripePayment("cart_123")).resolves.toBe(
      false,
    );

    expect(block.stripeInstance.confirmPayment).not.toHaveBeenCalled();
    expect(block.mocks.checkoutApi.setPaymentMethod).not.toHaveBeenCalled();
    expect(block.errorText()).toBe("Customer name is required.");
  });

  test("stops waiting for the backend after the request timeout", async () => {
    const block = loadStripePaymentBlock({
      onPaymentIntent: ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });

    await renderAndMount(block);

    block.emitPaymentComplete();
    const payment = block.exports.handleStripePayment("cart_123");
    await flushPromises();

    // The init-params request used the first timer; the pending PaymentIntent
    // request holds the latest one.
    const requestTimers = block.timers.filter(({ delay }) => delay === 15000);
    expect(requestTimers.length).toBeGreaterThanOrEqual(2);
    requestTimers[requestTimers.length - 1].callback();

    await expect(payment).resolves.toBe(false);
    expect(block.errorText()).toBe(
      "Stripe did not respond in time. Please try again.",
    );
    expect(block.stripeInstance.confirmPayment).not.toHaveBeenCalled();
  });

  test("keeps the Elements amount in sync with the cart until a PaymentIntent exists", async () => {
    const block = loadStripePaymentBlock();

    await renderAndMount(block);
    expect(block.elements.update).not.toHaveBeenCalled();

    await block.events.emit(
      "cart/updated",
      cartPayload({ value: 57.5, currency: "USD" }),
    );
    expect(block.elements.update).toHaveBeenCalledTimes(1);
    expect(block.elements.update).toHaveBeenLastCalledWith({
      amount: 5750,
      currency: "usd",
    });

    // Once a PaymentIntent is pending its amount is fixed, so Elements must
    // not drift away from it.
    block.stripeInstance.confirmPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });
    block.emitPaymentComplete();
    await expect(block.exports.handleStripePayment("cart_123")).resolves.toBe(
      false,
    );
    await block.events.emit("cart/updated", cartPayload({ value: 99 }));

    expect(block.elements.update).toHaveBeenCalledTimes(1);
  });

  test("loads Stripe.js once and reuses a load already started by another block", async () => {
    const own = loadStripePaymentBlock({ stripeLoaded: false });

    await own.events.emit("checkout/initialized", checkoutPayload());
    await own.events.emit("checkout/updated", checkoutPayload());

    const scripts = own.document.head.children.filter(
      (element) => element.tagName === "script",
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://js.stripe.com/v3/");
    // The promise is shared on window so the express-checkout block can reuse it.
    expect(typeof own.window.__stripeJsLoadingPromise?.then).toBe("function");

    const shared = loadStripePaymentBlock({
      stripeLoaded: false,
      sharedLoadingPromise: new Promise(() => {}),
    });

    await shared.events.emit("checkout/initialized", checkoutPayload());

    expect(
      shared.document.head.children.filter(
        (element) => element.tagName === "script",
      ),
    ).toHaveLength(0);
  });
});
