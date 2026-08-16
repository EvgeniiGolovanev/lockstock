import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type AccessibilityDialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function isFocusable(element: HTMLElement | null): element is HTMLElement {
  if (!element) {
    return false;
  }

  return !element.hasAttribute("disabled") && element.tabIndex !== -1;
}

export function AccessibilityDialog({ title, onClose, children }: AccessibilityDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusInitial = () => {
      const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
      const target = initialFocus ?? focusables[0] ?? closeButtonRef.current;
      target?.focus();
    };

    focusInitial();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = activeElement ? focusables.indexOf(activeElement) : -1;
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
        : (currentIndex === -1 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1);

      event.preventDefault();
      focusables[nextIndex]?.focus();
    };

    dialog.addEventListener("keydown", onKeyDown);

    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div className="modal-card">
        <div className="title-row">
          <h4 id={titleId}>{title}</h4>
          <button type="button" className="ghost-btn" aria-label="Close dialog" onClick={onClose} ref={closeButtonRef}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
