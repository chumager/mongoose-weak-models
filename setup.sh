#!/bin/sh
#yarn 
touch yarn.lock 
yarn set version berry
yarn
yarn dlx @yarnpkg/pnpify --sdk vim
yarn plugin import version
yarn plugin import interactive-tools
yarn config set packageExtensions --json '{"gulp-javascript-obfuscator@*": {"dependencies": {"vinyl-sourcemaps-apply":"*"}}}' \
  || echo "Si no puede cargar la configuracion para gulp-javascript-obfuscator, entonces agregue la siguiente línea a .yarnrc.yml:
packageExtensions:
  gulp-javascript-obfuscator@*:
    dependencies:
      vinyl-sourcemaps-apply: \"*\"
Luego proceda a ejecutar yarn nuevamente
"
yarn install
#git

