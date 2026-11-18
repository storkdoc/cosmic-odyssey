# Cosmic Odyssey

by Steve Behram

A cinematic starfield in the browser. The first chapter is choosing a sun and setting its size, heat, and activity. Planets come next.

In 2017 a campaign promised a space game, took support from 7,207 people, went quiet in 2020, and never shipped. This is Steve’s gift to the people who were let down: **let’s build a universe together.**

Free forever. No purchases, no ads. Presented with [SavagePlanets](https://savageplanets.com). [Read the free SavagePlanets comic](https://savageplanets.com).

Play it at [https://storkdoc.github.io/cosmic-odyssey/](https://storkdoc.github.io/cosmic-odyssey/).

## This chapter

The SavagePlanets mark stays in the top-left corner and links to savageplanets.com. The page opens on the starfield. The first question is how many stars the system has: none (a rogue, starless system), one, two, or three. The choices sit in a glass panel on the left (a bottom sheet on a phone) and the star you are tuning fills the rest of the view. Each star is then chosen from a visual menu — O, B, A, F, G, K, M, red giant, white dwarf, neutron star, and black hole — and tuned. Mass, radius, temperature, age, metallicity, rotation, and activity always apply. A neutron star also has a magnetic field. A black hole also has spin. Luminosity, diameter, lifetime, and the habitable zone update as the sliders move. Two stars become a stable binary with Holman and Wiegert planet limits. Three stars become a hierarchical triple that clears the Mardling and Aarseth limit. The camera looks straight down. Scroll, pinch, or the zoom buttons move in and out. Drag or WASD pans. The view does not tilt. Stars are video plates, one file per type (`assets/video/<type>.webm` and `<type>-pack.mp4`), and a missing plate uses the G star tinted to that type. Plate size follows the diameter. Thin rings can be toggled, and placeholder worlds move on them. The choice is stored in this browser (`localStorage` key `cosmic-odyssey.star`). Designed planets are still the next chapter.

## Music

Six real recordings are credited in the game and in `CREDITS.md`. This chapter uses three. Strauss’s Zarathustra sunrise plays on the opening starfield. Holst’s Venus is the quiet underscore for choosing and tuning a star. Holst’s Jupiter is a short stinger when the star is confirmed, then Venus returns. A large flare swells the current recording. Mute is on the starfield. The first tap unlocks audio.

## Building

The game is static files at the repository root. GitHub Pages serves `index.html`. No build step.

```bash
node tests/stars.test.js
node tests/systems.test.js
node tests/physics.test.js
node tests/science.test.js
node tests/playthrough.mjs
```
