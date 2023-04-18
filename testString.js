function cleanInput() {
  return split(",")
    .map((str) => str.trim())
    .map((str) => str.replace(/"/g, ""));
}

let my = "test, spec, test2 ".cleanInput();

console.log(my);
