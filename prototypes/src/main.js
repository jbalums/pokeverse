// Verdant Town 3D: entry module, loaded by verdant-town-3d.html.
// The game was one inline script; each NN-*.js file is one of its sections, in the same order. Each module imports the one
// numbered before it first, so importing the last one here makes them run 01, 02, 03... like the old single script (their
// other imports point at modules already being loaded, which the browser does not run early). Function declarations can be
// called across modules before their module has run, as before; a top-level const or let cannot be used before its module runs.
// A module may not assign another module's top-level let directly: it calls the owner's setX() for that variable.
import './45-onboarding.js';
