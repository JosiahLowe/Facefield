# Facefield

A living wall of generative faces. A mobile-first, dependency-free HTML/CSS/JavaScript prototype, drawn with SVG. The Earth & Botanical theme uses terracotta, moss, ochre, sage blue, and sand with subtle gradients, warm off-white eyes, and charcoal features.

## Run

From this directory:

```sh
python3 -m http.server 8000
```

Open the server in a browser. The square 1,152-face world starts near its center and supports native horizontal and vertical touch scrolling, preserving the original face scale. Zooming out is restricted to the normal 1× view; zooming in remains available. Tap or keyboard-activate the current singer to queue another offscreen singer after the current melodic phrase finishes naturally. Repeated taps queue only one handoff; the previous singer cannot be selected again immediately. Other face taps leave the grid unchanged. **Enable Sound** unlocks a single singing face near the starting view. Its rising and falling Web Audio phrases mix quarter-note arpeggios and a fifth melodic variation with eighth-note arpeggios (two sequential chord tones per beat), sustained endings, breaths, and fuller vibrato repeats until muted or the page is hidden; **Mute Sound** stops playback. Volume follows the singer’s distance from the visible screen center, fading smoothly to a quiet nonzero level far away. A single reusable StereoPannerNode smoothly places the voice left or right of the screen center, capped at ±0.65 to retain sound in both ears; vertical movement only affects distance volume. Tapping the current singer passes its next phrase to an offscreen face, retaining the shared C-major I–V–vi–IV progression, melody and octave variation. Enable Sound / Mute Sound is the only visible control; there are no on-screen instructions. The URL retains a reproducible seed and older face revisions. Resizing changes the column count without regenerating faces.

A single geometric butterfly follows the active singer's flower patch in stable world coordinates. It glides along gently curved paths, slows near real flower heads, sometimes hovers before landing, rests for a few seconds, then takes off to another nearby blossom. After a singer change, the butterfly continues its current activity for a randomized 1–3 seconds before gradually migrating. Travel uses a moderate cruise speed, curved wandering, small circles and brief pauses rather than distance-based acceleration. Attraction is weaker far away and stronger near the garden; a progress watchdog gently strengthens attraction if necessary without increasing speed. It sometimes changes its mind before landing, but always returns to visiting the active singer’s flowers. It never teleports or follows the viewport. If flowers are still growing, it heads toward the singer and visits buds as they open. The butterfly remains attracted to the selected singer while sound is muted. Four plain, solid terracotta and ochre wing ellipses flutter around a small oval body and minimal antennae, with a small offset shadow and no outlines or decorative wing patterns. Nearby visible faces retain coordinated eye tracking and blinking. The existing `FLY_TRACKING` parameters in `behavior.js` now apply to the butterfly. Reduced motion stops flight, wing flutter and flower bending; hidden tabs suspend animation.

A resting butterfly gently loads its flower's stem. The head leans and sinks slightly under that weight, and the butterfly follows the same computed head position. After takeoff, the stem eases upright over a few seconds, returning to its assigned resting posture. Only a handful of recent load records are retained, and offscreen visits use the same flower model without forcing flowers into the DOM.

## Publish

The files work directly on GitHub Pages with no build step. Configure Pages to serve the repository root when ready to publish.

## Structure

- `palette.js`: centralized base colors, variations, contrast guard, gradients, eyelids, and UI colors.
- `mosaic.js`: seeded, gapless 4 × 4 patches with eight faces in four tile sizes; square-edged squares and rectangles preserve circular eyes and feature proportions.
- `faces.js`: deterministic random streams and separate eye, nose, and mouth generators, in a 100 × 100 SVG coordinate system.
- `app.js`: grid state, tile interactions, URL seed and revision persistence.
- `butterfly.js`: one musical butterfly with world-space navigation, real flower visits and delayed curious migration.
- `singing.js`: one user-activated Web Audio melody and mouth synchronization using the audio clock.
- `behavior.js`: seeded personalities, gaze interpolation, blinking, mouth expression transitions, visibility scheduling, and reduced-motion support.
- `flowers.js`: seeded world-space flower sites, singer density and style, growth/wilting history, and culled SVG animation.
- `styles.css`: edge-to-edge responsive layout and the sound toggle.

