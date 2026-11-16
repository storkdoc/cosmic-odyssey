# Cosmic Odyssey

by Steve Behram

A cinematic, science-based voyage in the browser. You leave Infinity Command, fly with Newtonian gravity, walk worlds, and design universes other people can visit.

In 2017 a campaign called itself a space game and raised $357,866 from 7,207 backers. It went quiet in 2020 and never shipped. This is Steve’s gift to the people who were let down: **let’s build a universe together.**

The guide is LYRA, an original hologram science guide of the Galactic Coalition. Play it at [https://storkdoc.github.io/cosmic-odyssey/](https://storkdoc.github.io/cosmic-odyssey/).

## The voyage

You start docked at **Infinity Command**, in orbit of Proxima b. The opening is a letterboxed fly-in past the station to the planet’s limb. Skip it with a tap or a key after you begin (the first tap also starts the music).

From the station:

- **Flight Deck** — name a hull, pick dart, ring, or hauler, and choose a drive.
- **Planetary lab** — research the nine gates, style a suit, build a miner and a watcher satellite.
- **Mission Control** — the board, from the Proxima shakedown through the TRAPPIST rescue to the Behram Star.
- **Trading outpost** — Challenge Coins for ore, fuel, and xenon.
- **Behram Universe Forge** — Steve’s namesake backer item. Design a star and its worlds. The lab computes equilibrium temperature, surface temperature, and the habitable zone.
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
| A D or drag | Turn |
| W / S | Thrust / brake |
| X / C | Point retrograde / prograde |
| M | Hold a matching burn onto a circular path |
| G | Scan the targeted world |
| L | Atmospheric entry, when you are slow and low |
| F | Dock at Infinity Command |
| Tab | Next world |
| V | Cycle warp |
| Space | Toggle the miner on a surface |
| Shift | Jet-pack thrust on a surface, with the holographic helmet |
| ` | The feedback sticker |

On a phone, the stick steers and the buttons thrust, point retrograde, act, and hold the rescue. A **Quality** control drops bloom, god rays, and film grain so a small screen stays smooth.

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
```
