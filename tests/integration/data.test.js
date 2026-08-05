// Integration tests: the JSON content files, the CSS theme tokens, the HTML
// pages, and the CMS config must all agree with each other.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const productsData = JSON.parse(read('data/products.json'));
const projectsData = JSON.parse(read('data/projects.json'));

const PRODUCT_CATEGORY_IDS = ['windows', 'doors', 'sliding', 'facades', 'balustrades', 'handles'];
const PROJECT_CATEGORY_IDS = ['hospitality', 'residential', 'commercial', 'institutional', 'industrial'];

describe('data/products.json', () => {
  it('has the 6 expected categories', () => {
    expect(productsData.categories.map((c) => c.id).sort()).toEqual(
      [...PRODUCT_CATEGORY_IDS].sort()
    );
  });

  it('every product has all required fields', () => {
    for (const cat of productsData.categories) {
      for (const p of cat.products) {
        for (const field of ['id', 'name', 'series', 'topology', 'tagline', 'description']) {
          expect(p[field], `${cat.id}/${p.id}: missing ${field}`).toBeTypeOf('string');
          expect(p[field].length, `${cat.id}/${p.id}: empty ${field}`).toBeGreaterThan(0);
        }
        expect(Array.isArray(p.features), `${p.id}: features`).toBe(true);
        expect(Array.isArray(p.finishes), `${p.id}: finishes`).toBe(true);
        expect(Array.isArray(p.images), `${p.id}: images`).toBe(true);
        expect(typeof p.specifications, `${p.id}: specifications`).toBe('object');
        expect(typeof p.featured, `${p.id}: featured`).toBe('boolean');
      }
    }
  });

  it('product ids are unique across all categories', () => {
    const ids = productsData.categories.flatMap((c) => c.products.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every referenced product image exists on disk', () => {
    for (const cat of productsData.categories) {
      for (const p of cat.products) {
        for (const img of p.images) {
          expect(exists(img), `${p.id}: missing file ${img}`).toBe(true);
        }
      }
    }
  });
});

describe('data/projects.json', () => {
  it('every project has all required fields and a valid category', () => {
    for (const p of projectsData.projects) {
      for (const field of ['id', 'name', 'location', 'type', 'description', 'thumbnail']) {
        expect(p[field], `${p.id}: missing ${field}`).toBeTypeOf('string');
      }
      expect(PROJECT_CATEGORY_IDS, `${p.id}: bad category ${p.category}`).toContain(p.category);
      expect(p.year, `${p.id}: year`).toBeTypeOf('number');
      expect(p.year).toBeGreaterThanOrEqual(2000);
      expect(Array.isArray(p.productsUsed), `${p.id}: productsUsed`).toBe(true);
      for (const pu of p.productsUsed) {
        expect(PRODUCT_CATEGORY_IDS, `${p.id}: bad productsUsed ${pu}`).toContain(pu);
      }
    }
  });

  it('project ids are unique', () => {
    const ids = projectsData.projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every thumbnail and gallery image exists on disk', () => {
    for (const p of projectsData.projects) {
      expect(exists(p.thumbnail), `${p.id}: missing thumbnail ${p.thumbnail}`).toBe(true);
      for (const img of p.images || []) {
        expect(exists(img), `${p.id}: missing image ${img}`).toBe(true);
      }
    }
  });

  it('filter categories cover every category used by a project', () => {
    const filterIds = projectsData.categories.map((c) => c.id);
    for (const p of projectsData.projects) {
      expect(filterIds, `filter missing for ${p.category}`).toContain(p.category);
    }
  });
});

describe('theme CSS tokens', () => {
  const css = read('css/variables.css');

  it('light theme is the default (:root has a light background)', () => {
    const rootBlock = css.split(':root[data-theme="dark"]')[0];
    expect(rootBlock).toContain('--bg-primary: #faf9f6');
  });

  it('defines a dark override block', () => {
    expect(css).toContain(':root[data-theme="dark"]');
    const darkBlock = css.split(':root[data-theme="dark"]')[1];
    expect(darkBlock).toContain('--bg-primary: #0a0a0a');
  });

  it('no stylesheet references undefined CSS variables', () => {
    const defined = new Set(
      [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
    );
    for (const file of ['base.css', 'layout.css', 'components.css', 'pages.css']) {
      const sheet = read(`css/${file}`);
      for (const [, name] of sheet.matchAll(/var\((--[\w-]+)[),]/g)) {
        expect(defined.has(name), `${file}: var(${name}) is undefined`).toBe(true);
      }
    }
  });
});

describe('HTML pages', () => {
  for (const page of ['index.html', 'products.html', 'projects.html']) {
    it(`${page} loads theme.js and has a theme toggle`, () => {
      const html = read(page);
      expect(html).toContain('js/theme.js');
      expect(html).toContain('data-theme-toggle');
    });
  }

  it('index.html marks its nav as overlay (light text over dark hero)', () => {
    expect(read('index.html')).toContain('nav--overlay');
  });
});

describe('admin/config.yml (Decap CMS)', () => {
  const config = yaml.load(read('admin/config.yml'));

  it('parses and targets the right repo/branch', () => {
    expect(config.backend.name).toBe('github');
    expect(config.backend.repo).toBe('Dyuthix/sigma-alutech');
    expect(config.backend.branch).toBe('main');
  });

  it('edits exactly the two data files', () => {
    const files = config.collections[0].files.map((f) => f.file).sort();
    expect(files).toEqual(['data/products.json', 'data/projects.json'].sort());
  });

  it('declares json format for both files', () => {
    for (const f of config.collections[0].files) {
      expect(f.format).toBe('json');
    }
  });

  it('CMS project category options match the site categories', () => {
    const projectsFile = config.collections[0].files.find((f) => f.name === 'projects');
    const projectFields = projectsFile.fields.find((f) => f.name === 'projects').fields;
    const catField = projectFields.find((f) => f.name === 'category');
    expect(catField.options.sort()).toEqual([...PROJECT_CATEGORY_IDS].sort());
    const puField = projectFields.find((f) => f.name === 'productsUsed');
    expect(puField.options.sort()).toEqual([...PRODUCT_CATEGORY_IDS].sort());
  });
});
