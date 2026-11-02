import { useEffect, type RefObject } from "react";
import { useDialogLayer } from "./ModalDialog";

/**
 * Makes a window drawn without ModalDialog work by keyboard (HR's and the Administrator's Request Details, which a
 * row's View button opens): it takes the focus, answers Esc, keeps Tab inside, and gives the focus back to what
 * opened it. `openKey` names what is open, or nothing while it is closed. While `busy` (an action on its way) Esc
 * leaves it open, so the answer lands where the officer is looking.
 */
export function useDetailsWindow(panelRef: RefObject<HTMLElement | null>, openKey: string | null | undefined, onClose: () => void, busy = false) {
  useDialogLayer(panelRef, onClose, busy, !!openKey);
  useEffect(() => {
    if (!openKey) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [openKey]);
}
