# Player feedback and usage — Cosmic Odyssey

The game loads `js/mood-sticker.js`, the same corner smiley the Behram Arcade uses. Tap or click it, or press **`** (backquote). A card offers **Fun · Okay · Skip** and an optional “Suggest an improvement” note. Nothing is required. The sticker does not take Space, Enter, or the flight keys while the card is closed.

Each rating is one JSON record. It has no name, email, or other personal data. Typed emails and phone numbers are replaced, and the note is capped at 500 characters. The record is tagged `game: "cosmic-odyssey"` and `gameTitle: "Cosmic Odyssey"`. It includes the anonymous session id, session start, duration, last screen, viewport, and device class — the same fields the arcade already stores.

Usage events go to the same sinks, as records with `kind: "usage"` and `usage` set to one of:

- `universe_created`
- `universe_published`
- `mission_completed`

## Where it lives

The site is static. There is no server of our own. The same two keyless stores the arcade uses, with different document names so the two games do not overwrite each other:

1. **textdb.dev**, one JSON document per UTC day:
   `https://textdb.dev/api/data/cosmic-odyssey-feedback-7c2a91e4b8d0461f-YYYY-MM-DD`
2. **ntfy.sh**, an append-only mirror kept about 12 hours:
   topic `cosmic-odyssey-fb-3e91c0a76b24d58f`

A copy of the last 150 records also sits in the player’s browser under `localStorage` key `cosmicOdyssey.feedback`. Failed uploads are retried on the next load.

The names are not secret. Anyone who reads the page source can read or overwrite them. That is acceptable for anonymous ratings. Do not put anything sensitive there.

Shared universes and Armada ships use the same kind of store, as single documents rather than a daily log:

- Universes: `https://textdb.dev/api/data/cosmic-odyssey-universes-a4d18e62c0b75f39`
- Armada: `https://textdb.dev/api/data/cosmic-odyssey-armada-b7e04c19d6a2835e`

Player-written names and notes are escaped when shown and run through a small profanity filter before they are saved or sent.

## Reading it

From the repo root (Node 18+, no dependencies, no login):

```bash
node tools/read-feedback.mjs                          # yesterday (America/New_York), real players only
node tools/read-feedback.mjs --json                   # same, as JSON
node tools/read-feedback.mjs --today --include-test   # today, test records too
node tools/read-feedback.mjs --hours 36 --archive ~/cosmic-odyssey-feedback.jsonl
```

Usage rows print with a `usage` line. `--no-sync` is read-only. By default, a record that reached ntfy but not textdb is copied into that day’s document so it outlives the 12-hour mirror.

To read without the repo:

```bash
curl -s https://textdb.dev/api/data/cosmic-odyssey-feedback-7c2a91e4b8d0461f-YYYY-MM-DD
```

There is no daily job and no automation that adds games or content.
