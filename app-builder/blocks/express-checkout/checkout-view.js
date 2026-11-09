import { provider as UI, InLineAlert, Icon } from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';
import {
  STATUS,
  PAYMENT_STATUS,
  DIAGNOSTICS,
  CHECKOUT_SELECTOR,
  BLOCKED_CLASS,
  HIDDEN_CLASS,
  LOADING_CLASS,
} from './constants.js';
import { state } from './checkout-state.js';
import { primaryWallet, wallets } from './wallets.js';

/**
 * Remove the current inline payment feedback.
 * @returns {void}
 */
function clearPaymentStatus() {
  state.statusAlert?.remove();
  state.statusAlert = null;
  state.statusContainer?.replaceChildren();
}

/**
 * Render accessible payment feedback using the storefront alert component.
 * @param {string} message Customer-facing payment feedback.
 * @param {string} [status] Payment feedback presentation key.
 * @returns {Promise<Object|null>}
 */
async function setPaymentStatus(message, status = STATUS.INFO) {
  if (!state.statusContainer) return null;
  const config = PAYMENT_STATUS[status] || PAYMENT_STATUS.info;
  clearPaymentStatus();
  try {
    state.statusAlert = await UI.render(InLineAlert, {
      heading: config.heading,
      description: message,
      ...(config.type
        ? {
          type: config.type,
        }
        : {}),
      variant: 'primary',
      icon: h(Icon, {
        source: config.icon,
      }),
      'aria-live': status === STATUS.ERROR ? 'assertive' : 'polite',
      role: status === STATUS.ERROR ? 'alert' : 'status',
    })(state.statusContainer);
  } catch (error) {
    console.warn(DIAGNOSTICS.STATUS_RENDER_FAILED, error);
  }
  return state.statusAlert;
}

/**
 * Find the checkout surface covered while a wallet attempt is active.
 * @returns {Element}
 */
function getBlockingTarget() {
  return (
    primaryWallet.container?.closest?.(CHECKOUT_SELECTOR)
    || primaryWallet.container?.closest?.('form')
    || document.body
  );
}

/**
 * Toggle the checkout overlay and its accessible busy state.
 * @param {boolean} blocked Whether to block checkout interaction.
 * @returns {void}
 */
function setCheckoutBlocked(blocked) {
  const target = getBlockingTarget();
  if (!target) {
    return;
  }
  target.classList.toggle(BLOCKED_CLASS, blocked);
  if (blocked) {
    target.setAttribute('aria-busy', 'true');
  } else {
    target.removeAttribute('aria-busy');
  }
}

/**
 * Toggle a wallet container and remove its initial loading state.
 * @param {Element} container Wallet container to update.
 * @param {boolean} visible Whether the wallet container should be visible.
 * @returns {void}
 */
function setWalletContainerVisible(container, visible) {
  if (!container) {
    return;
  }
  container.classList.toggle(HIDDEN_CLASS, !visible);
  container.classList.remove(LOADING_CLASS);
  container.hidden = !visible;
}

/**
 * Render availability for each wallet and the surrounding Express section.
 * @returns {void}
 */
function syncWalletVisibility() {
  wallets.forEach((wallet) => setWalletContainerVisible(wallet.container, wallet.available));
  if (state.blockContainer) {
    state.blockContainer.hidden = !wallets.some((wallet) => wallet.available);
  }
}

/**
 * Hide wallet containers and optionally the whole Express section.
 * @param {boolean} [hideBlock] Whether to hide the surrounding Express section.
 * @returns {void}
 */
function hideExpressCheckout(hideBlock = true) {
  wallets.forEach((wallet) => {
    wallet.available = false;
    setWalletContainerVisible(wallet.container, false);
  });
  if (state.blockContainer) state.blockContainer.hidden = hideBlock;
}

export {
  setCheckoutBlocked,
  setPaymentStatus,
  clearPaymentStatus,
  syncWalletVisibility,
  hideExpressCheckout,
};
