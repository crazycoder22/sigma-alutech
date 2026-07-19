/* ============================================
   SIGMA ALUTECH - Theme (light default / dark)
   Loaded synchronously in <head> so the theme
   attribute is set before first paint (no flash).
   ============================================ */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'sigma-theme';
  var THEMES = ['light', 'dark'];
  var DEFAULT_THEME = 'light';

  /** Normalize a stored value to a valid theme. Anything unknown -> default. */
  function resolveTheme(stored) {
    return THEMES.indexOf(stored) !== -1 ? stored : DEFAULT_THEME;
  }

  /** The opposite theme. */
  function nextTheme(theme) {
    return theme === 'dark' ? 'light' : 'dark';
  }

  function readStoredTheme() {
    try {
      return global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
    } catch (e) {
      return null; // storage blocked (private mode etc.)
    }
  }

  /** Set the theme on <html>, persist it, and sync toggle buttons. */
  function applyTheme(theme, doc) {
    doc = doc || global.document;
    theme = resolveTheme(theme);
    doc.documentElement.setAttribute('data-theme', theme);
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) { /* storage blocked */ }
    var buttons = doc.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      buttons[i].setAttribute('aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    return theme;
  }

  function currentTheme(doc) {
    doc = doc || global.document;
    return resolveTheme(doc.documentElement.getAttribute('data-theme'));
  }

  function toggleTheme(doc) {
    doc = doc || global.document;
    return applyTheme(nextTheme(currentTheme(doc)), doc);
  }

  /** Bind click handlers on all [data-theme-toggle] buttons. */
  function bindToggles(doc) {
    doc = doc || global.document;
    var buttons = doc.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () { toggleTheme(doc); });
    }
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_THEME: DEFAULT_THEME,
    resolveTheme: resolveTheme,
    nextTheme: nextTheme,
    applyTheme: applyTheme,
    currentTheme: currentTheme,
    toggleTheme: toggleTheme,
    bindToggles: bindToggles
  };

  // Browser: apply stored theme immediately, bind buttons once DOM is ready.
  if (global.document && global.document.documentElement) {
    global.document.documentElement.setAttribute('data-theme', resolveTheme(readStoredTheme()));
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () {
        applyTheme(currentTheme(), global.document); // sync aria state
        bindToggles(global.document);
      });
    } else {
      applyTheme(currentTheme(), global.document);
      bindToggles(global.document);
    }
    global.SigmaTheme = api;
  }

  // Node (unit tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
