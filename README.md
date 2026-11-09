# Facefield

A living wall of generative faces. A mobile-first, dependency-free HTML/CSS/JavaScript prototype, drawn with SVG.

## Run

From this directory:

```sh
python3 -m http.server 8000
```

Open the server in a browser. Tap or keyboard-activate any face to regenerate it. **Shuffle** creates a new grid. **Copy seed link** copies a URL that reproduces the grid, including individually regenerated faces. A URL such as `?seed=facefield` always starts with the same 192 faces. Resizing changes the column count without regenerating faces.

## Publish

The files work directly on GitHub Pages with no build step. Configure Pages to serve the repository root when ready to publish.

## Structure

- `faces.js`: deterministic random streams and separate eye, nose, and mouth generators, in a 100 × 100 SVG coordinate system.
- `app.js`: grid state, tile interactions, URL seed and revision persistence.
- `styles.css`: edge-to-edge responsive layout and controls.

No external assets, fonts, packages, API keys, or services are required. No animations are used.

## Checks

With Node.js 22 or newer:

```sh
node --test tests/faces.test.mjs
```

The tests check deterministic generation, independent revisions, eye and pupil bounds, coordinated gaze, nose segments, and palette coverage over 1,920 faces.
