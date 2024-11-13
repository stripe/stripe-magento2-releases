# Changelog

## 4.1.7 - 2024-11-13

- Fixed an recurring subscription orders failing to be created if the subscription had customizable options.
- Fixed an internal server error when the charge.refunded webhook event was processed for refunds triggered from the Stripe dashboard.

## 4.1.6 - 2024-10-22

- Subscription initial fees are now compatible with the Stripe Tax submodule.
- Fixed an issue causing some webhook events to not be found across any of the configured Stripe accounts.
- In Adobe Commerce, if store credit, gift cards or reward points were used, Link would appear even if it was disabled.
- Improvements with subscription recurring order creation logic.

## 4.1.5 - 2024-10-16

- Added `resources/cookbooks/` directory with 5 examples of common module customizations.
- Added various new validations for actions in the My Subscriptions section.
- Fixed two issues with subscription initial fee taxes.
- Fixed an issue where in certain checkout flows, the shipping rate of a placed order would be different than the one selected at the checkout.
- Some CSS fixes with Express Checkout on bundle product pages.

## 4.1.4 - 2024-10-14

- Fixed issue with subscription start dates where if bought on the exact start date, the order's grand total would be zero instead of fully paid.
- Added html escaping to various templates.

## 4.1.3 - 2024-10-09

- Express Checkout is now supported on bundle product pages.
- Added MB WAY payment method icons.
- Moved API examples directory under resources/, added new resources/docs/ directory with current version documentation.
- Stricter validations when invoicing admin orders.
- Fixed an issue where after a redirect-based method payment failure, the order would be canceled but not disassociated from the payment intent.
- Fixed a subscriptions issue where the shipping method would be unavailable if a minimum amount is specified for that method's availability.

## 4.1.2 - 2024-09-25

- Subscriptions can now be purchased with 100% discount coupons/rules.
- Fixed a checkout error with Hyva Checkout.
- Fixed Link not being disabled on product pages when its disabled from the admin.
- Fixed an obscured error message at the My Payment Methods section.
- Payment method validation improvements.

## 4.1.1 - 2024-09-20

- Various fixes and improvements with Stripe Checkout (redirect-based payment flow).
- Added a new configuration option in etc/config.xml to control if coupon usages are incremented before or after the order is placed.
- Fixed a tax inclusive issue where Klarna and Google Pay would display the tax exclusive amount instead of the tax inclusive one at the checkout page.
- Fixed error 'The requested qty is not available' affecting bundle products with a Qty of 1, when using Express Checkout.
- Fixed a case where if a subscription payment failed, and the subscription payment method was updated, a recurring order would not be created for the newly collected payment.
- Fixed an issue where reactivating a canceled subscription after payment failure, would enter a trial period instead of collecting a new payment.
- Fixed an issue where printing PDF shipment documents for Stripe Checkout would add escaped html under the payment info section of the shipping document.
- When migrating a subscription using the CLI command stripe:subscriptions:migrate-subscription-price, the newly generated order will no longer reserve order item inventory.
- Fixed an issue with wallets not appearing in the shopping cart page when certain plugin interceptiors are implemented.
- Fixed several cases where Web API errors that should be displayed at the front-end would be masked in production mode.

## 4.1.0 - 2024-09-10

- Added support for Stripe Tax.
- Orders for subscriptions with trial periods, start dates, as well as subscription upgrades/downgrades, will be placed with a grand total of 0 to reflect that no payment has been collected. Recurring subscription orders will be placed with a grand total reflecting the collected payment.
- To better support Stripe Tax, prorated subscription upgrades/downgrades have been temporarily disabled. Only regular subscription upgrades/downgrades are currently supported.

## 4.0.11 - 2024-09-05

- Fixed the "Save payment method" checkbox in the admin new order page.
- Fixed a javascript crash in the admin new order page.

## 4.0.10 - 2024-08-28

- Fixed a product loading error happening in certain edge cases.
- Fixed a CSP policy issue in the admin area.
- Fixed a setup:upgrade issue happening when other modules set the area code.

## 4.0.9 - 2024-08-20

- PayPal can now be saved as a payment method similar to cards.
- Enabled partial refunds for the Bank Transfers payment method.
- Fixed order search filters at the sales orders grid. You can search for orders using queries such as "mastercard", "google pay", "klarna" etc.
- Fixed a bug with Express Checkout Element where if the shipping rate is changed, the total would not update in the payment modal.
- Fixed two issues with 'Payment Action = Order' mode, affecting redirect-based payment methods, where the payment method would fail to be saved.
- Fixed a 3D Secure issue with coupon usage increments.

## 4.0.8 - 2024-07-05

- In four scenarios where saved payment methods are disabled but the PM needs to be saved, the customer would not see the saved PM dropdown at the checkout (affects 4.0.2 - 4.0.7). All four cases will now display the dropdown.
- Added safety checks so that payment method deduplication is skipped when there are pending orders placed with the duplicate payment method.
- Improved error handling when there are no available payment element methods for the given cart amount.
- Added new validations during order placements to handle checkout crashes.
- Fixed an issue with the order recovery system in "Authorize Only" mode.
- Fixed a WeChat error on mobile devices.
- Added new Stripe domains in CSP whitelist.
- Cosmetic improvements in the admin area.

## 4.0.7 - 2024-06-10

- Fixed a problem where if an Express Checkout payment failed, and the customer switched to the PaymentElement, the payment would succeed but a checkout error would prevent the order from being saved (affects 4.0.0 - 4.0.6).

## 4.0.6 - 2024-06-06

- Fixed a webhook signature verification error affecting merchants that have multiple Stripe accounts configured (affects 4.0.0 - 4.0.5).
- Fixed an infinite loop problem when switching from one store view to another. The error would be logged as 'Front controller reached 100 router match iterations'.

## 4.0.5 - 2024-06-05

- The payment method icon and name was not appearing in certain pages and emails (affects 4.0.4).
- Compatibility improvements of Express Checkout with reward points, gift cards, store credit.
- Express Checkout was appearing on the shopping cart page's minicart whereas it should appear on its sidebar.
- Improvements with the webhooks order recovery system.
- Two fixes with subscription reactivations.
- Removed payment location metadata from payment intents.

## 4.0.4 - 2024-05-29

- Added MobilePay icons and MobilePay support for Authorize Only mode.
- Fixed unhandled multi-shipping checkout scenario with redirect payment methods such as PayPal.
- Fixed invoice pdf printing from the admin area. HTML tags were visible under the payment info section (affects 4.0.0 - 4.0.3).

## 4.0.3 - 2024-05-15

- In Adobe Commerce, when a gift card is redeemed, store credit is used, or reward points are applied to the cart, then redirect-based payment methods are automatically hidden at the checkout. Solves quote restoration issues when customers return from the payment provider without a payment authorization.
- Added support for Multibanco voucher-based payment method in Portugal (beta). Please contact support to enable it in your Stripe account.
- Voucher-based payment methods such as Multibanco and OXXO will now send the order email when the order is placed, rather than when the payment is completed.

## 4.0.2 - 2024-04-29

- Added new admin configuration options to enable or disable Express Checkout Element wallets individually.
- In certain flows where the payment method would be automatically saved, there were no displayed terms that the payment method would be saved or used for future purchases.
- When the "Save payment method" setting is disabled, customers will no longer see any saved payment methods at the checkout page.
- If the customer returned from a redirect-based payment method back to Magento, and switched to a 3D Secure card, the payment method would not be updated after the subsequent order placement.
- Fixed several backwards compatibility problems with PHP 7.4.
- Fixed a Stripe object caching issue causing duplicate webhooks configuration when running the CLI webhooks:configure command.
- Fixed an ACH Direct Debit subscription setup error when the subscription has a start date and the first payment is on the order date.

## 4.0.1 - 2024-04-15

- Upgraded to Stripe PHP library v13.15.0.
- Amazon Pay now supports the "Authorize Only" payment action.
- Improvements around the redirect-flow (Stripe Checkout) on session email updates and order invalidation.
- Fixed a case where deleting a product that was ordered and the order is still pending payment, could cause delayed webhook events to fail processing for that order.
- Fixed an issue with subscription start dates, where if the current date matches the subscription start date, the order cannot be placed.

## 4.0.0 - 2024-03-26

