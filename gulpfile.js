"use strict";
const {obfuscate: needObfuscate} = require("./package.json");
console.log("needObfuscate", needObfuscate);
const {src, dest, parallel, watch: w} = require("gulp");
const terser = require("gulp-terser");
const gif = require("gulp-if");
const gobf = require("gulp-javascript-obfuscator");
const debug = require("gulp-debug");
const babel = require("gulp-babel");
const path = require("path");
const del = require("del");
const searchPath = ["src/**/*.js"];
function js() {
  return src(searchPath, {base: "src"})
    .pipe(debug())
    .pipe(babel())
    .pipe(terser())
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(dest("dist/"));
}
function obfuscate(path) {
  return src(path, {base: "src"})
    .pipe(debug({title: "Minimizando"}))
    .pipe(babel())
    .pipe(terser())
    .pipe(gif(needObfuscate, debug({title: "Ofuscando"})))
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(dest("dist/"));
}
function watch() {
  const watcher = w(searchPath);
  watcher.on("change", obfuscate);
  watcher.on("add", obfuscate);
  watcher.on("unlink", filePath => {
    const filePathFromSrc = path.relative(path.resolve("src"), filePath);
    const destFilePath = path.resolve("dist", filePathFromSrc);
    console.log("Eliminando", destFilePath);
    del.sync(destFilePath);
  });
  return watcher;
}
exports.watch = watch;
exports.js = js;
exports.default = parallel(js, watch);
