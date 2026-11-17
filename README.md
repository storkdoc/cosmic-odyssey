# Cosmic Odyssey

by Steve Behram

A cinematic starfield in the browser. The first chapter is choosing a sun and setting its size, heat, and activity. Planets come next.

In 2017 a campaign promised a space game, took support from 7,207 people, went quiet in 2020, and never shipped. This is Steve’s gift to the people who were let down: **let’s build a universe together.**

Free forever. No purchases, no ads. Presented with [SavagePlanets](https://savageplanets.com). [Read the free SavagePlanets comic](https://savageplanets.com).

Play it at [https://storkdoc.github.io/cosmic-odyssey/](https://storkdoc.github.io/cosmic-odyssey/).

## This chapter

The page opens on the SavagePlanets wordmark. The wordmark links to savageplanets.com. A tap on the dark field leaves the card and starts the music. The next question is how many stars the system has: none (a rogue, starless system), one, two, or three. Each star is then chosen from a visual menu — O, B, A, F, G, K, M, red giant, white dwarf, neutron star, and black hole — and tuned. Mass, radius, temperature, age, metallicity, rotation, and activity always apply. A neutron star also has a magnetic field. A black hole also has spin. Luminosity, diameter, lifetime, and the habitable zone update as the sliders move. Two stars become a stable binary with Holman and Wiegert planet limits. Three stars become a hierarchical triple that clears the Mardling and Aarseth limit. The orbits are real circular motion, sped up so the period ratio stays visible, and a control turns the orbital paths on and off. Pinch, drag, the wheel, or the zoom buttons move from a star’s surface out to the whole system. The choice is stored in this browser (`localStorage` key `cosmic-odyssey.star`). Planets are the next chapter. They are not in this build.

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