- This is a code quality release with broad refactoring to better comply with Adobe Commerce coding standards. We recommend that merchants carefully review and update all module customizations before upgrading to this version.
- Added support for the Express Checkout Element. The ECE can display multiple wallet buttons (Google Pay, Apple Pay, Link) at the same time in the order that maximises payment conversion on your page. Various PaymentRequest APIs have been deprecated or replaced by the ECE. We recommend that merchants review and update headless commerce implementations which depend on the deprecated PRAPIs.
- ACH Direct Debit accounts which require microdeposit verifications, can now be used to purchase subscriptions with future start dates, or be added as saved payment methods from the customer account section. They can also be used in the multi-shipping checkout flow.
- When a customer adds a saved payment method from their account, or from the multishipping checkout flow, it will become eligible for MIT SCA exemptions and can be reused by the merchant to create admin orders on behalf of the customer.
- The accordion payment form layout is now the default configuration, and will display all available payment methods instead of the top 5.
- API endpoints `getModuleConfiguration` (GraphQL API) and `get_module_configuration` (REST API), have been renamed to `getStripeConfiguration` and `get_stripe_configuration`.
- API calls to `getStripeConfiguration` and `get_stripe_configuration` will additionally return initialization options for the Elements object, which include any configured "Payment Method Configuration" IDs, used to filter the available payment methods at the front-end.
- The API parameter `manual_authentication` has been removed from both the GraphQL and REST API. It is advised that manual authentication is configured via the module's `etc/config.xml` file.
- The API parameter `cc_stripejs_token` has been deprecated and removed from both the GraphQL and REST API. The `payment_method` parameter should be used to pass the payment method token to the API.
- The `payment_element` parameter has been deprecated and removed from both the GraphQL and REST API. Payment method tokens that were created with the CardElement will now be treated the same was as tokens created with the PaymentElement.
- All examples under the module's `examples/` directory have been updated to use the new API parameters format.
- Added fallback capability to asynchronously place orders via webhook events when checkout errors prevent the order from being placed.

## 3.5.16 - 2024-03-22

- Guest orders placed with a wallet would show the customer name as "Guest" in the admin order view page. They will now show the full customer name.
- When saving payment methods was disabled, subscription customers would not able to add a new payment method for their subscription.
- Fixed an issue where if two payment intents were associated with a single order, one succeeded, and one was canceled, the successful order could end up canceled.

## 3.5.15 - 2024-03-14

- Improvements with automatic webhooks configuration when upgrading from older versions of the module.
- Replaced statement_descriptor with statement_descriptor_suffix, which is required with Stripe accounts created after February 2024.
- Fixed cached payment intent invalidation - in cases where a Payment Method Configuration was active and a 3DS card was used, the PI would be incorrectly invalidated causing a 3DS error "The provided PaymentMethod was previously used with a PaymentIntent without Customer attachment".
- After the order is placed at the checkout, the loading spinner will remain active until the redirect to the success page finishes.

## 3.5.13 - 2024-03-01

- Updated the REST API headless commerce example for PaymentElement to correctly retrieve the PaymentIntent client_secret when customer authentication is required.
- Fixed a PHP 7.4 backwards compatibility issue causing a crash at the checkout.
- Fixed a multishipping checkout issue with 3D Secure authentication, affecting versions 3.5.11 and 3.5.12.

## 3.5.12 - 2024-02-28

- Added support for 3-decimal point currencies (BHD, JOD, KWD, OMR, TND).
- Added a cron job which periodically cleans old entries from large DB tables.
- Payment method configurations which belong to Connect accounts are filtered out from the module configuration section.
- Fixed a webhooks race condition causing the Total Due value of orders placed with the admin Stripe Billing payment method to remain positive after the invoice is paid.
- Fixed an issue with the Boleto payment method, where the state code would not be passed correctly to the Stripe API.
- Fixed a PHP 8 error with strpos().

## 3.5.11 - 2024-02-15

- Various 3D Secure authentication improvements for subscriptions with future start dates.
- Disabled Amazon Pay support for "Authorize Only" payment action.
- Fixed a Wallet Button error when buying trial subscriptions with a payment method that requires 3DS.

## 3.5.10 - 2024-02-14

- PayPal and Amazon Pay now support the "Authorize Only" payment action.
- Fixed an issue causing orders placed from the admin area with the Stripe Billing payment method to be stuck in Pending Payment. Affects versions 3.5.7 to 3.5.9.
- When the 'Order' payment action is enabled, purchasing subscriptions with the Wallet Button would not set up the subscription correctly.
- Fixed an issue with Link where if the 'Save payment method' is enabled, orders placed with Link would fail.
- Fixed a checkout crash when using custom payment method configurations.

## 3.5.9 - 2024-02-07

- Various 3D Secure customer authentication improvements around the "Order" payment action mode. Reduced likelyhood of a card being declined when the order is invoiced at a future date.
- Fixed an admin area error where if an order was placed with the Link payment method, and the authorization expired, then invoicing the order would fail with the error 'The provided PaymentMethod cannot be attached. To reuse a PaymentMethod, you must attach it to a Customer first.'
- Fixed a payment method display issue at the front-end order view page.
- Fixed a dynamic subscription taxes issue in the invoice.upcoming observer.

## 3.5.8 - 2024-01-17

- Fixed SEPA Direct Debit orders being created in Processing status before a payment is received.
- Fixed PHP 7.4 compatibility issue affecting versions 3.5.6 and 3.5.7.
- Fixed Magento 2.3.7 compatibility issue affecting versions 3.5.0 - 3.5.7.
- Fixed 2 grand total issues at the sidebar.

## 3.5.7 - 2023-12-20

- Recurring orders of configurable subscriptions will now include the parent configurable product instead of the child subscription product.
- Improved handling of various cases of the admin Stripe Billing payment method: payment descriptions, metadata, transaction recording, refunds from Stripe Dashboard.
- Fixed a bug with subscription dynamic taxes where the tax amount was not read correctly from configurable subscriptions.
- Fixed the bank transfers payment method not being displayed when card payments are disabled.

## 3.5.6 - 2023-12-11

- Payment form layout (vertical/horizontal) now also applies to the multishipping page.
- Payment details are now displayed on shipment pages in the admin area.
- Fixed a bug where the order total would display without the tax when tax inclusive prices are configured from the admin area.
- Fixed expiring cart price rules for subscriptions being displayed as a refunds instead of a discounts on the recurring subscription orders.
- Fixed a rounding error when using expiring coupons with tax inclusive subscription orders.
- Fixed a bug causing payment method configurations to not have any effect at the front-end.

## 3.5.5 - 2023-11-16

- Fixed a bug where an invalid payment method configuration would crash the payment element at the front-end.
- Fixed payment method sort order only being applied to the redirect-based payment flow.
- Fixed an md5() error when API keys on a store view are missing or misconfigured.
- Fixed error 'The provided PaymentMethod was previously used with a PaymentIntent without Customer attachment', triggered by multiple card declines of the same payment method. Affects v3.5.1 - 3.5.4.

## 3.5.4 - 2023-11-09

- Fixed a refunds issue affecting configurable products that are partially refunded from the Stripe dashboard.
- Fixed an error at the order shipment pages when the Stripe API keys for the store view are missing.

## 3.5.3 - 2023-10-18

- Fixed a compilation error affecting Adobe Commerce Cloud, introduced in v3.5.2.

## 3.5.2 - 2023-10-13

- Payment method configurations are out of beta and enabled by default. You can now enable different combinations of payment methods on each Magento store view.
- When the Stripe API keys are invalid, wallets and the checkout payment methods are hidden.
- Fixed a wallets issue at the multishipping checkout page.

## 3.5.1 - 2023-09-20

- Added GraphQL API endpoint for retrieving the module's configuration.
- Updated examples for headless commerce.
- Fixed a compilation error affecting Commerce Cloud.
- Fixed a card icons configuration issue for Stripe Checkout.
- Various fixes and improvements for subscription purchases.

## 3.5.0 - 2023-09-04