No external assets, fonts, packages, API keys, or services are required. Visible faces look around, blink, and choose between neutral, smiling, and frowning expressions independently. Mouth transitions take 1.2–1.8 seconds with gentle ease-in/out and personality-dependent pauses of 2.5–9 seconds. Their personality is seeded; live timing varies per session. Animation pauses offscreen and in hidden tabs, and is disabled when reduced motion is requested.

White flowers with circular or oval petals and a varied, slightly larger size range grow only along shared seams between faces, close to the singer, with conservative clearance for petals, sway and drooping stems. Their seeded mosaic coordinates remain fixed while scrolling and scale with the faces on resize. There are no scattered background flowers. Each singer has a seeded petal shape and petal count; an irregular, smoothly tapered patch reaches at most seven mosaic cells from that singer. Petals remain white, with ochre-yellow centers. Resting posture is seeded independently: approximately 40% upright, 30% bowing left and 30% bowing right. Bowed stems are quadratic curves; their leaves follow the stem, and their heads lean down with the curve. Independent sway stays around that resting posture; reduced motion keeps the assigned bow while stopping decorative sway. Geometry is scaled to retain the existing feature-clearance envelope without changing root positions. Each flower has a stable seeded green stem color, one to four leaves with varied sizes, positions and angles, and three to nine petals with individual size variation. About 38% of a new patch blooms immediately as a directional cue, while the rest grows from buds over 10–20 seconds. Mature flowers gently expand with the existing audio-clock envelope, with stronger movement on sustained notes and near the singer. Idle stems pivot from their bases with independently seeded speeds, amplitudes and phases. Mature flowers occasionally open and relax over 4.5–7.5 seconds, with 26–46-second individual cycles and long quiet intervals. Music adds restrained petal expansion and a little extra sway near the singer. Flower heads lazily turn half a rotation one way, pause, then a quarter turn back, with independently seeded 8–14-second turns and short rests. Petals turn independently of their shadows; retired heads hold their last orientation while wilting. Only flower heads cast shadows, using faint layered geometric shapes. Their projection stays at 4:30 (equal down/right offset), even as stems sway, heads turn and flowers wilt. Leaves cast no shadows. Petals and leaves render without SVG filters, avoiding filter-related disappearance in browsers. Muting stops music response; reduced motion holds sway and petals still while lifecycle changes continue.

After a handoff, the previous patch stops responding, gradually shrinks, dries and droops over 10–20 seconds, and leaves up to three dried flowers. History persists while exploring the current world in this page session; reloading resets history. There are at most 48 remnants and four retiring patches (rapid repeated muted handoffs settle the oldest early). A spatial index culls offscreen flowers, and at most 420 flowers are rendered, with current vegetation taking priority. Flower geometry shares the face animation loop at 30 Hz; population reconciliation runs at about 8 Hz. The butterfly visits only the active patch, including offscreen flowers. Landings and flower bending share one head-position calculation; scrolling does not redirect it.

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
node tests/controls-browser.cjs
node tests/butterfly-browser.cjs
node tests/tracking-browser.cjs
node tests/tracking-app-browser.cjs
node tests/flowers-browser.cjs
node tests/flower-rendering-browser.cjs
```

Use `FACEFIELD_URL` for another server address and `CHROMIUM_PATH` for another Chromium executable. This check watches eighteen seconds of live animation, checking pupil containment and coordination, independent full blinks, offscreen suspension, reduced-motion restoration, and singer advancement.

Flower unit checks cover deterministic placement and feature clearance, density gradients, immediate navigation cues, growth and retirement, stable remnants, bounded history and butterfly weight. The flower browser check exercises scroll return, actual SVG feature clearance, audio pulses and muting, singer transitions, reduced motion and frame timing at mobile and desktop viewport sizes. Butterfly navigation tests cover actual flower selection, delayed singer reactions, waiting for buds, landing/takeoff cycles, no viewport following, and flower loading/release. These Chromium checks do not substitute for testing on physical iOS Safari.

The rendering regression rasterizes a real generated flower and checks white petal pixels, leaf pixels and visible shadow pixels. It also rejects SVG filter dependencies on flower geometry. Run it with `FACEFIELD_BROWSER=webkit` when Playwright WebKit and its system libraries are installed.
