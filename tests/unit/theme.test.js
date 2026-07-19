// Unit tests for js/theme.js (pure logic + DOM behavior via jsdom)
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const theme = createRequire(import.meta.url)('../../js/theme.js');

describe('resolveTheme', () => {
  it('defaults to light when nothing is stored', () => {
    expect(theme.resolveTheme(null)).toBe('light');
    expect(theme.resolveTheme(undefined)).toBe('light');
  });

  it('accepts valid themes', () => {
    expect(theme.resolveTheme('light')).toBe('light');
    expect(theme.resolveTheme('dark')).toBe('dark');
  });

  it('falls back to light for garbage values', () => {
    expect(theme.resolveTheme('banana')).toBe('light');
    expect(theme.resolveTheme('')).toBe('light');
    expect(theme.resolveTheme('DARK')).toBe('light');
  });
});

describe('nextTheme', () => {
  it('flips light to dark and back', () => {
    expect(theme.nextTheme('light')).toBe('dark');
    expect(theme.nextTheme('dark')).toBe('light');
  });
});

describe('applyTheme / currentTheme / toggleTheme (DOM)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    document.body.innerHTML =
      '<button data-theme-toggle></button><button data-theme-toggle></button>';
  });

  it('applyTheme sets the data-theme attribute on <html>', () => {
    theme.applyTheme('dark', document);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme persists to localStorage under the sigma-theme key', () => {
    theme.applyTheme('dark', document);
    expect(localStorage.getItem(theme.STORAGE_KEY)).toBe('dark');
  });

  it('applyTheme normalizes invalid input to light', () => {
    theme.applyTheme('bogus', document);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme updates aria state on every toggle button', () => {
    theme.applyTheme('dark', document);
    const buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.getAttribute('aria-label')).toBe('Switch to light theme');
    });
    theme.applyTheme('light', document);
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('currentTheme reads the attribute, defaulting to light', () => {
    expect(theme.currentTheme(document)).toBe('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(theme.currentTheme(document)).toBe('dark');
  });

  it('toggleTheme flips the active theme and persists it', () => {
    theme.applyTheme('light', document);
    expect(theme.toggleTheme(document)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(theme.STORAGE_KEY)).toBe('dark');
    expect(theme.toggleTheme(document)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('bindToggles makes buttons toggle the theme on click', () => {
    theme.applyTheme('light', document);
    theme.bindToggles(document);
    document.querySelector('[data-theme-toggle]').click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