- Added new checkout flow - "Payment action: Order". When the order is placed, only the payment method is saved without performing an authorization or capture. Orders can remain in Processing status for long durations, and be invoiced at any time to create the initial charge. Supports partial invoicing and works with both the Embedded flow (PaymentElement) as well as the Redirect flow (Stripe Checkout).
- Orders that have been placed with the new "Order" payment action, can be edited from the Magento admin area. Merchants can change the ordered items, customer details and shipping details, and invoice the order using the same saved payment method used on the original order.
- Added new "Bank Transfers" payment method, suitable for large payments that would otherwise be declined by the card networks. Customers can place an order and send funds to a Stripe temporary bank account, which automatically reconciles the funds to complete the payment.
- Configurable, bundled, simple and virtual subscription products can be edited/changed by the customer from their account. Customers can change quantities, customizable options, configurable options, bundle options, shipping address, shipping method and payment method. Prorated billing for upgrades or downgrades can be enabled from the product configuration page, or globally from the module configuration.
- Added support for subscription start dates and subscription schedules. Customers can be billed on the same date every month. Two modes are available to either start the subscription immediately and re-bill on the start date, or to delay the first payment until the start date. For the first option, prorated billing can be enabled.
- Added support for the PaymentElement at the multi-shipping checkout flow. Customers can use cards, wallets and bank debits to place multi-shipping orders.
- Canceled subscriptions are now displayed in the "My Subscriptions" customer account section, and can be re-activated by customers by clicking a "Reactivate" button.
- Added support for PaymentElement's vertical/accordion layout, which works better on smaller column widths, typically used with OSC modules or mobile themes. Can be configured separately for desktop and mobile devices.
- Added support for Stripe Checkout custom domains. The redirect flow can be used without the customer ever leaving your domain.
- Added support for multiple "Payment Method Configurations". Each Magento store view can display different sets of payment methods, which are configured directly from the Stripe dashboard. This feature is currently available to limited Stripe accounts, and can be enabled from the etc/config.xml file.
- Added "Stripe Payment Method" column in the admin orders grid, which displays the payment method type used for the order, i.e. Apple Pay, Klarna, Afterpay etc.
- Added "Stripe Radar" column in the admin orders grid, showing the risk score for the payment.
- Added support for dynamic taxes for subscriptions. When a tax rate changes in Magento, subscription prices are automatically updated to reflect the tax rate change.
- When the "Save payment method" field is enabled, Stripe Checkout will no longer filter payment methods. If a payment method cannot be saved, it will still be available to the customer.
- Prorated subscription downgrades no longer perform a refund on the original order. Instead they increase the customer's credit balance in Stripe, which is used to offset payments from future recurring subscription orders.
- Expiring coupon codes for subscriptions will now also work with cart price rules that do not have a configured coupon code.
- Performance optimizations for reduced API usage.
- Improvements with automatic webhooks configuration.
- Codebase refactor enabling easier customizations to the module.

## 3.4.4 - 2023-08-04

- Added more examples on how to use the REST API with PaymentElement and CardElement.
- Fixed recurring subscription orders re-activating the original cart that was used for the subscription purchase.
- Fixed a data migration error when using table prefixes.

## 3.4.3 - 2023-07-12

- When the "Save customer payment method" option is disabled, the "My Payment Methods" link will be hidden from the customer account section.
- Added a data migration which cleans old settings for payment method filtering per country, applicable for users migrating from v2.x of the module.
- Fixed a checkout crash with Wechat Pay.
- Fixed an admin issue when re-ordering an existing order, which would in some cases not automatically populate the ordered items or customer email.
- Fixed an issue where disabling regular card payments would prevent wallet buttons from initializing correctly.
- Fixed a crash in the customer.subscription.updated webhooks observer.

## 3.4.2 - 2023-05-17

- For asynchronous payment methods, the new order email is sent upon payment authrorization, rather than payment receipt. The invoice email is still sent on payment receipt.
- The default/stripe_settings/payment_methods config.xml setting can be used to additionally hide types of saved payment methods.
- When the redirect payment flow is enabled, the customer cart is additionally deactivated via webhooks, to handle scenarios where the customer never returns to the website.
- Improved error handling with Stripe Checkout for unsupported currencies.
- Prevent Magento 2.4.6 from redirecting to the shipping page after a card decline.
- Compatibility fix with Amasty OSC.
- Fixed an issue in the Pending Payment Order Lifetime cron job, causing canceled orders for asynchronous payment methods that were in processing status.
- Fixed a scenario where a trial subscription order placement would fail with error: This PaymentIntent's payment_method could not be updated.

## 3.4.1 - 2023-04-11

- Compatible with PHP 8.2.
- Added configuration method for hiding Afterpay/Clearpay on virtual carts.
- Fixed abandoned orders placed with the Affirm payment method not getting canceled.
- Fixed a javascript crash at the My Payment Methods page.

## 3.4.0 - 2023-03-27

- Compatible with Magento 2.4.6.
- Headless commerce: Simplified implementation flow for PWA apps, mobile apps and custom storefronts built with React, Vue or other front-end framework. Customer authentications are simplified and a wider number of payment methods are supported.
- Improved Google Page Speed score. Up to 8 performance points improvement has been observed in tests.
- No more pending orders for card payments and other synchronous payment methods. When a payment fails, there won't be a Pending/Canceled order in the admin area.
- For asynchronous payment methods which require a redirect, the order will be created in Pending Payment status instead of Pending status. These orders can be managed by configuring Magento’s built-in “Pending Payment Order Lifetime”.
- 95% reduction in incomplete payments in the Stripe dashboard. When customers arrive at the checkout page, no payments are created in Stripe in "Incomplete" status.
- Under the My Payment Methods section, customers can now add several types of bank debits such as SEPA, ACSS, ACH etc.
- The store view locale is synchronised on the Stripe customer's preferred locales. Stripe will issue invoices, receipts, and other customer facing emails to that customer with an appropriately translated email, payment page, or PDF. 15 languages are currently supported.
- Subscriptions support for Bundled products. Regular items which are part of a subscription bundle, will be included in the final subscription price. The recurring subscription order will include the bundle item with all of the original sub-selections, instead of only the simple/virtual subscription product.
- Migrating subscription prices with the CLI tool will update instead of re-create the subscription. The subscription status remains active instead of switching to trialing, and historical subscription data are preserved in the Stripe dashboard.
- The My Payment Methods page is now an API-assisted uiComponent, improving loading time and performance.
- Subscription prices are created in Stripe with a human readable name, i.e. "$15 every month". CSV exports and Stripe invoices display the price name.
- Rejecting a fraudulent payment will set the order status to Suspected Fraud instead of Canceled.
- GraphQL support for PaymentElement. GraphQL can be used to place orders with any alternative payment method such as Klarna, AfterPay, Apple Pay etc. An example front-end was added under {module_dir}/examples/GraphQL/PaymentElement/.
- Added 3 new GraphQL mutations and REST APIs for adding, deleting and listing saved payment methods.
- Added GraphQL support for saved card CVC tokens.
- When creating order shipments from the admin, orders which are in Pending Payment status will remain in Pending Payment status instead of switching to Processing status.
- Shipping trial subscription orders will switch them to Closed status instead of Processing status.
- Changed what we consider a subscription upgrade/downgrade to be a simple subscription amount comparison. Changes in the billing interval are no longer taken into account.
- Deprecated all CLI commands for Magento 1 to Magento 2 migrations.

## 3.3.13 - 2023-03-06

- When guest customers return from Stripe Checkout and change their email, it is updated on the customer object in Stripe and reflected in the next Stripe Checkout session.
- After multiple partial refunds from the Stripe dashboard, close the order when the final refund reaches the order's grand total.
- In the admin orders grid, renamed the title of "Send an invoice to the customer by email (via Stripe Billing)" to "Stripe Billing".
- Various fixes with expiring discount coupons & rules for subscriptions.
- Fixed a "Duplicate webhooks" warning displayed in the admin area for no reason.
- Fixed a Google Pay issue with configurable products on older versions of Magento triggering a "Product quantity not available" error.
- Fixed a PHP 8.1 compatibility error when reading the module configuration for wallet locations.
- Fixed an error in the customer.subscription.updated webhooks observer.

## 3.3.12 - 2023-02-08

- Fixed an error triggered when telephone numbers are optional.
- Fixed a subscription upgrades problem affecting upgrades to subscriptions with different intervals.
- Fixed the active cart not being restored correctly after a payment failure.
- Fixed a scenario causing wallet payments to throw a country_id error.
- Compatibility fix with a 3rd party Address Finder module.

## 3.3.11 - 2023-01-05

