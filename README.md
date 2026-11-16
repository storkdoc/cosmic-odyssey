# Cosmic Odyssey

by Steve Behram

A cinematic, science-based voyage in the browser. You leave Infinity Command, fly with Newtonian gravity, walk worlds, and design universes other people can visit.

In 2017 a campaign promised a space game, took support from 7,207 people, went quiet in 2020, and never shipped. This is Steve’s gift to the people who were let down: **let’s build a universe together.**

Free forever. No purchases, no ads. Presented with [SavagePlanets](https://savageplanets.com). [Read the free SavagePlanets comic](https://savageplanets.com).

The guide is LYRA, an original hologram science guide of the Galactic Coalition. Play it at [https://storkdoc.github.io/cosmic-odyssey/](https://storkdoc.github.io/cosmic-odyssey/).

## The voyage

You design a solar system from scratch. Choose zero to three stars and a real spectral type. Two stars are arranged as S-type (a world orbits one star) or P-type (worlds orbit both). Three stars are a hierarchy, and the builder warns when the outer star is too close. Add worlds with composition, orbital distance, radius, and density. Add moons and an asteroid belt. Every star, planet, and moon has a generated name you can edit.

The panel updates as you move a control: habitable zone, equilibrium and surface temperature, surface gravity, escape speed, orbital period, and Roche and Hill checks for moons.

Awaken the system and life follows the physics: solvent, temperature, radiation, and time. It can be water-carbon, or ammonia, methane, a subsurface sea, a cloud deck, or a speculative hot silicon chemistry. A civilization that reaches a technological stage can hear a signal. Light-time is part of the message. The system record is shaped so a later multiplayer layer can append signals. It does not do that yet.

The survey craft is generated from the system. Each civilization’s hull is its own lathed profile. Fly to a world, enter orbit, land on a solid surface, and scan composition, density, temperature, and life. The Codex states the formulas.

A tap skips the SavagePlanets card. The first tap also starts the music. Progress is saved in this browser (`localStorage` key `cosmic-odyssey.system`).

## How to fly

| Key | Action |
|---|---|
| O | Enter orbit, once you are close |
| L | Land, from orbit, on a world with a surface |
| C | Scan the selected world |
| K | Open contact |
| ` | The feedback sticker |

On a phone the same actions are buttons. The destination buttons choose the world, and the craft flies there.

## Backer Vault

Steve’s founding profile starts with **75 Challenge Coins**, the holographic helmet (jet-pack EVA), the VIP Beta badge, the founding crest, and a ship already named for the Armada. The suit editor is free for every player. Ship design is free to fly; publishing into the shared Armada uses the backer plate.

The **Backer** control is an honor system. Leave it on if you backed the 2017 campaign, or turn it off to fly as a new Astro-Explorer. The Forge, the Behram Star, the Behram Nebula, and the plaque stay either way. The names and the perk sentences live in `NAMES` and `PERKS` in `js/data.js`.

## Shared universes

Publishing writes a small JSON document to [textdb.dev](https://textdb.dev), the same kind of keyless store the Behram Arcade uses for feedback, with no account. Other players browse that catalog from Charts and can fly the system, challenge included. Names and notes are treated as untrusted: they are filtered and escaped. If the catalog is quiet, the chart is still saved on your ship.

See `FEEDBACK.md` for the document names, the rating sticker, usage events (`universe_created`, `universe_published`, `mission_completed`), and:

```bash
node tools/read-feedback.mjs --today --include-test
```

## Music

Six real recordings, credited in the game and in `CREDITS.md`, with the Commons page and the license for each. Zarathustra opens the film. Venus sits with the station. Jupiter marks a launch. The Ride of the Valkyries is the rescue. Mercury, Dvořák’s New World finale, and Jupiter rotate in free flight. The music crossfades and keeps playing across scenes.

## Building

The game is static files at the repository root. GitHub Pages serves `index.html`. No build step. Physics checks:

```bash
node tests/physics.test.js
node tests/science.test.js
node tests/time.test.js
```
