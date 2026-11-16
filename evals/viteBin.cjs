/* Where Vite's command is, from a folder: found the way Node finds a package, from the folder up, so the evals run
   where Vite is installed above the app rather than in its own node_modules (a rebuild in a subfolder, a workspace
   that hoists its packages; drill, 15 Nov). Null when Vite isn't installed anywhere above it. */
const path = require('node:path');
const { createRequire } = require('node:module');

function viteBin(from) {
  try {
    const pkg = createRequire(path.join(from, 'package.json')).resolve('vite/package.json');
    return path.join(path.dirname(pkg), 'bin', 'vite.js');
  } catch {
    return null;
  }
}

module.exports = { viteBin };
