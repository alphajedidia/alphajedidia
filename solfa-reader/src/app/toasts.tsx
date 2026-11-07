// Toasts for the whole app: `useToast().show({ message, tone })` from any screen.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { ToastHost, type ToastItem } from '../ui';

export type ToastInput = Omit<ToastItem, 'id'> & { id?: string };

interface ToastApi {
  /** Show a toast; returns its id. Same `id` = replace the previous toast with that id. */
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Keeps at most 3 toasts on screen (the oldest goes first). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const show = useCallback((toast: ToastInput) => {
    seq.current += 1;
    const id = toast.id ?? `t${seq.current}`;
    setToasts((list) => [...list.filter((x) => x.id !== id), { ...toast, id }].slice(-3));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} label={t('common.notifications')} dismissLabel={t('common.dismiss')} />
    </ToastContext.Provider>
  );
}

/** Toast API of the app. */
export function useToast(): ToastApi {
  const v = useContext(ToastContext);
  if (!v) throw new Error('useToast() outside <ToastProvider>');
  return v;
}
