export function initPurchaseCheckout() {
  const trigger = document.querySelector<HTMLAnchorElement>(
    '[data-checkout-open]',
  );
  const dialog = document.querySelector<HTMLDialogElement>('.checkout-dialog');
  const frame = dialog?.querySelector<HTMLIFrameElement>(
    '.checkout-dialog-frame',
  );
  const closeButton = dialog?.querySelector<HTMLButtonElement>(
    '[data-checkout-close]',
  );

  if (!trigger || !dialog || !frame || !closeButton || !dialog.showModal)
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
      dialog.classList.remove('is-ready');
      dialog.showModal();
      frame.src = trigger.href;
    },
    { signal },
  );

  closeButton.addEventListener('click', () => dialog.close(), { signal });
  frame.addEventListener(
    'load',
    () => {
      if (dialog.open) dialog.classList.add('is-ready');
    },
    { signal },
  );
  dialog.addEventListener(
    'close',
    () => {
      frame.removeAttribute('src');
      dialog.classList.remove('is-ready');
      trigger.focus();
    },
    { signal },
  );

  return () => {
    if (dialog.open) dialog.close();
    controller.abort();
  };
}
