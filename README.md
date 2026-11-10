# Facefield

A living wall of generative faces. A mobile-first, dependency-free HTML/CSS/JavaScript prototype, drawn with SVG.

## Run

From this directory:

```sh
python3 -m http.server 8000
```

Open the server in a browser. Tap or keyboard-activate any face to regenerate it. **Flip mouths** immediately switches each visible mouth to the opposite of its currently displayed expression. Each tap flips again; automatic expression changes continue afterward. With reduced motion enabled, the test changes expression instantly. **Shuffle** creates a new grid. **Copy seed link** copies a URL that reproduces the grid, including individually regenerated faces. A URL such as `?seed=facefield` always starts with the same 192 faces. Resizing changes the column count without regenerating faces.

## Publish

The files work directly on GitHub Pages with no build step. Configure Pages to serve the repository root when ready to publish.

## Structure

- `faces.js`: deterministic random streams and separate eye, nose, and mouth generators, in a 100 × 100 SVG coordinate system.
- `app.js`: grid state, tile interactions, URL seed and revision persistence.
- `behavior.js`: seeded personalities, gaze interpolation, blinking, mouth expression transitions, visibility scheduling, and reduced-motion support.
- `styles.css`: edge-to-edge responsive layout and controls.

No external assets, fonts, packages, API keys, or services are required. Visible faces look around, blink, and switch between smiles and frowns independently. Mouth transitions take 0.8–2 seconds with personality-dependent pauses of 4–12 seconds. Their personality is seeded; live timing varies per session. Animation pauses offscreen and in hidden tabs, and is disabled when reduced motion is requested.

## Checks

With Node.js 22 or newer:

```sh
node --test tests/*.test.mjs
```

The tests check deterministic generation, independent revisions, eye and pupil bounds, coordinated gaze, nose segments, and palette coverage over 1,920 faces.

Browser validation (with Playwright and Chromium available, and the server running):

```sh
node tests/browser.cjs
```

Use `FACEFIELD_URL` for another server address and `CHROMIUM_PATH` for another Chromium executable. This check watches ten seconds of live animation, checking pupil containment and coordination, independent full blinks, offscreen suspension, reduced-motion restoration, and regeneration.
