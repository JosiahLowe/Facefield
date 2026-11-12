# Facefield

A living wall of generative faces. A mobile-first, dependency-free HTML/CSS/JavaScript prototype, drawn with SVG. The Earth & Botanical theme uses terracotta, moss, ochre, sage blue, and sand with subtle gradients, warm off-white eyes, and charcoal features.

## Run

From this directory:

```sh
python3 -m http.server 8000
```

Open the server in a browser. The square 1,152-face world starts near its center and supports native horizontal and vertical touch scrolling, preserving the original face scale. Zooming out is restricted to the normal 1× view; zooming in remains available. Tap or keyboard-activate the current singer to queue another offscreen singer after the current melodic phrase finishes naturally. Repeated taps queue only one handoff; the previous singer cannot be selected again immediately. Other face taps leave the grid unchanged. **Change mouths** immediately triggers a new neutral, smiling, or frowning expression on visible faces. Automatic changes continue independently. Neutral returns after at most two expressive states and is held for at least four seconds. With reduced motion enabled, the test changes expression instantly. **Shuffle** creates a new grid. **Enable Sound** unlocks a single singing face near the starting view. Its rising and falling Web Audio phrases mix quarter-note arpeggios and a fifth melodic variation with eighth-note arpeggios (two sequential chord tones per beat), sustained endings, breaths, and fuller vibrato repeats until muted or the page is hidden; **Mute Sound** stops playback. Volume follows the singer’s distance from the visible screen center, fading smoothly to a quiet nonzero level far away. A single reusable StereoPannerNode smoothly places the voice left or right of the screen center, capped at ±0.65 to retain sound in both ears; vertical movement only affects distance volume. **Offscreen singer** waits for the current phrase to finish, then randomly hands a different melody on the next chord of a shared C-major I–V–vi–IV progression (C major → G major → A minor → F major, repeating), with a randomly chosen lower, original, or higher octave to another existing face, at least one screen beyond the current view, with no visible-face fallback, without scrolling, regenerating faces, or enabling sound while muted. Each singer also gets a slightly different sine-dominant voice with quiet triangle and square harmonics. Reduced motion keeps the singing mouth still. **Copy seed link** copies a URL that reproduces the grid, including any revisions restored from older links. A URL such as `?seed=facefield` always starts with the same 192 faces. Resizing changes the column count without regenerating faces.

A single tiny botanical fly wanders in world coordinates, mixing brief focused hovering, short darts, curling turns, repeated diagonal trips across the viewport, and rapid wing flutter. Its wings sweep back behind the head; every focused pause is followed by a departure toward a different area. Its size and soft shadow vary subtly with altitude. After a quick scroll it stays behind briefly, then accelerates back from the departure direction and resumes wandering. It ignores taps and pauses with reduced motion. Visible faces smoothly follow it within a 320-world-pixel radius (with full attention within 120 pixels), with coordinated pupils, a soft proximity falloff, a slight reaction lag, and a gradual return to idle gaze. Tracking preserves eyelids and blinking and does not affect audio. Tune `FLY_TRACKING.detectionRadius` (world pixels), `fullAttentionRadius` (the nearby zone with full attention), `reactionTime`, and `releaseTime` (seconds) in `behavior.js`.

## Publish

The files work directly on GitHub Pages with no build step. Configure Pages to serve the repository root when ready to publish.

## Structure

- `palette.js`: centralized base colors, variations, contrast guard, gradients, eyelids, and UI colors.
- `mosaic.js`: seeded, gapless 4 × 4 patches with eight faces in four tile sizes; squares and rectangles, some with subtly rounded corners, preserve circular eyes and feature proportions.
- `faces.js`: deterministic random streams and separate eye, nose, and mouth generators, in a 100 × 100 SVG coordinate system.
- `app.js`: grid state, tile interactions, URL seed and revision persistence.
- `fly.js`: one decorative world-space fly with delayed viewport following and lightweight flight physics.
- `singing.js`: one user-activated Web Audio melody and mouth synchronization using the audio clock.
- `behavior.js`: seeded personalities, gaze interpolation, blinking, mouth expression transitions, visibility scheduling, and reduced-motion support.
- `flowers.js`: seeded world-space flower sites, singer density and style, growth/wilting history, and culled SVG animation.
- `styles.css`: edge-to-edge responsive layout and controls.

No external assets, fonts, packages, API keys, or services are required. Visible faces look around, blink, and choose between neutral, smiling, and frowning expressions independently. Mouth transitions take 1.2–1.8 seconds with gentle ease-in/out and personality-dependent pauses of 2.5–9 seconds. Their personality is seeded; live timing varies per session. Animation pauses offscreen and in hidden tabs, and is disabled when reduced motion is requested.

Geometric flowers grow in the space around facial features, with conservative clearance for petals, sway and drooping stems. Their seeded mosaic coordinates remain fixed while scrolling and scale with the faces on resize. Ordinary scattered flowers remain throughout the world. Each singer has a seeded dominant color, petal shape and petal count; a broad, irregular density gradient leads toward that singer. About 38% of a new patch blooms immediately as a directional cue, while the rest grows from buds over 10–20 seconds. Mature flowers gently expand with the existing audio-clock envelope, with stronger movement on sustained notes and near the singer. Idle stems sway independently. Muting stops music response; reduced motion holds sway and petals still while lifecycle changes continue.

After a handoff, the previous patch stops responding, gradually dries and droops over 10–20 seconds, and leaves up to three dried flowers. History persists while exploring the current world in this page session; reloading or shuffling resets history. There are at most 48 remnants and four retiring patches (rapid repeated muted handoffs settle the oldest early). A spatial index culls offscreen flowers, and at most 420 flowers are rendered, with current vegetation taking priority. Flower geometry shares the face animation loop at 30 Hz; population reconciliation runs at about 8 Hz. The fly occasionally investigates a nearby blossom, then resumes wandering; viewport pursuit and eye tracking retain priority.

## Checks

With Node.js 22 or newer:

```sh
node --test tests/*.test.mjs
```

The tests check deterministic generation, independent revisions, eye and pupil bounds, coordinated gaze, nose segments, and palette coverage over 1,920 faces.

Browser validation (with Playwright and Chromium available, and the server running):

```sh
node tests/browser.cjs
node tests/mosaic-browser.cjs
node tests/world-browser.cjs
node tests/singing-browser.cjs
node tests/distance-audio-browser.cjs
node tests/stereo-audio-browser.cjs
node tests/mouth-button.cjs
node tests/fly-browser.cjs
node tests/tracking-browser.cjs
node tests/tracking-app-browser.cjs
node tests/flowers-browser.cjs
```

Use `FACEFIELD_URL` for another server address and `CHROMIUM_PATH` for another Chromium executable. This check watches eighteen seconds of live animation, checking pupil containment and coordination, independent full blinks, offscreen suspension, reduced-motion restoration, and singer advancement.

Flower unit checks cover deterministic placement and feature clearance, density gradients, immediate navigation cues, growth and retirement, stable remnants, bounded history and occasional fly visits. The flower browser check exercises scroll return, actual SVG feature clearance, audio pulses and muting, singer transitions, reduced motion and frame timing at mobile and desktop viewport sizes. These Chromium checks do not substitute for testing on physical iOS Safari.
