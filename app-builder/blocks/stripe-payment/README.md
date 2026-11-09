# Stripe EDS Block

An injectable EDS block by Stripe that provides encapsulated, reusable payment functionality, such as
rendering the payment form, processing payments and handling payment errors.

## Installation and usage

### Add the block to your EDS storefront

If you have not set up your EDS storefront yet,

- [See an overview](https://experienceleague.adobe.com/developer/commerce/storefront/get-started/) of the EDS storefront architecture.
- [Install dependencies](https://github.com/adobe-commerce/aio-cli-plugin-commerce?tab=readme-ov-file#prerequisites) required to set up an EDS storefront locally.
- Set up the EDS storefront using the below commands:

  ```sh
  # Run these commands from your desired project directory
  aio login
  gh auth login
  aio commerce init
  git clone git@github.com:user/initialized-eds-storefront.git
  cd initialized-eds-storefront

  # Run from the EDS storefront root directory
  npm start
  ```

With your EDS storefront set up, copy the `blocks/stripe-payment/` folder from the app into your EDS project's `blocks/stripe-payment/` directory.

### Extend the OOPE GraphQL Schema

Stripe requires initialization data from the Adobe Commerce GraphQL API.
You can extend the GraphQL schema to return that data by making the below adjustments:

1. In `build.mjs` at the root folder of your EDS Storefront, add the following code to extend the OOPE GraphQL schema:

```js
overrideGQLOperations([
  {
    npm: "@dropins/storefront-checkout",
    operations: [
      `
  fragment CHECKOUT_DATA_FRAGMENT on Cart {
    available_payment_methods {
      code
      title
      oope_payment_method_config {
        backend_integration_url
        custom_config {
          ... on CustomConfigKeyValue {
              key
              value
          }
        }
      }
    }
    selected_payment_method {
      code
      title
      oope_payment_method_config {
        backend_integration_url
        custom_config {
          ... on CustomConfigKeyValue {
              key
              value
          }
        }
      }
    }
  }
`,
    ],
  },
]);
```

2. Build the new schema by running `npm install` from the EDS storefront root directory. If successful, the new fragments will be added
   inside `scripts/__dropins__/storefront-checkout/fragments.js`.

3. The new data in the updated schema must be allowed through the checkout's data transformer.
   Edit your `scripts/initializers/checkout.js` to allow the data through the transformer.

```js
await initializeDropin(async () => {
  ...
  return initializers.mountImmediately(initialize, {
      langDefinitions,
      models: {
        CartModel: {
            transformer: (data) => {
              return {
                  availablePaymentMethods: data?.available_payment_methods,
                  selectedPaymentMethod: data?.selected_payment_method,
              };
            },
        },
      },
  });
})();
```

### Integrate the Stripe EDS block into your commerce-checkout block:

A boilerplate Commerce EDS storefront will use the `commerce-checkout` block which is located under
`blocks/commerce-checkout/commerce-checkout.js`. You can integrate this with
Stripe by making some simple adjustments.

First, import the Stripe block's javascript component:

```javascript
import * as stripe from "../stripe-payment/stripe-payment.js";
```

Next, find the payment methods renderer and add a slot for the `oope_stripe` payment method code:

```javascript
CheckoutProvider.render(PaymentMethods, {
  slots: {
    Methods: {
      ...
      oope_stripe: {
        render: stripe.renderStripePaymentMethod,
      },
      ...
    },
  },
})
```

Finally, extend your `handlePlaceOrder` method to call the Stripe drop-in methods:

```javascript
CheckoutProvider.render(PlaceOrder, {
  handlePlaceOrder: async ({ cartId, code }) => {
    ...
    if (code === 'oope_stripe') {
      if (!await stripe.handleStripePayment(cartId)) {
        return;
      }
    }
    ...
    await orderApi.placeOrder(cartId);
  },
})
```

### Runtime action URLs

The block reads the App Builder action URLs from the `oope_payment_method_config.backend_integration_url`
value returned by Commerce GraphQL. Do not hard-code or override these URLs in the storefront; configure the Stripe
app in Commerce/App Management so the storefront receives trusted runtime URLs from Commerce.

The block also forwards the authenticated customer token from the storefront auth drop-in and the active `store-view`
as the `Store` header to the App Builder `payment-intent` action.

### Payment lifecycle

The block uses deferred-intent Elements, so no PaymentIntent exists while the shopper is still filling in checkout:

1. The block fetches `init-params` and mounts the Payment Element with `stripe.elements({ mode: 'payment', amount, currency })`.
   The amount is the cart's `total.includingTax`, converted to Stripe minor units (zero- and three-decimal currencies
   are handled), and it is kept in sync with `cart/updated` until a PaymentIntent exists.
2. On Place Order, `handleStripePayment()` first calls `elements.submit()` so Stripe validates the form.
3. Only then does the block call the `payment-intent` action, persist the returned client secret on the Commerce cart,
   and confirm with `stripe.confirmPayment()`.

`init-params` returns `elementsOptions.captureMethod` (`"automatic"` or `"manual"`). The block passes it as the top-level
`captureMethod` of `stripe.elements()`. Stripe.js rejects confirmation when it differs from the PaymentIntent's
`capture_method`, so it must come from the same App Builder configuration that creates the PaymentIntent. Do not nest
`capture_method` inside `paymentMethodOptions`.

Requests to App Builder time out after 15 seconds, and Stripe.js is loaded once and shared with the Express Checkout block.

## Styling

Customize the appearance by modifying `blocks/stripe-payment/stripe-payment.css`.
