"use strict";
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
async function main() {
  const { moveItem, makeDraggable } = await import(
    pathToFileURL(path.join(__dirname, "../public/js/editor-drag.js")).href
  );
  const values = ["a", "b", "c"];
  moveItem(values, 0, 2);
  assert.deepEqual(values, ["b", "c", "a"]);
  const handlers = {};
  const row = {
    classList: { add() {}, remove() {} },
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    }
  };
  let rendered = 0;
  makeDraggable(row, values, 0, () => rendered++);
  handlers.drop({ preventDefault() {}, dataTransfer: { getData: () => "9" } });
  assert.equal(rendered, 0);
  handlers.drop({ preventDefault() {}, dataTransfer: { getData: () => "2" } });
  assert.deepEqual(values, ["a", "b", "c"]);
  assert.equal(rendered, 1);
  console.log("PASS editeur : reordonnancement et indices invalides");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
