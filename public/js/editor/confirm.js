// The confirmation dialog of the page (#confirmBackdrop), shared by the
// settings panels and the toolbar. The dialog itself is built by
// confirm-dialog.js, which has no knowledge of this page.
import { t } from "../i18n.js";
import { createConfirmDialog } from "./confirm-dialog.js";

export const confirmDialog = createConfirmDialog({
  backdrop: document.getElementById("confirmBackdrop"),
  icon: document.getElementById("confirmIcon"),
  title: document.getElementById("confirmTitle"),
  message: document.getElementById("confirmMessage"),
  actions: document.getElementById("confirmActions")
});
export const openConfirm = confirmDialog.open;

// Confirmation of an irreversible action other than a deletion.
export function confirmDanger({ title, message, confirmLabel }) {
  return openConfirm({
    title,
    message,
    actions: [
      { id: "cancel", label: t("cancelBtn") },
      { id: "confirm", label: confirmLabel, className: "action-btn danger" }
    ]
  }).then(result => result === "confirm");
}

export function confirmDelete(message) {
  return openConfirm({
    title: t("confirmDeleteTitle"),
    message,
    actions: [
      { id: "cancel", label: t("cancelBtn") },
      { id: "confirm", label: t("deleteLabel"), className: "action-btn danger" }
    ]
  }).then(result => result === "confirm");
}
