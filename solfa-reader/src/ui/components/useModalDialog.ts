import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react';

function supportsModal(el: HTMLDialogElement): boolean {
  return typeof el.showModal === 'function';
}

/**
 * Drives a native <dialog> from an `open` prop: showModal() gives focus trapping, the top layer,
 * an inert page and Esc / Android-back handling for free. Older engines (and jsdom) fall back to
 * the `open` attribute plus an Escape key handler. Closing always goes through `onClose`, so the
 * caller stays in control (controlled component).
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);

  useEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        if (supportsModal(el)) el.showModal();
        else el.setAttribute('open', '');
      }
      const root = document.documentElement;
      root.classList.add('sr-scroll-lock');
      return () => root.classList.remove('sr-scroll-lock');
    }
    if (el.hasAttribute('open')) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
    return undefined;
  }, [open]);

  const dialogProps = {
    // Esc or the Android back gesture on a modal dialog.
    onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onCloseRef.current();
    },
    // Closed by something else (e.g. <form method="dialog">): tell the owner.
    onClose: () => {
      if (openRef.current) onCloseRef.current();
    },
    // A click on the <dialog> box itself (not its panel) is a click on the backdrop.
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onCloseRef.current();
    },
    onKeyDown: (e: KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === 'Escape' && !supportsModal(e.currentTarget)) {
        e.preventDefault();
        onCloseRef.current();
      }
    },
  };

  return { ref, dialogProps };
}
