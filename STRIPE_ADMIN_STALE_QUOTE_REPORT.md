# Stripe admin notification rendering loads a stale backend quote

## Summary

Rendering Magento admin notification messages can instantiate
`StripeIntegration\Payments\Helper\Quote` on admin pages unrelated to order creation. Its constructor
immediately resolves the subscriptions configuration scope through
`StripeIntegration\Payments\Helper\Store::getStoreId()`.

For admin requests without an `order_id`, `invoice_id`, `creditmemo_id`, or `shipment_id`,
`getStoreId()` assumes that a new admin order is being created and calls
`Magento\Backend\Model\Session\Quote::getQuote()`. If the backend session retains an ID for a quote
that has since been removed, Magento throws:

```text
Magento\Framework\Exception\NoSuchEntityException: No such entity with cartId = <stale-id>
```

The exception can recur whenever an open admin session refreshes its notification area. The same
unguarded path is present in Connector 4.5.10 and the published 4.6.5 package.

## Affected code in 4.6.5

`app/code/StripeIntegration/Payments/Helper/Quote.php` resolves configuration in its constructor:

```php
$this->isSubscriptionsEnabled = $configHelper->getConfigData(
    "payment/stripe_payments_subscriptions/active",
    $storeHelper->getStoreId()
);
```

`app/code/StripeIntegration/Payments/Helper/Store.php` treats every other admin request as an admin
order-creation request:

```php
else
{
    // Creating a new order
    $quote = $this->backendSessionQuote->getQuote();
    return $quote->getStoreId();
}
```

The backend quote session delegates to `QuoteRepository::get()`, which throws when the retained quote
ID no longer exists. This happens while Magento's `Notification\MessageList` builds admin system
messages, before Stripe functionality on the requested page is used.

## Reproduction

1. Open the Magento admin and start creating an order so the backend quote session stores a quote ID.
2. Remove that quote through normal quote cleanup or another process while retaining the same admin
   session.
3. Request an admin page that renders the notification area and has none of the sales entity request
   parameters checked by `Helper\Store::getStoreId()`.
4. Inspect `var/log/exception.log`.

The request fails while constructing Stripe's quote helper, with
`Backend\Model\Session\Quote::getQuote()` attempting to load the missing quote ID. An admin page left
open can generate the same exception repeatedly as its notification area refreshes.

## Expected behavior

Loading Stripe admin system messages on a page unrelated to order creation should not require a
backend-session quote. A missing historical backend quote should not prevent the notification area
or page from rendering.

Possible handling options include:

- use the backend quote only when the current route is actually creating an admin order, and use the
  current/default store scope for unrelated admin requests;
- catch `NoSuchEntityException` around the backend-session quote lookup and fall back to the
  current/default store scope; or
- defer the subscriptions configuration lookup until quote functionality is used instead of doing
  it in the helper constructor.

## Validation performed

- Confirmed the complete call stack from `Notification\MessageList` through
  `Helper\Quote::__construct()`, `Helper\Store::getStoreId()`, the backend quote session, and
  `QuoteRepository::get()`.
- Observed the same retained quote ID generating repeated exceptions from one admin session over
  multiple days.
- Confirmed that Connector 4.5.10 contains the unguarded lookup.
- Downloaded the official latest package and confirmed Connector 4.6.5 contains the same lookup.
- Confirmed successful Stripe webhook processing during the affected period; this report concerns
  admin rendering rather than payment capture or webhook delivery.
