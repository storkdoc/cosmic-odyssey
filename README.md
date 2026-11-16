# Cosmic Odyssey

by Steve Behram

A cinematic, science-based voyage in the browser. You leave Infinity Command, fly with Newtonian gravity, walk worlds, and design universes other people can visit.

In 2017 a campaign promised a space game, took support from 7,207 people, went quiet in 2020, and never shipped. This is Steve’s gift to the people who were let down: **let’s build a universe together.**

Free forever. No purchases, no ads. Presented with [Savage Planets](https://savageplanets.com). [Read the free Savage Planets comic](https://savageplanets.com).

The guide is LYRA, an original hologram science guide of the Galactic Coalition. Play it at [https://storkdoc.github.io/cosmic-odyssey/](https://storkdoc.github.io/cosmic-odyssey/).

## The voyage

You design a starting system first, on a fixed galactic ruler. Year 0 never moves, and the wall clock does not push it. Each civilization is a window on that ruler. Then you are in flight, with one prompt at a time. Assist is on: hold W toward the marker, then press L and the ship flies the entry corridor. A tap or a key skips the Savage Planets card and the title. The first tap also starts the music. N turns assist off if you want the burns yourself. The ruler, the windows, and the light-travel rules are in `TIME.md`.

From the station:

- **Flight Deck** — name a hull, pick dart, ring, or hauler, and choose a drive.
- **Planetary lab** — research the nine gates, style a suit, build a miner and a watcher satellite.
- **Mission Control** — the board, from the Proxima shakedown through the TRAPPIST rescue to the Behram Star.
- **Trading outpost** — Challenge Coins for ore, fuel, and xenon.
- **The Behram Loom** — Steve’s namesake. The Behram Constant is how tightly a cosmos is woven. Design a central body, choose an entry year the star can actually support, and let life follow from the physics.
- **Charts** — the real neighborhood, three guest universes (Ilya Voss, Mara Quill, Soren Pell — original names), and universes other players have published.
- **O’Neill colony** — a cylinder habitat you can stand in and settle, once a world of yours can hold life.
- **Backer Vault** and the **plaque**.

Flight is two-dimensional Newtonian gravity in a three-dimensional view: orbits, slingshots, delta-v, and fuel. Warp waits out a long coast and drops out near a world. Compressed time, once researched, waits longer.

The first crossing after the sail is **TRAPPIST-1**. A cutter is down on world e. Scan the seven worlds, land, and fly the survey drone to the wreck before the life-support cells run out. After the pilot is aboard, the surface lab can change pressure, greenhouse warmth, water, and air. Those levers change the planet you see. Seeding starts an ecology you have to keep in the middle of its ranges. Actualizing a universe in the Forge commits that chemistry. It does not turn back.

Eight threats show up on a living surface: quake, predators, a pole reversal, a storm, disease, a crossing rock, a short temperate hour, and a climate drift. Each one has an answer in the tools you have built.

Areas open as the tech arrives. Each one carries a one-line explanation: solar sails, hydrogen power, magnetic transport, ramjet fusion, dark matter, compressed time, nanotech, optogenetics, and the singularity.

Progress is saved in this browser (`localStorage` key `cosmic-odyssey.save`).

## How to fly

| Key | Action |
|---|---|
| W | Thrust toward the marker. Assist points the nose |
| L | Land. The assist flies the entry corridor |
| Space | Mine, while you hold it |
| B | Fit the solar sail, once the ore is aboard |
| T | Cross to TRAPPIST-1 |
| R | Bring the pilot aboard, beside the wreck |
| F | Open the Behram Loom |
| O | Open the Contact Log |
| D | Open a Discovery |
| G | Build a gravitational-wave receiver, when the log asks |
| N | Assist on or off. Off is Newtonian |
| I | Infinity Command, the station buttons |
| Shift | Jet pack on a surface, with the helmet |
| ` | The feedback sticker |

On a phone the same actions are buttons. Quality drops bloom, god rays, and shadows so a phone can hold a smooth frame.

LAND READY means the relative speed is low enough for the heat shield. Entry plays the plasma pass. A slingshot that leaves you faster than you arrived gets its own camera move.

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
