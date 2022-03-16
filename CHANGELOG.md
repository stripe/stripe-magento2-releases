# Changelog

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
