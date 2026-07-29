# Legacy static site

The original hand-written site in the repository root: plain HTML, CSS and
vanilla JS, content in `data/*.json`, images committed to `images/`, deployed
by GitHub Pages, and reachable only at `crazycoder22.github.io/sigma-alutech/`.
`sigmaalutech.in` now serves the Next.js app.

Its replacement — Next.js, Postgres, Blob, a custom admin and payroll — lives
in [`web/`](../web/README.md). **New work belongs there.** Everything below
applies only to the legacy site, and stops mattering the day the domain moves
(see [Domain cutover](../web/README.md#domain-cutover-done)).

---

## Content Management

All content is managed through two JSON files:

| File | Purpose |
|------|---------|
| `data/products.json` | Product catalog (6 categories, 15 products) |
| `data/projects.json` | Client project portfolio (29 projects) |

---

## Adding a New Product

### 1. Add the image

Place your product image in the appropriate category folder:

```
images/products/{category}/{filename}.jpg
```

**Valid categories:** `windows`, `doors`, `sliding`, `facades`, `balustrades`, `handles`

**Recommended:** JPG or PNG, at least 800×600px.

### 2. Add the JSON entry

Open `data/products.json` and add a new object inside the relevant category's array. Here's the full schema:

```json
{
  "id": "casement-window-fy65",
  "name": "FY 65 Casement Window",
  "series": "FY 65",
  "topology": "casement",
  "tagline": "Outward opening window with slim sightlines",
  "description": "Full product description goes here. 2-3 sentences.",
  "features": [
    "Thermally broken profile",
    "Sound insulation up to 42 dB",
    "Water tightness Class E1050"
  ],
  "specifications": {
    "Profile Depth": "65mm",
    "Infill Thickness": "4-28mm",
    "Max Width": "1400mm",
    "Max Height": "2400mm"
  },
  "finishes": ["Anodized", "Powder Coated", "Wood Finish"],
  "images": ["images/products/windows/casement-fy65.jpg"],
  "video": null,
  "featured": true
}
```

### Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique kebab-case identifier (e.g. `casement-window-fy65`) |
| `name` | string | Yes | Display name |
| `series` | string | Yes | Product series (e.g. `"FY 65"`, `"Premium Series"`) |
| `topology` | string | Yes | Product type — used as a badge on cards (e.g. `casement`, `tilt-turn`, `pivot`, `sliding`) |
| `tagline` | string | Yes | Short one-line description shown on the product card |
| `description` | string | Yes | Full description shown in the product detail modal |
| `features` | string[] | Yes | Bullet-point feature list (4-5 items recommended) |
| `specifications` | object | Yes | Key-value pairs of technical specs (free-form keys) |
| `finishes` | string[] | Yes | Available finish options |
| `images` | string[] | Yes | Array of image paths relative to project root. First image is the main display image |
| `video` | string or null | Yes | YouTube **embed** URL (see [Videos](#adding-or-updating-videos)) or `null` |
| `featured` | boolean | Yes | `true` to show on the homepage featured section |

---

## Adding a New Project

### 1. Create the image folder

Create a folder for your project using a kebab-case slug:

```
images/projects/{slug}/
```

Add your images:
- **Thumbnail** — `thumb.jpg` (or `.png`) — shown on the project card grid
- **Gallery images** — `01.jpg`, `02.jpg`, etc. — shown in the detail modal and lightbox

**Recommended:** Thumbnails at least 600×450px. Gallery images at least 1200×800px.

### 2. Add the JSON entry

Open `data/projects.json` and add a new object to the array:

```json
{
  "id": "my-new-project",
  "name": "My New Project",
  "location": "Bangalore, Karnataka",
  "architect": "XYZ Architects",
  "year": 2024,
  "category": "commercial",
  "type": "Corporate Office",
  "description": "Project description goes here. 1-3 sentences.",
  "productsUsed": ["windows", "facades"],
  "thumbnail": "images/projects/my-new-project/thumb.jpg",
  "images": [
    "images/projects/my-new-project/01.jpg",
    "images/projects/my-new-project/02.jpg",
    "images/projects/my-new-project/03.jpg"
  ],
  "video": null,
  "featured": false
}
```

### Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique kebab-case identifier, should match the image folder name |
| `name` | string | Yes | Display name of the project |
| `location` | string | Yes | City/area (e.g. `"Bidadi, Bangalore"`) |
| `architect` | string | Yes | Architect or firm name (use `""` if unknown) |
| `year` | number | Yes | Year of completion (4-digit) |
| `category` | string | Yes | One of: `hospitality`, `residential`, `commercial`, `institutional`, `industrial` |
| `type` | string | Yes | Descriptive project type (e.g. `"Luxury Villas - 98 Units"`, `"5-Star Hotel"`) |
| `description` | string | Yes | Full description shown in the project detail modal |
| `productsUsed` | string[] | Yes | Product category IDs used in the project (e.g. `["windows", "facades"]`) |
| `thumbnail` | string | Yes | Path to thumbnail image for the project card |
| `images` | string[] | Yes | Array of gallery image paths for the detail modal lightbox |
| `video` | string or null | No | YouTube **embed** URL or `null` |
| `featured` | boolean | Yes | `true` to show on the homepage |

---

## Updating Images

### For a product

1. Drop the new image into `images/products/{category}/`
2. Open `data/products.json`, find the product entry
3. Update the `images` array with the new filename:
   ```json
   "images": ["images/products/windows/my-new-image.jpg"]
   ```

### For a project

1. Drop the new image(s) into `images/projects/{slug}/`
2. Open `data/projects.json`, find the project entry
3. Update `thumbnail` and/or `images` array:
   ```json
   "thumbnail": "images/projects/my-project/thumb.jpg",
   "images": [
     "images/projects/my-project/01.jpg",
     "images/projects/my-project/02.jpg"
   ]
   ```

> **Tip:** You can add multiple images to the `images` array — they will appear as a gallery with thumbnail navigation in the detail modal, and users can click to open a full-screen lightbox.

---

## Adding or Updating Videos

Videos are embedded from YouTube. To add a video:

1. Get the YouTube video URL, e.g. `https://www.youtube.com/watch?v=tu9WlspEjo0`
2. Convert it to **embed** format by replacing `watch?v=` with `embed/`:
   ```
   https://www.youtube.com/embed/tu9WlspEjo0
   ```
3. Set the `video` field in the JSON:
   ```json
   "video": "https://www.youtube.com/embed/tu9WlspEjo0"
   ```
4. To remove a video, set the field to `null`:
   ```json
   "video": null
   ```

The video will appear at the bottom of the product/project detail modal.

---

## Theme (Light / Dark)

The site ships with a **light theme by default** and a dark/light toggle button in the navigation bar (moon/sun icon). The visitor's choice is saved in their browser (`localStorage` key `sigma-theme`) and persists across pages and visits.

For developers:
- All colors are design tokens in `css/variables.css`. `:root` holds the light palette; `:root[data-theme="dark"]` holds the dark overrides.
- Text that sits on photos (hero, project/category cards) uses fixed `--text-on-image` tokens so it stays readable in both themes.
- `js/theme.js` sets the `data-theme` attribute before first paint and wires up any button with a `data-theme-toggle` attribute.

---

## Editing Content in the Browser (Decap CMS)

The site includes [Decap CMS](https://decapcms.org) at **`/admin/`** — a friendly editor for `data/products.json` and `data/projects.json` with image uploads (saved to `images/uploads/`). Every save is a commit to this repo, so the site redeploys automatically.

**One-time setup before login works on the live site** (needs ~15 minutes, done once):

1. Deploy the free OAuth gateway [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare Workers (button in its README).
2. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps) with the callback URL shown in the sveltia-cms-auth README, and give the worker its client ID/secret.
3. In `admin/config.yml`, uncomment `base_url:` and set it to your worker URL.

**Local testing without OAuth:** run `npx decap-server` in the repo root alongside `python3 -m http.server 8080`, then open `http://localhost:8080/admin/`.

---

## Tests

Requires Node.js (`npm install` once).

| Command | What it runs |
|---------|--------------|
| `npm test` | Unit tests (theme logic) + integration tests (JSON schema validity, image files exist, CSS token consistency, CMS config sanity) |
| `npm run test:e2e` | Playwright browser tests (theme default/toggle/persistence, catalog rendering, filters, modals, admin page) — run `npx playwright install chromium` once first |
| `npm run test:all` | Everything |

---

## Local Development

To preview the site locally:

```bash
cd /path/to/sigma-alutech
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

> **Note:** You must use a local server (not just open the HTML file directly) because the site fetches JSON data via `fetch()`, which requires HTTP.

---

## Deploying Changes

After making changes, push to GitHub and the site will auto-deploy:

```bash
git add .
git commit -m "Add new product/project"
git push
```

GitHub Pages will rebuild automatically within 1-2 minutes.

---

## Folder Structure

```
sigma-alutech/
├── index.html              # Homepage
├── products.html           # Product catalog page
├── projects.html           # Project showcase page
├── data/
│   ├── products.json       # Product data (edit this to manage products)
│   └── projects.json       # Project data (edit this to manage projects)
├── css/
│   ├── variables.css       # Design tokens (colors, fonts, spacing)
│   ├── base.css            # Reset & typography
│   ├── layout.css          # Grid & layout utilities
│   ├── components.css      # UI components (nav, cards, modals)
│   └── pages.css           # Page-specific styles
├── js/
│   ├── main.js             # Core JS (nav, hero slider, scroll animations)
│   ├── products.js         # Product catalog logic
│   └── projects.js         # Project showcase logic
└── images/
    ├── hero/               # Homepage hero slider images
    ├── products/{category}/ # Product images by category
    └── projects/{slug}/     # Project images by project
```