- Added a webhooks endpoint exclusion rule for the Adobe Commerce "Web Restrictions" setting.
- Added GraphQL examples under {module_directory}/examples/GraphQL/CardElement/.
- Added customer telephone validations (20 digits max for certain API calls).
- Added new database indexes which improve queries performance.
- Reduced the frequency of webhook ping requests.
- The cron tasks will not cancel abandoned payment intents which are not associated with a local order.
- Fixed a Wallet button shipping address error occurring when the region does not exist in the database.
- Some fixes with the subscription price migration command when migrating orders in bulk.

## 3.3.9 - 2022-11-30

- Store Credit and Gift Card fixes for Adobe Commerce.
- GraphQL fixes for 3D Secure.
- Fixed a crash in the CLI command stripe:cron:retry-events.

## 3.3.8 - 2022-11-18

- The header title of the wallet buttons on the checkout page is renamed from "Chekcout with Google/Apple Pay" to "Checkout with digital wallet".
- Added CLI command stripe:webhooks:automatic-configuration which can be used to enable or disable automatic webhooks configuration.
- Improvements with checkout flow when a payment has failed and the cart changes.

## 3.3.7 - 2022-11-09

- Fixed recurring configurable subscription orders not being created after Magento deletes the expired quote from the database.
- Fixed voucher payment methods OXXO, Konbini and Boleto not redirecting to the order success page.
- Javascript compatibility fix with older versions of mobile Safari.

## 3.3.6 - 2022-11-08

- Fixed a webhooks crash which prevented recurring subscription orders from being created.
- Added helper CLI command stripe:cron:retry-events.

## 3.3.5 - 2022-11-07

- The Link payment method can be used with Authorize Only mode.
- Added helper CLI command stripe:cron:cancel-abandoned-payments.
- The API rate limiter is disabled when Magento is in "developer" mode.
- Fixed a user scenario causing orders to be stuck in Pending status.

## 3.3.4 - 2022-10-26

- Added a payment method title for Stripe Checkout in the admin orders grid.
- Cosmetic UI improvements with Onestepcheckout_Iosc.
- Adjusted checkout validations to work with configurable subscriptions created with older versions of the module.
- Fixed partial refunds for the admin Stripe Invoice payment method.

## 3.3.3 - 2022-10-21

- Added admin and email icons for the Link payment method.

## 3.3.2 - 2022-10-20

- Improvements around GraphQL API flows.
- Fixed duplicate emails being sent for admin orders.
- Fixed a terms and conditions validation problem at the checkout page.

## 3.3.1 - 2022-10-13

- Localization fixes for 6 locales. Afterpay is displayed as Clearpay in the UK.
- Small checkout performance improvements.
- Compatibility fix of API rate limiter with Magento 2.3.
- Fixed a bug with expiring discount coupons for subscriptions.
- Fixed a refunds problem when a partial invoice is issued and the order is canceled.
- Fixed a GraphQL error when a 3D Secure card is used for an order.
- Fixed statement descriptor configuration setting not being applied.
- Fixed incorrect notification in admin that webhooks have not yet been configured.

## 3.3.0 - 2022-09-28

