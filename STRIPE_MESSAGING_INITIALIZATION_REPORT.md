# Stripe messaging components dereference a null Stripe instance

## Summary

The product, mini-cart, and cart payment-method messaging components call
`stripe.stripeJs.elements()` even when `stripe.initStripe()` reports an error and leaves
`stripe.stripeJs` as `null`.

The resulting exception is caught by `get-stripe-configuration.js` and reported as a JSON parsing
failure, although the configuration response was parsed successfully:

```text
Failed to parse Stripe configuration: TypeError: Cannot read properties of null (reading 'elements')
```

This was reproduced with Connector versions 4.6.2 and 4.6.4. It can affect every storefront page
because the mini-cart messaging component is registered in the default frontend layout.

## Affected code in 4.6.4

The callbacks accept `err` but do not check it before accessing `stripe.stripeJs`:

- `view/frontend/web/js/view/product/payment_method_messaging_element.js:24-25`
- `view/frontend/web/js/view/checkout/cart/payment_method_messaging_element_minicart.js:49-50`
- `view/frontend/web/js/view/checkout/cart/payment_method_messaging_element_cart.js:65-66`

The misleading parse message originates in
`view/frontend/web/js/action/get-stripe-configuration.js:15-21`, where the callback invocation is
inside the same `try` block as `JSON.parse()`.

## Reproduction

1. Enable Stripe payment-method messaging on a product page or in the mini-cart.
2. Cause Stripe initialization to fail, for example by blocking `https://js.stripe.com/v3/` or by
   loading the storefront without a usable publishable key.
3. Open a product page, or any page that initializes the mini-cart component.
4. Inspect the browser console.

The configuration endpoint can still return HTTP 200 with valid JSON. `initStripe()` catches the
initialization exception and invokes its callback with an error, but the messaging component ignores
that error and calls `.elements()` on the null instance.

## Expected behavior

Optional messaging widgets should stop initialization when Stripe.js is unavailable, without
breaking the page or producing a misleading configuration parse error. Checkout payment renderers
already check the `err` argument and should retain their existing user-facing error handling.

The messaging callbacks can follow the same contract:

```javascript
stripe.initStripe(configuration, function (err) {
    if (err || !stripe.stripeJs) {
        return;
    }

    // Initialize the messaging element.
});
```

Separating `JSON.parse(response)` from the consumer callback would also ensure callback exceptions
are not labeled as parsing failures.

## Validation performed

- Confirmed the same unchecked callbacks in the published 4.6.2 and 4.6.4 packages.
- Reproduced the null dereference on Magento 2.4.9 in developer mode.
- Verified that guarding failed initialization removes the console exception under both a missing-key
  response and a simulated unavailable Stripe.js script.
