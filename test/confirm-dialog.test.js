"use strict";
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

function element() {
  const listeners = {};
  const classes = new Set();
  return {
    listeners,
    children: [],
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
    replaceChildren() {
      this.children = [];
    },
    appendChild(child) {
      this.children.push(child);
    },
    querySelector() {
      return this.children[0];
    },
    focus() {}
  };
}
async function main() {
  const { createConfirmDialog } = await import(
    pathToFileURL(path.join(__dirname, "../public/js/editor/confirm-dialog.js")).href
  );
  const backdrop = element(),
    icon = element(),
    title = element(),
    message = element(),
    actions = element();
  const dialog = createConfirmDialog({
    backdrop,
    icon,
    title,
    message,
    actions,
    documentRef: { createElement: element }
  });
  const first = dialog.open({
    title: "Test",
    message: "Test",
    actions: [{ id: "ok", label: "OK" }]
  });
  assert.equal(dialog.isOpen(), true);
  actions.children[0].listeners.click();
  assert.equal(await first, "ok");
  assert.equal(dialog.isOpen(), false);
  const replaced = dialog.open({ title: "A", message: "A", actions: [] });
  const next = dialog.open({ title: "B", message: "B", actions: [] });
  assert.equal(await replaced, "cancel");
  backdrop.listeners.click({ target: backdrop });
  assert.equal(await next, "cancel");
  console.log("PASS interface : dialogue de confirmation et annulation");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