- Added support for subscription plan updates. Customers can switch from one subscription plan to another from the customer account section. Supported via the use of Magento configurable products.
- Customers can change the shipping address and shipping method of active subscriptions from the customer account section. The difference in shipping cost and taxes is collected via the checkout page. No new orders are created during the update; and all future recurring orders have the new shipping details and new shipping cost.
- Added support for prorations on virtual subscription upgrades or downgrades. Unused time on the current subscription and remaining time on the new subscription is taken into account to bill or refund the correct amount after a subscription upgrade or downgrade. Prorations can be enabled or disabled for subscription upgrades and subscription downgrades separately.
- Added support for the Link payment method (https://link.co/). Customers can checkout faster with prefilled payment details.
- Added a new API rate limiter for the module's exposed API endpoints. Can be configured and used as an additional fraud security tool.
- Added the --interactive | -i option to the CLI stripe:webhooks:configure command. Merchants now have the option to select which store view domain will become their default webhooks endpoint.
- New and improved webhooks processing system. Achieves parallel API request idempotency, logs errors in the database, and can retry failed events via cron jobs.
- Improvements with automatic webhooks configuration. Endpoints are updated rather than re-created, and switching back and forth of Stripe accounts and modes will reuse the old configured endpoints.
- Added support for partial refunds to the admin Invoicing payment method.
- Changing the status of a Stripe invoice to Void from the Stripe dashboard will create a credit memo for that order.
- Refunding payments from the Stripe dashboard will create credit memos which do not include any order items. Order items can either be shipped or returned to stock after the refund and before closing or completing the order.
- Deprecated multiple subscriptions per order functionality. Only one subscription can be bought per order.
- Added integration between Mageplaza OneStepCheckout and the AfterPay/Clearpay payment method.
- Various checkout flow improvements when the payment fails and is retried. Fixes cases where the old order would remain in pending status instead of being canceled.
- Compatibility fix with Magento 2.3.5 and older.
- Added CSP policy for frame-ancestors, fixes a Safari 3D Secure problem.
- Fixed a scenario where the order amount changes but the Apple Pay amount does not update to reflect the change.
- Improved error handling for 2 cases in the Magento admin area.
- Fixed a case where orders placed from the admin area using the Invoicing method would have a status of Payment Review instead of Pending Payment.
- Fixed a case where the minicart contents would not be cleared after an order is placed.
- Fixed address street line not being passed to Payment Element shipping address.
- Fixed placing subscription orders with SEPA Debit via Stripe Checkout.

## 3.2.8 - 2022-08-16

- Compatibility fix with Adobe Commerce 2.4.4 at the Cart Price Rules page.
- Compatibility improvements for certain OneStepCheckout modules.
- Various improvements with Google Pay and Apple Pay.
- Fixed orders being canceled and duplicated after 2 consecutive failed payment attempts.
- Fixed redirect-based payment methods that failed authorization redirecting the customer to the order success page.
- Fixed inability to cancel discount coupons that make the payment method unavailable.

## 3.2.7 - 2022-08-01

- Improved support for certain OneStepCheckout modules. Dynamic updates to PaymentElement's billing address.
- Fixed an error in the admin area when placing new orders on non-default stores.
- Fixed a checkout page error when the customer has not specified a first name or last name in the Wallet Button modal.
- Fixed a multi-shipping checkout bug causing items to be removed from the cart.
- Fixed a webhooks crash when refunding a payment from the Stripe dashboard.
- Fixed a PHP 8 error with certain card icon configurations.

## 3.2.6 - 2022-07-20

- Improved support for Traditional Chinese (Hong Kong and Taiwan).
- Fixed compatibility issue between Apple Pay and Magento 2.4.4.
- Fixed duplicate order emails being sent in some cases.
- Fixed circular dependency error when adding products to the cart.
- Various fixes and improvements for orders which include trial subscriptions.

## 3.2.5 - 2022-07-18

- Fixed invoices created too soon in pending status. Invoices are now created in paid status upon receipt of the charge.succeeded event.
- Fixed compatibility issue with the OneStepCheckout.com module not displaying the Wallet button at the checkout page.
- Fixed a problem in Authorize Only mode where abandoned orders would not get canceled by cron.
- Fixed a webhooks crash when creating recurring subscription orders.
- Fixed a Magento admin error when placing MOTO orders.

## 3.2.4 - 2022-06-29

- Compatibility fix with Sendcloud platform, causing orders created externally by Sendcloud to be marked as multi-shipping orders.
- Fixed a bug where logged in customers would not get a new order email after placing an order.

## 3.2.3 - 2022-06-16

- Fixed a form validation bug in the Magento admin new order page.
- Fixed a bug when adding products to the cart from the catalog pages.

## 3.2.2 - 2022-06-06

- The payment element no longer collects the country or postcode at the checkout page. The Magento billing address is used for the payment.
- The order status now switches to "Processing" synchronously with the payment. If webhooks cannot be delivered, the order status will still switch to Processing.
- Fixed a form validation bug in the Magento admin new order page.
- Fixed a Wallet Button error when 3D Secure is required at the product pages.
- Fixed a scenario where if a customer logs in at the checkout, the successful payment in Stripe would have a Cart ID description, and the Magento order would remain in Pending status.

## 3.2.1 - 2022-05-24

- Added full synchronization of customer billing and shipping addresses upon order placement.
- Fixed 'Please specify a shipping method' error with the Wallet Button at the top section of the checkout page.
- Fixed a webhooks race condition causing orders to switch from Processing status back to Pending status.
- Fixed pending Konbini payments being treated as abandoned payments and canceled after a few hours.
- Fixed a payment method deduplication crash.
- Fixed duplicate new order email being sent out.

## 3.2.0 - 2022-05-18

- Added the ability to re-collect CVC codes for saved cards at the checkout page. Configurable from the Magento admin. Enabling this setting helps reduce fraud and slightly improves authorization rates. Can be used as part of Stripe Radar rules.
- After popular demand, the CardElement has been restored to the Magento admin for placing MOTO orders with new cards.
- The PaymentElement has been added and is now available to customers at the My Payment Methods section.
- Card de-duplication improvements, adding newer cards with the same number will replace the old card.
- UI improvements at the My Subscriptions page when changing a subscription's default payment method.
- Deprecated the SCA MOTO Exceptions setting from the Magento admin area. MOTO is now configured and used automatically if it is enabled on the Stripe account.
- Less webhook warnings in the admin area; hidden as soon as the first webhook event arrives.
- Email payment method icons are in PNG format (wider support for email clients).
- Better error handling at the multi-shipping checkout page.
- Fixed a problem where the Authorize Only setting would be ignored if a saved card was used.
- Fixed the Wallet Button not displaying as a standalone payment method when Payments are disabled from the module configuration section.
- Fixed saved payment methods not appearing at the checkout when a single trial subscription is in the cart.
- Fixed a redirect problem when adding configurable products to the cart from the catalog page.


## 3.1.2 - 2022-04-28

- Added icons for the PayNow and Konbini payment methods.
- Added global configuration option to disable the Wallet Button across all pages.
- Added missing locale files.
- Fixed compatibility issue with some themes that would cause the payment form to break at checkout.
- Fixed issue with multi-shipping checkout link appearing despite being disabled in the settings.
- Fixed an error in the CLI subscription migration command.
- Fixed a UI issue in multi-shipping checkout when saved cards are displayed.

## 3.1.1 - 2022-04-21

- PHP 8.1 compatibility fix.

## 3.1.0 - 2022-04-20

- Added support for Magento 2.4.4 and PHP 8.1.
- Added automatic email to the store General email for failed recurring subscription orders that fail to be placed.
- Added support for saving ACH Debits payment methods.
- Added multiple CLI commands to manage webhooks and events.
- Added cron to check and automatically reconfigure webhooks when needed.
- Added cron to automatically re-enable the webhook origin check on production mode if disabled and forgotten.
- Improved handling of trial subscriptions purchase with regular products. When a regular product is purchased with a trial subscription, the trial subscription is invoiced and automatically refunded on the initial order.
- Multiple improvements to Stripe Checkout refunds and order cancellations.
- Improved the automatic webhooks configuration so that multiple Magento installations can use the same Stripe account.
- Improved the Wallet Button display by showing it only once on the checkout page, i.e. if enabled separately, it is now hidden in the Payment Element.
- Improved management of high risk payments with multishipping by allowing you to approve the payment from the Stripe dashboard to unhold all held multishipping orders.
- Webhook configuration settings have been removed from the admin module configuration section.
- Fixed duplicate order email after order placement.
- Fixed invoice email not being sent after order placement.
- Fixed an API crash with GraphQL order placements.
- Fixed a manual agreements validation issue at the checkout.
- Fixed a Wallet Button glitch which caused the payment form to be hidden at the checkout.

## 3.0.0 - 2022-04-05

- `MAJOR`: Introducing Stripe's Payment Element; an embeddable UI component that lets you accept 20+ payment methods with a single integration. The new component replaces the legacy Stripe Elements based form for card payments, as well as all alternative payment methods. Stripe is now displayed as a single Magento payment method which can automatically adjust input fields, dynamically sort payment methods and optimize your checkout page for conversions. You can now enable new payment methods from your Stripe dashboard without the need to upgrade the Stripe module.
- `New`: The Magento multishipping checkout flow has been rebuilt from scratch to support a single payment for all multishipping orders, improving performance and reducing customer authentication friction.

## 2.9.5 - 2022-03-15

- Improvements with automatic webhooks configuration.
- Fixed an "Invalid shipping address" error when the Wallet Button is used at the checkout page.
- Fixed subscription orders placed with the Wallet Button not creating recurring orders.
- Fixed a data migration error for users of the former Cryozonic modules.

## 2.9.4 - 2022-03-04

- From the Stripe Dashboard, marking an invoice as Void, Uncollectible or Paid outside Stripe, will update the Magento order status.
- Updated CSP policy to allow loading from new Klarna domains at the checkout.
- Subscription orders placed with Stripe Checkout can be migrated/updated with the CLI tool.
- When configuring webhooks, the storefront URL is used instead of the Magento base URL.

## 2.9.3 - 2022-02-07

- The automatic webhooks configuration will no longer setup webhooks for inactive API keys.
- Saved cards created using the legacy Sources API can be deleted from the customer account section.
- Fixed a recurring subscription orders issue with MSI (Multi-source inventory).
- Fixed a GraphQL API crash.

## 2.9.2 - 2022-01-27

- Fixed a refunds error affecting orders which have multiple partial invoices.

## 2.9.0 - 2022-01-24

- `New`: In Authorize Only mode, merchants can now create multiple partial invoices by using a saved card. Order items can therefore be billed and shipped separately from one another.
- Webhook signatures are configured automatically.
- Dropped support for Magento 2.2 and older.
- Various improvements with the Wallet Button.
- Time synchronization of Stripe Checkout session expiration time.

## 2.8.4 - 2022-01-07

- Fixed a checkout scenario in which a subscription in the cart fails to be created even though the order is placed successfully.

## 2.8.3 - 2021-12-13

- `MAJOR`: Stripe Checkout is no longer restricted to card payments, supports all alternative payment methods, including new methods ACSS Debit/Canadian PADs, Afterpay/Clearpay, BACS Direct Debit, AU BECS Direct Debit, Boleto and GrabPay.
- `MAJOR`: Subscriptions can be bought with Cards, SEPA Debit (new) and BACS Debit (new). Available via the new Stripe Checkout payment flow.
- `Deprecated`: The embedded flow based on Stripe Elements is now deprecated. It will be replaced with the new Payment Element in a future release. In the meantime, Stripe Checkout becomes the new default payment flow.

## 2.7.7 - 2021-11-05

- Stripe Checkout is translated to the language used by the Magento store view.
- Fixed 2 issues affecting virtual and configurable subscription orders.

## 2.7.6 - 2021-10-19

- Stripe Checkout sessions expire after 2 hours, after which the order will be canceled.
- The Oxxo payment method will display a link to a hosted voucher page in customer emails and in the admin order page.
- The admin area "Send invoice to customer" payment method better supports bundled and configurable products.
- Improved handling of partial refunds issued from the Stripe Dashboard. Multiple credit memos are created, multi-currency totals are set, the final memo closes the order.
- Fixed a webhooks timeout issue with Klarna and SOFORT.
- Canceling fraudulent authorizations from Stripe would not cancel orders which had invoices in Pending status.
- Other minor fixes and improvements.

## 2.7.5 - 2021-10-05

- Added CLI support for migrating subscriptions ordered via Apple Pay or Stripe Checkout.
- Added new cron configuration section with suitable defaults for the Stripe tasks only.
- Cancelations of uncaptured payments will set the Magento order total canceled amount instead of the total refunded amount.
- Partial captures from Stripe Dashboard will update the order's total paid amount.
- Fixed a webhooks crash causing charges not to be logged against orders.
- Fixed incorrect invoice status in Authorize Only mode when automatic invoicing is enabled.

## 2.7.4 - 2021-09-20

- The default location of the Payment Request API (Apple Pay, Google Pay etc) is now above all payment methods.
- The PRAPI works better with OneStepCheckout modules by requesting a shipping address if one is not set.
- Subscription price migrations work with tax inclusive price settings and configurable subscriptions.
- Updates to alternative/redirect based payment method refunds.

## 2.7.3 - 2021-09-10

- Updated CLI subscription price migration script to work with configurable subscriptions.
- Fixed partial refunds

## 2.7.2 - 2021-09-06

- Fixed a Magento admin area javascript issue when the order grand total is zero.
- Fixed Payment Intents not getting updated with new order details after they've been cached.

## 2.7.1 - 2021-08-27

- Implemented new refund strategy when refunding an order with subscriptions and multiple separate payments.
- Subscription orders can be captured or canceled in Authorize Only mode, same as regular product orders.
- Removed last 4 digits and expiry date from new order emails and the Magento admin order page.
- Less API calls, better response times for the Payment Request API modal.
- Fixed orders placed via the Payment Request API (Apple Pay, Google Pay, etc), not passing order data to Stripe (description, metadata, shipping address, affects 2.5.9 - 2.7.0).
- Various fixes and improvements for tax inclusive catalog prices.
- Fixed an installment plan selection issue with Mexico cards.

## 2.7.0 - 2021-08-10

- `MAJOR`: New flow with Stripe Checkout; adds support for complex and multiple cart discount rules.
- Trial subscription orders will no longer be canceled. Both the initial trial order as well as the new order created upon payment can be used to ship the products.
- Deprecated automatic invoicing of subscription items in Authorize Only mode. Invoices can be manually created upon product shipment.
- Performance improvements.
- Fixed a tax inclusive price calculation for subscriptions.
- Fixed a shipping address error for Apple Pay in countries with optional region.

## 2.6.1 - 2021-07-23

- Adobe Commerce gift cards are created in Stripe as Coupons when using the Stripe Checkout payment flow.
- Partial captures from Stripe will invoice the Magento order for the captured amount.
- Partial refunds from Stripe will no longer change the order status, unless the full amount is refunded.
- Multiple partial refunds from Stripe will create multiple Credit Memos in Magento.
- Manually approved payments in Stripe will remove Magento orders from On Hold status.
- Fixed a checkout crash happening after multiple failed payment attempts.
- Some fixes in the admin area when creating a new order.

## 2.6.0 - 2021-07-20

- `MAJOR`: Added support for PayPal

## 2.5.9 - 2021-06-10

- Added support for GraphQL PWA apps.
- Added support for Tax Inclusive catalog and cart prices.
- Added new input field validations in the admin area.
- Added Belgium, Spain and Italy to the supported Klarna countries.
- Made Region optional for Klarna.
- Improved form validation when manual Terms and Conditions are enabled.
- Improvements with display and validation of PRAPI requests.
- Admin errors are more descriptive.
- Fixed a 3DS issue when database rollback transactions run after an order placement error.
- Fixed a webhooks deliverability issue causing the event to be processed twice.
- Various fixes with bundled and configurable subscriptions.
- Ignore incoming webhooks with no order number.
- Fixed an issue where subscription orders from the admin area or the API would create 2 order invoices.
- Trial virtual subscriptions are deleted and recreated when 3DS is required.
- Fixed a trial virtual subscriptions error at the multishipping checkout page.
- Fixed FPX payment method not sending out a new order email.
- Fixed invoicing orders with expired authorizations from guest customers.
- Fixed some layout warnings in the log files.

## 2.5.7 - 2021-03-03

- Added support for tax inclusive Catalog Prices for subscriptions.
- Added support for tax inclusive Shipping prices for subscriptions.
- Improved deliverability for webhooks that were timing out.
- Better handling of refunds with an amount of 0.
- Fixed an initial fee issue affecting 2.5.6.

## 2.5.6 - 2021-02-12

- Compatibility fixes for Magento 2.4.2.
- Better handling of shipping tax for subscriptions.
- When a subscription order is invoiced, an invoice email is automatically sent out to the customer.
- When the rollback system is triggered, a Payment Failed Email is sent to the configured Magento contact.
- Improved handling of webhook events that arrive too early.
- Now using the Magento rate limiter when placing orders.
- Fixed incorrect Credit Memo totals for partial refunds from the Stripe Dashboard.
- Fixed partial refunds from Stripe marking the order as closed.
- Fixed an infinite loop in the AddInitialFeeToTotalsBlock afterGetOrder plugin.

## 2.5.4 - 2021-02-03

- Fixed an issue that triggered a duplicate order email and a duplicate invoice for that order.
- Fixed a tax rounding issue in the admin when the tax settings are to use the unit-based calculation method.

## 2.5.3 - 2021-01-19

- Fixed 3 issues in v2.5.0 - v2.5.2 affecting MOTO admin orders, automatic invoicing of authorized orders and multi-shipping checkout.
- Fixed a misplaced terms and conditions validation issue affecting v2.4.0 - v2.5.3.

## 2.5.2 - 2021-01-14

- Trial subscription orders with no collected payment are automatically canceled. A new order is created when the first payment is received.
- Running magento module:uninstall with the --remove-data attribute will remove all database tables and attributes created by the module.
- Fixed a bank account verification problem with ACH.
- Invoice totals were incorrect for mixed subscription orders that were split into multiple invoices. Invoice totals are recalculated based on the new invoice items.

## 2.5.1 - 2021-01-08

- Fixed a javascript crash at the checkout.
- Fixed new order emails not being sent out for the new Checkout payment method.

## 2.5.0 - 2021-01-07

- `MAJOR`: Added subscriptions support for the Stripe Checkout payment method. Backwards compatible with the Stripe Elements payment method.
- Redesign of the My Subscriptions section under the customer account section.
- When the PRAPI is used from the product page, the minicart is automatically updated to include the new cart item.
- When returning from Stripe Checkout without paying (using the back button), the customer is forwarded to the Magento checkout page instead of the shopping cart page.
- Various fixes with trial subscription purchases.
- Authentication Required errors are no longer logged to the Magento log files.
- Fixed an IE11 issue.
- Fixed an order invoicing error when capturing the payment in the Base currency of the order.
- Fixed an initial fee issue for multi-currency store views.
- Other robustness and performance improvements.

## 2.4.1 - 2020-12-01

- When the payment action is set to Authorize Only, the card is saved automatically on the customer. Customers cannot delete this card until a the order is completed or closed. For expired authorizations, the module will reuse the saved card to recreate the original payment.
- Added support for mixed subscription cart purchases through the PRAPI from the product page, minicart and all places where it is displayed.
- The PRAPI button now displays for subscriptions on their product page even when the cart is empty.
- In multishipping, the New Order Email is sent after the 3DS customer authentication succeeds, and not at the time that the order is created.
- Performance improvement: One less API call for trial subscriptions at the checkout, SetupIntents are created only once per quote and saved in the cache.
- Updated SetupIntents integration, various performance and robustness improvements for subscription purchases.
- Fixed an issue at the multi-shipping review page when shipping the same subscription product to 2 different addresses.
- Fixed a card declined issue for trial subscriptions.
- Fixed a javascript issue at the multi-shipping billing section when switching between saved cards.
- Fixed a shipping rates error "The shipping method is missing" for recurring subscription orders where the shipping rates have changed.

## 2.4.0 - 2020-11-24

- `MAJOR`: The PaymentRequestAPI (i.e. Apple Pay, Google Pay etc) is now a stand-alone payment method that can be displayed even when all other payment methods are disabled, including card payments.
- The PRAPI method can be detected separately for Chrome, Opera, Edge, Safari, Samsung, QQ Browser etc.
- Viewing orders from the Magento admin will display if an order was placed using Apple Pay, Google Pay, Microsoft Pay etc, as well as the page from which they were placed.
- The PRAPI title (i.e. Pay with Google Pay) is displayed on top of the PRAPI button at the checkout page.
- The PRAPI method and the page from which they were placed are now added in the metadata of each payment.
- The PRAPI button automatically reloads in the minicart, product page and shopping cart page to reflect price changes from applied discount coupons and cart updates.
- Added support for 20 additional Stripe.js locales. The payment form and PRAPI button are automatically translated based on the configured Magento locale.
- Stripe Invoices created through the Magento admin will automatically be sent to the customer regardless of the configured Billing settings in the Stripe dashboard.
- Improved error handling with the PRAPI, an error modal is always displayed with the error message from the AJAX call.
- One less API call at the checkout, improves page loading performance.
- One less API call for the PRAPI button at the product page, minicart and shopping cart. The paysheet opens faster.
- Added new database indexes, improvement query performance on large customer tables and checkout loading times.
- Fixed various checkout issues with trialing subscriptions affecting v2.3.0.
- Fixed a multishipping issue with 3DS cards affecting v2.3.0.
- Fixed "You must save this PaymentMethod to a customer before you can update it." error affecting v2.3.0.
- Fixed currency code warnings when switching between shipping addresses in the PRAPI paysheet and when initializing the minicart button.
- Fixed OXXO barcode not displaying on order success page.
- Large cleanup of legacy code.

## 2.3.0 - 2020-11-06

- `MAJOR`: Introducing support for Stripe Checkout. Includes support for Chargeback Protection and significantly reduces implementation effort of PWA storefronts and headless commerce applications. Can be enabled from Stripe > Card Payments > Checkout Mode.
- When an authorization expires, it is no longer necessary for the customer to have a saved card on file. The original card will be used to re-create the payment upon invoicing of the order.
- Stripe Radar Approved payments will automatically Unhold their respective order in Magento and switch them to Processing/Complete status.
- Stripe Radar Rejected payments will automatically be refunded in Magento. A comment will be added with the reason they were rejected. Two Magento events will be triggered before and after refunding the order for custom post processing of the rejection.
- Performance optimizations at the checkout (less API calls) when a saved card is used for a payment.
- Improved customer card deduplication through webhook listeners.
- Small updates to Klarna, SEPA Direct Debit, CSP allowlist and the Magento admin payment info block.
- Improved handling of stores that have customer telephone disabled or optional.
- Various fixes and improvements for Apple Pay.
- Fix for new order emails triggered from the new Stripe Billing Invoice method.

## 2.2.1 - 2020-10-22

- Fixed a javascript crash at the checkout when Subscriptions are disabled from the admin configuration  section.
- Fixed a compatibility issue with IE11.

## 2.2.0 - 2020-10-13

- `MAJOR`: Added a new payment method in Magento admin area which can send an invoice to the customer via Stripe Billing. Card details no longer need to be collected over the phone, they can be filled by the customer by following the payment link in the email.
- `MAJOR`: A single Magento customer can now maintain saved cards across multiple Stripe accounts across different Magento store views.
- When a trial subscription is in the cart, the checkout trial totals will be displayed separately and the displayed order total will be reduced to $0.
- Refunding recurring subscription charges from Stripe will now automatically create a Credit Memo for the recurring order in Magento.
- When a configurable product option switches from a shippable to a non-shippable product, Apple Pay is re-initialized to remove the shipping address from the paysheet.
- When a recurring subscription order is created, the payment description in Stripe is updated to 'Recurring Order #xxxxx by Firstname Lastname'.
- Recurring subscription orders are now invoiced automatically regardless of the Payment Action setting of the module.
- Updated CSP Whitelist.

## 2.1.4 - 2020-10-02

- Fixed SEPA Direct Debit not displaying the business name in the checkout mandate
- Fixed a Magento 2.1 backwards compatibility issue
- Fixed Apple Pay sending a duplicate new order email
- Fixed some PHP notices with older versions of PHP

## 2.1.3 - 2020-09-25

- Added length limits to Level 3 data fields
- Whitelisted additional Klarna domains
- Display the installed Stripe PHP library in the admin notifications
- Fixed a crash when creating a new cart price rule

## 2.1.2 - 2020-09-17

- Magento backwards compatibility fix for expiring subscription coupons
- Fixed Apple Pay issue for virtual products
- Fixed 2 currency conversion issues when refunding orders placed with 'Pay in store currency = No'
- Fixed subscriptions initial fee issue at the multishipping checkout page

## 2.1.0 - 2020-09-11

- Added support for expiring discount coupons for subscriptions.
- Added support for Level 3 data for the card networks.
- Added a configuration option that can be used set the default value of the 'Save card' checkbox to either checked or unchecked.
- Performance improvement: One less API call at the checkout page
- The payment form input fields are a bit wider.
- When guest checkouts are disabled, Apple Pay will also be disabled on product pages.
- The rollback system will now ensure that no order has been saved, otherwise it wont run. Avoids exceptions thrown by observers after the order is saved.
- Fixed an issue in the multishipping page.
- Fixed an integration issue with Quickbooks.

## 2.0.1 - 2020-08-18

- Fixed 2 issues with placing orders from the Magento admin area

## 2.0.0 - 2020-08-18

- `MAJOR`: Added support for paying in installments when the card provider supports it (currently only available in Mexico)
- Performance improvement: One less API call when placing an order at the checkout page
- The rollback system will now log the message and stack trace of the exception that triggered the rollback
- Fixed placing subscription orders at the multishipping checkout
- Fixed issue where if a 3DS failed, the customer was unable to retry using the same payment method
- Fixed an error in the admin area, when canceling an order of which its payment authorization had expired

## 1.9.2 - 2020-08-12

- Fixed Apple Pay issue with countries that do not provide a city through the PRAPI (i.e. Japan)
- Fixed a PWA / REST API issue with 3D Secure affecting versions 1.8.8 - 1.9.1
- Removed an irrelevant Stripe message in the Magento admin payment info block, on orders placed with non-Stripe payment methods

## 1.9.1 - 2020-07-29

- Magento 2.4.0 compatibility fix affecting subscription purchases
- The billing address is now passed to all alternative payment methods
- Added new translations
- Performance improvement: Removed jQuery dependency in a few places

## 1.9.0 - 2020-07-16

- `MAJOR`: Added support for the OXXO payment method (Mexico)
- `MAJOR`: Subscriptions can now be migrated from one plan to another using a CLI command
- Subscriptions can be purchased directly from a product page using Apple/Google/Microsoft Pay
- Adding a duplicate card will replace the old one instead of reusing it
- Fixed an Apple Pay issue at the checkout
- Fixed a card decline issue

## 1.8.9 - 2020-07-07

- Fixed a crash at customer sign up affecting 1.8.8
- Fixed the subscription edit button not responding to clicks
- Fixed a conflict with the AheadWorks OSC module

## 1.8.8 - 2020-07-05

- Security patch for a XSS issue

## 1.8.7 - 2020-06-12

- Added a rollback system so that if an error occurs after a payment succeeds, the payment is automatically refunded
- Fixed an Apple Pay issue at the checkout preventing the customer from placing the order
- Fixed Klarna terms and conditions block not displaying
- Fixed Klarna payment options not hiding when another payment method is selected
- Fixed a card deleting issue when the card was created with the Sources API

## 1.8.6 - 2020-06-04

- Added off_session parameter when placing an admin order that includes a subscription, reduces card decline rates
- Fixed a Magento 2.1 compilation issue

## 1.8.5 - 2020-06-03

- Added payment card details to new order emails
- Percent discounts for subscriptions are created in Stripe Billing as percent_off coupons instead of amount_off coupons
- Stripe Billing Coupon names include the percent or amount off a subscription
- Fixed a webhooks configuration problem when the default store has no API keys set
- Fixed order totals issues for recurring orders with initial fees
- Fixed a tax rounding issue for initial fees when multiple subscriptions are added to the cart
- Fixed initial fee formating for subscriptions in the minicart details
- Fixed a Klarna issue not loading at the checkout

## 1.8.4 - 2020-05-14

- Added billing address details to payment methods created from the Magento admin area
- Fixed a data migration issue for new CLI based Magento installations

## 1.8.3 - 2020-05-11

- Magento 2.1 compatibility fix

## 1.8.2 - 2020-05-05

- Added Content-Security-Policy files required by Magento 2.3.5

## 1.8.0 - 2020-04-29

- `MAJOR`: Added support for SEPA Credit Transfers
- `MAJOR`: Upgraded to Stripe PHP library v7 and to Stripe API version 2020-03-02
- Added support for subscription Coupons via Stripe Billing
- Implemented a new, more organized module configuration section in the admin area
- Customers can now change their subscriptions cards from their customer account section
- Subscriptions can now be disabled system-wide, improving performance
- The Apple Pay seller name can now be specified in the module configuration section
- The billing address of saved cards is now updated before placing the order, fixes a zip code verification failure
- Orders placed from the admin area can now also be marked as fraudulent by Stripe Radar
- Klarna integration updated to include shipping tax
- Webhook pings will now cleanup previously created products in Stripe. Added a CLI command to clean products created from older versions of the module.
- Updated locale translation files
- Added a missing ACH icon
- The refund amount that is displayed in the payment info block is now formatted based on the store currency and exchange rates
- The "View in Stripe" links in the payment info block will now recognize if the order was placed in Test Mode and link to the correct Stripe page
- Fixed an admin area initialization issue that was breaking the payment form in certain scenarios
- Fixed ACH refunds issue
- Fixed an issue with Apple Pay when terms and conditions must be manually checked
- Fixed an automatic invoicing issue when capturing a payment from the Stripe dashboard
- Fixed a configurable subscriptions refund issue
- Integration fix with latest FireCheckout
- If saved cards are disabled, hide the checkbox from the admin area's New Order page
- Payment intents are now stored in the customer session instead of the cache

## 1.7.1 - 2020-03-23

- Added an icon for ACH at the checkout
- ACH orders which are pending payment will now automatically create a pending invoice in the Magento admin
- ACH payments which are refunded from the Stripe dashboard will now automatically create a Credit Memo in Magento
- Various improvements with webhooks handling for multi-Stripe account configurations
- Updated FPX implementation based on changes to the webhooks API
- Backwards compatibility fixes in My Saved Cards section and in the Magento admin area for Magento 2.0 and 2.1
- Fixed a refund issue for multi-currency stores when the "Pay in store currency" setting is disabled
- Fixed a redirect issue with ACH when another APM was used before it in the same customer session
- Fixed a Stripe Elements initialization issue in the admin area

## 1.7.0 - 2020-03-13

- `MAJOR`: Added support for ACH bank transfers at the checkout.
- The "Pay in Store Currency" configuration option is no longer used for alternative payment methods, it is only used for card payments and wallets.
- Improved automatic webhooks configuration.
- When the Stripe PHP library dependency is missing, errors are now handled gracefully system-wide, all modules are automatically disabled, and an admin notification is displayed.
- Fixed a saved cards issue at the checkout.
- Fixed an integration problem with the BoostMyShop POS system.
- Improved REST API support - The Magento customer ID is now associated with the Stripe Customer ID in the database.
- Performance optimizations in the Magento admin area.

## 1.6.0 - 2020-02-21

- `MAJOR`: Added support for Klarna. Customers can now pay later or pay in installments.
- Automatic webhooks configuration will now also reconfigure existing webhook signing secrets.
- Automatic webhook configuration errors are now displayed in the Magento admin.
- Subscriptions initial fee is now a taxable amount.
- Terms and conditions are now displayed and validated below the Apple Pay button at the checkout page, when it is configured to be displayed above all payment methods.
- A webhooks queuing system has been added for events arriving at the same time.
- When a payment error or a 3DS authentication occurs, Magento order IDs no longer jump increment IDs for the 2nd payment attempt.
- Additional subscription info in the cart are now enabled by default.
- Moved Apple Pay configuration inside the Apple Pay section.
- Fixed Apple Pay amount not updating after a coupon is applied.
- Fixed some checkout javascript errors with alternative payment methods.
- Other minor code improvements.

## 1.5.2 - 2020-02-05

- Webhooks can now be automatically configured from the module's configuration section
- Bugfixes affecting older versions of v1.5.x
- Fixed Magento compilation issues with older versions of PHP

## 1.5.1 - 2019-12-10

- Fixes with Apple Pay affecting v1.5.0

## 1.5.0 - 2019-12-05

- `MAJOR`: Customers can now purchase multiple subscriptions and multiple regular products in the same shopping cart. Mixed carts also work in multi-shipping checkout and from the admin area.
- Added support for SetupIntents, which can be used to authorize the customer with trialing subscriptions, before the initial payment is collected.
- Card icons have been added to the checkout alongside the payment method title.
- Icons have been added to all alternative payment methods (European, China, Malaysia).
- The shipping cost for subscriptions can now be added as a separate recurring invoice item. In mixed subscription carts, shipping is recalculated on a per-subscription basis instead of a per-order calculation.
- Improved recurring order invoices, the tax and shipping will be displayed separately from the invoice grand total.
- Improved support for various OneStepCheckout modules, adjustments for better display of payment form in 3-column layouts.
- Payments which have only been authorized can now also be captured through cron jobs, not just from the admin area.
- Fixed a bug where changes in the billing address would not be passed to the Stripe API.
- India exports has been deprecated, performance optimizations after depreciation.

## 1.4.0 - 2019-11-01

- `MAJOR`: Recurring subscription payments will now generate new orders in Magento, instead of invoicing the old order multiple times. This allows for a better workflow with product shipments and inventory management, and fixes refund problems of order invoices.
- Added support for partial captures in Stripe; a partial invoice will now be correctly created in Magento through webhooks
- Both initial and recurring subscription orders will now display the full payment details in the Magento admin order page.
- Better handling of insufficient_funds card declined messages when buying subscriptions.
- Various fixes with webhooks when capturing or refunding payments from the Stripe dashboard - credit memos and invoices are now correctly created in Magento.
- Configurable products can no longer have any subscriptions configuration, fixes problems caused by user misconfiguration.
- Fixed a problem when capturing payments that had expired - in some cases the payment could not be recreated even if the customer had a saved card.
- Fixed a crash in the Magento admin area when viewing orders for products that have been deleted.
- Fixed a webhooks signature notice from the Magento log files.

## 1.3.1 - 2019-10-10

- Fixed quote loading issue when placing orders through the Magento REST API

## 1.3.0 - 2019-10-03

- Added SCA MOTO Exemptions support in the Magento admin
- Guest customers are now associated with their Stripe customer ID if they register immediately after placing an order
- The Stripe.js locale is now overwritten based on the Magento store view locale configuration
- Deprecated Email Receipt configuration option, this should now be disabled from the Stripe dashboard
- Added a partner ID in the module's app info
- Fixed placing subscription orders from the admin area
- Fixed refunds through the Stripe dashboard (no credit memo was being created)
- Fixed an installation problem with the Magento area code
- Fixed a Stripe account retrieval problem with some specific web server configurations

## 1.2.1 - 2019-09-18

- Compatibility fix with older versions of Magento 2
- Fixed card country not appearing in the Magento admin
- In some cases the Configure button in the admin area could not be clicked
- Improvements with subscription order invoicing
- Fix for configurable products when added to the card through the catalog or search pages

## 1.2.0 - 2019-08-27

- Added support for Stripe Billing / Subscriptions.
- Added support for the FPX payment method (Malaysia).
- Added support for 3D Secure v2 at the Multi-Shipping checkout page (SCA compliance)
- Added support for India exports as per country regulations. Full customer details are collected for all export sales.
- Added support for creating admin MOTO orders for guest customers (with no Magento customer login).
- Performance improvements (less API calls)
- Upgraded to Stripe API version 2019-02-19.
- The creation of Payment Intents is now deferred until the very final step of the checkout. Incomplete payment intents will no longer be shown in the Stripe Dashboard.
- The "Authentication Required" message at the checkout prior to the 3D Secure modal is now hidden completely
- Fixed an issue with capturing Authorized Only payments from the Magento admin area.
- Various fixes and improvements with Apple Pay

## 1.1.2 - 2019-06-10

- Improvements with multi-shipping checkout.
- Compatibility improvements with M2EPro and some other 3rd party modules.
- New translation entries.
- Fixed the street and CVC checks not displaying correctly in the admin order page.

## 1.1.1 - 2019-05-30

- Depreciates support for saved cards created through the Sources API.
- Improves checkout performance.
- Fixed error when trying to capture an expired authorization in the admin area using a saved card.
- Fixed a checkout crash with guest customers about the Payment Intent missing a payment method.

## 1.1.0 - 2019-05-28

- `MAJOR`: Switched from automatic Payment Intents confirmation at the front-end to manual Payment Intents confirmation on the server side. Resolves reported issue with charges not being associated with a Magento order.
- `MAJOR`: Replaced the Sources API with the new Payment Methods API. Deprecated all fallback scenarios to the Charges API.
- Stripe.js v2 has been deprecated, Stripe Elements is now used everywhere.
- When Apple Pay is used on the checkout page, the order is now submitted automatically as soon as the paysheet closes.
- Fixed: In the admin configuration, when the card saving option was set to "Always save cards", it wouldn't have the correct effect.
- Fixed: In the admin configuration, when disabling Apple Pay on the product page or the cart, it wouldn't have the correct effect.
- Fixed a multishipping page validation error with older versions of Magento 2.

## 1.0.0 - 2019-05-14

Initial release.
