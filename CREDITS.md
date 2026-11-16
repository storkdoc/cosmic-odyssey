# Cosmic Odyssey — credits

Cosmic Odyssey is a gift from Steve Behram for the people who backed a 2017 voyage that never shipped. The guide in the game is LYRA, an original hologram. No real person’s name, likeness, or voice is used as that guide, and the game does not use the campaign’s title treatment or logo.

The Milky Way sky is a photograph: ESO/S. Brunier, [The Milky Way panorama](https://www.eso.org/public/images/eso0932a/), CC BY 4.0. Star points in front of it are generated in the shader and do not twinkle.

Presented with Savage Planets, https://savageplanets.com . The mark and wordmark are used with permission of Steve Behram. Read the free comic at that site.

Free forever. No purchases, no ads.

## Music

Background music is real recorded orchestral and concert-band performance. Nothing in the score is synthesized. Each file was excerpted and re-encoded to 160 kbit/s MP3, under 25 MB. Licenses below were checked against the Wikimedia Commons file pages on 16 November 2026.

| File | Piece | Performers | License | Source |
|---|---|---|---|---|
| `audio/zarathustra.mp3` | Richard Strauss — Also sprach Zarathustra, Einleitung (Sonnenaufgang) | Conducted by Philip Milman. Recording funded by Ludwig Ahgren and jschlatt. | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Richard_Strauss_-_Also_Sprach_Zarathustra_-_Phillip_Milman_-_Lud_and_Schlatts_Musical_Emporium.wav |
| `audio/jupiter.mp3` | Gustav Holst — The Planets, Op. 32, Jupiter, the Bringer of Jollity (hymn) | Skidmore College Orchestra, via Musopen | CC BY. The Commons license box requires attribution to Musopen. Credit Musopen. | https://commons.wikimedia.org/wiki/File:Gustav_Holst_-_the_planets,_op._32_-_iv._jupiter,_the_bringer_of_jollity.ogg |
| `audio/venus.mp3` | Gustav Holst — The Planets, Op. 32, Venus, the Bringer of Peace (opening) | United States Air Force Heritage of America Band. Concert-band transcription by Merlin Patterson. | Public domain (work of the U.S. federal government) | https://commons.wikimedia.org/wiki/File:Holst-_venus.ogg |
| `audio/mercury.mp3` | Gustav Holst — The Planets, Op. 32, Mercury, the Winged Messenger | United States Air Force Heritage of America Band. Concert-band transcription by Merlin Patterson. | Public domain (work of the U.S. federal government) | https://commons.wikimedia.org/wiki/File:Holst_The_Planets_Mercury.ogg |
| `audio/dvorak.mp3` | Antonín Dvořák — Symphony No. 9, “From the New World,” Op. 95, IV. Allegro con fuoco (opening) | Public-domain recording released by Musopen. The file page does not name the orchestra. | Public domain. Commons: released by Musopen into the public domain. | https://commons.wikimedia.org/wiki/File:Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27,_op._95_-_iv._allegro_con_fuoco.ogg |
| `audio/valkyrie.mp3` | Richard Wagner — Die Walküre, Ride of the Valkyries | Conducted by Philip Milman, 2022. Recording funded by Ludwig Ahgren and jschlatt. | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Ride_of_the_Valkyries.ogg |

Jupiter opens launches, slingshots, and the rescue approach’s neighbors. Venus stays with Infinity Command, the lab, and the Forge. Mercury, Dvořák, and Jupiter rotate in free flight. The Ride of the Valkyries enters for the TRAPPIST rescue. Zarathustra plays the opening fly-in. The same piece keeps playing across a scene change when the cue does not change, and a new cue crossfades.

## Code

Flight, climate, and the first system tables began as an unfinished prototype in the public repository `storkdoc/behram-arcade`, branch `cosmic-odyssey-wip`, commit `3212424`, folder `games/exo-odyssey/`. That repository was not changed. Three.js r169 and the post-processing passes are the MIT-licensed library, vendored under `vendor/three/` with its license file.

Founding-backer names (the Forge, the star, the nebula, the plaque) live in `NAMES` at the top of `js/data.js`, so a later wording pass can edit them in one place.
