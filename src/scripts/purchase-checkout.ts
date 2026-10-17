export function initPurchaseCheckout() {
  const trigger = document.querySelector<HTMLAnchorElement>(
    '[data-checkout-open]',
  );
  const dialog = document.querySelector<HTMLDialogElement>('.checkout-dialog');
  const continueLink = dialog?.querySelector<HTMLAnchorElement>(
    '[data-checkout-continue]',
  );
  const closeButton = dialog?.querySelector<HTMLButtonElement>(
    '[data-checkout-close]',
  );

  if (!trigger || !dialog || !continueLink || !closeButton || !dialog.showModal)
    return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  trigger.addEventListener(
    'click',
    (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      event.preventDefault();
      dialog.showModal();
    },
    { signal },
  );

  closeButton.addEventListener('click', () => dialog.close(), { signal });
  continueLink.addEventListener(
    'click',
    (event) => {
      const widgetButton = document.querySelector<HTMLButtonElement>(
        '.wompi_button_widget > button',
      );
      if (!widgetButton) return;

      event.preventDefault();
      dialog.close();
      widgetButton.click();
    },
    { signal },
  );
  dialog.addEventListener(
    'close',
    () => {
      trigger.focus();
    },
    { signal },
  );

  return () => {
    if (dialog.open) dialog.close();
    controller.abort();
  };
}
