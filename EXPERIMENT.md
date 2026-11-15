# Crowd visual experiment

Branch: `visual-experiment`. Production remains on `main`.

Choose **Visual style → Crowd** at the bottom left, or open `?style=crowd`.
Original is the default. The choice persists in sessionStorage; changing styles
retains the current singer, audio timeline, moth, flowers, and story state.

The Crowd renderer adds warm oval heads, six seeded hair silhouettes, small
projected eyes/noses/mouths, clipped tongues, and gradient shoulders/shading.
A presentation layout assigns all 1,152 existing character IDs to staggered
rows. The original seeded mosaic and character generation are unchanged.
Flowers and moth coordinates are projected with their singer; flower sites,
growth dates, retirement history, and visiting state remain intact.

The reference is recreated with SVG, without raster assets or SVG filters.
Unlike the reference, resting faces retain the game's neutral/frowning mouths;
only actual singers sing. Crowd density is tuned for touch readability.

Validation commands (serve the directory on localhost:8000 first):

```
node --test --test-isolation=none tests/*.test.mjs
for test in tests/*browser.cjs; do node "$test"; done
```

Physical iPhone 15 / mobile Safari validation is still required. Chromium
mobile emulation does not establish Safari rendering or device performance.

Validation results: 53 unit tests and all 19 existing browser scripts passed.
The two new Crowd browser scripts cover stable SVG identities, mode restoration,
chorus/story continuity through discovery and cleanup, session persistence,
projected touch targets, scrolling stability, and reduced-motion switching.
Timing-sensitive stereo and reduced-motion flower checks passed in isolated
reruns after failing under concurrent browser load.

Crowd paint uses five shared gradient definitions and viewport-aware SVG display.
Only facial details use a 30 Hz cap in Crowd mode; world/audio/story clocks retain
their existing cadence. Headless emulation is not a device performance guarantee.

A separate Pages repository could not be created: the GitHub integration returned
HTTP 403 (Resource not accessible by integration). Production Pages settings were
not changed. The experiment is available on its own branch.

The fallback private preview was published successfully using the Sites plugin:
https://facefield-crowd-experiment.restedbough.chatgpt.site/?style=crowd

It requires the owner's ChatGPT sign-in. The hosting service reported a successful
publication. App behavior was validated locally in Chromium; the authenticated
published app was not browser-tested because cloud browser tools are unavailable.

Changed files: app.js, behavior.js, butterfly.js, flowers.js, index.html,
styles.css, crowd-art.js, visual-modes.js, EXPERIMENT.md,
tests/controls-browser.cjs, tests/crowd.test.mjs, tests/crowd-browser.cjs,
and tests/crowd-interactions-browser.cjs.

Crowd refinement: narrower heads, seeded facing offsets, larger eyes, long U-shaped
black noses, matching thin mouth strokes, true elliptical singing mouths, and
long white oval torsos behind the next row. Blush now uses only the existing
moth-proximity reaction, with no permanent decorative cheeks. Original mode is
unchanged. Refinement validation: 54 unit tests plus Crowd interaction/story and
Original animation/control browser regressions passed.

Reference-image pass: replaced all rim-shaped hair and front caps with six complete
rear silhouettes. Peach faces, near-flat shading, white background, consistently
larger white eyes/smaller black pupils, wider oval singing mouths, and outlined
white oval bodies now follow the supplied close-up reference. Normal expressions,
proximity-only blush and story triggers remain unchanged. Validation: 55 unit tests,
Crowd interaction regression, and Original animation regression passed.

Tall Crowd flowers: existing singer sites project deterministically into the gaps
between people. One flower per patch/gap avoids stacked duplicates. Mature heads
sit at head height; row-depth SVG layers let front people cover the stems, whose
bases fade with a shared mask. The reference-inspired petal palette applies only
to Crowd mode. Existing song lifecycles and moth landing poses share the same
projection; no background flowers are introduced. Original rendering is retained.
Validation: 56 unit tests pass, including projected head-height/identity checks.
Browser regressions were attempted but could not run because localhost:8000 was
unavailable; no cloud browser tool is available for visual QA in this environment.

Original-mode pigment experiment: geometric faces start white. The living moth
adds their existing seeded pigment within the smile/tracking radius, including offscreen
faces via a fixed spatial index. Pigment builds gently, holds 20 seconds after
proximity ends, and fades over 30 seconds. Blush retains its shorter response.
Crowd appearance is unchanged; mode switching retains pigment timestamps.
A dead moth does not deposit new pigment. Reduced motion uses the existing
watchdog; no new animation loop is introduced. Open `?style=original` to try it.
Validation: 58 unit tests pass. Browser/device validation remains unavailable.

Pigment now shares the smile radius and distance falloff (320 px, full strength
within 120 px). White Original faces have a thin black outline that fades as
pigment builds and returns as faces fade to white.

Original-only flower grouping pass: selected singer sites display seven-bloom leafy
mounds or four upright lavender-like spikes, inspired by references 1 and 2.
Other sites retain the existing small flowers. Groupings enlarge only within
existing facial-feature clearance limits, share the same lifecycle/music/sway,
and keep a central bloom/floret as a moth landing target. Group heads stay upright
rather than spinning as a whole. Crowd flowers retain their previous rendering.
Original singing mouths are 50% taller and show a pink tongue clipped to the
animated opening. Tongues hide for closed, silent and story-specific mouths.
Validation: 59 unit tests pass; browser assertions were updated but could not be
executed because browser preview infrastructure is unavailable in this environment.
