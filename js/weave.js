/* Central bodies and the indirect life model. Lifetimes are order-of-magnitude,
   labeled as such. Biology is an output of the physics, never a paintbrush. */

export const CENTERS = [
  { id: 'o', name: 'O star', spectral: 'O5', mass: 30, L: 20000, teff: 40000, radius: 10, hazard: 0.85, years: 3e6, clock: 'A few million years. An O star spends its fuel furiously.', lesson: 'Lifetime scales roughly as mass to the minus 2.5. The brightest stars die first.' },
  { id: 'b', name: 'B star', spectral: 'B5', mass: 6, L: 800, teff: 15000, radius: 3.5, hazard: 0.55, years: 8e7, clock: 'Tens of millions of years.', lesson: 'Still a short clock. The habitable zone sits far out.' },
  { id: 'a', name: 'A star', spectral: 'A5', mass: 1.8, L: 12, teff: 8500, radius: 1.7, hazard: 0.3, years: 1e9, clock: 'About a billion years.', lesson: 'A long childhood for life, and a short one for a civilization that waits.' },
  { id: 'f', name: 'F star', spectral: 'F5', mass: 1.3, L: 3, teff: 6700, radius: 1.3, hazard: 0.2, years: 4e9, clock: 'A few billion years.', lesson: 'A wide, bright habitable zone.' },
  { id: 'g', name: 'G star', spectral: 'G2', mass: 1, L: 1, teff: 5780, radius: 1, hazard: 0.1, years: 1e10, clock: 'About ten billion years, like the Sun.', lesson: 'The clock that grew one society we know of.' },
  { id: 'k', name: 'K star', spectral: 'K2', mass: 0.7, L: 0.3, teff: 4900, radius: 0.75, hazard: 0.12, years: 3e10, clock: 'Tens of billions of years.', lesson: 'Dimmer than the Sun, and far more patient.' },
  { id: 'm', name: 'M dwarf', spectral: 'M5', mass: 0.15, L: 0.003, teff: 2800, radius: 0.2, hazard: 0.45, years: 1e13, clock: 'Trillions of years. A red dwarf sips its fuel.', lesson: 'The habitable zone is close, so worlds lock one face to the star, and flares are common.' },
  { id: 'giant', name: 'Red giant', spectral: 'KIII', mass: 1.2, L: 200, teff: 4000, radius: 40, hazard: 0.7, years: 1e8, clock: 'The giant phase is a short chapter, on the order of a hundred million years.', lesson: 'The star has swollen. Old habitable zones are now inside the fire.' },
  { id: 'wd', name: 'White dwarf', spectral: 'DA', mass: 0.6, L: 0.01, teff: 9000, radius: 0.01, hazard: 0.35, years: 1e12, clock: 'It cools for trillions of years, and gives little light.', lesson: 'A dead stellar core. Any garden has to sit very close.' },
  { id: 'ns', name: 'Neutron star', spectral: 'pulsar', mass: 1.4, L: 0.02, teff: 1e5, radius: 0.00002, hazard: 0.92, years: 1e7, clock: 'The bright pulsar phase lasts on the order of 10 million years.', lesson: 'The beams are lethal. A magnetic field this fierce is not a sky you stand under.' },
  { id: 'bh', name: 'Black hole', spectral: 'disk', mass: 10, L: 0.4, teff: 12000, radius: 0.05, hazard: 0.96, years: 5e7, clock: 'The disk shines for about 50 million years, and only while matter falls in.', lesson: 'Hawking radiation from a stellar black hole is negligible. The light is the hot disk, and time runs slow near the horizon.' }
];

export function emerge(center) {
  if (center.hazard > 0.8) {
    return {
      form: 'Subsurface mats',
      society: 'A buried culture that never sees the sky',
      guide: 'High radiation favors life under rock. You did not design the creatures. The star did.'
    };
  }
  if (center.id === 'm' || center.id === 'wd') {
    return {
      form: 'Twilight-ring walkers',
      society: 'Cities strung along the terminator',
      guide: 'A close, dim star locks the world. The mild place is a ring of dusk.'
    };
  }
  if (center.L > 50) {
    return {
      form: 'Short, sturdy forms',
      society: 'Low towns under a hard sky',
      guide: 'Strong light and a deep well favor bodies that stay close to the ground.'
    };
  }
  return {
    form: 'Upright walkers',
    society: 'A daylight society',
    guide: 'Mild gravity, mild light, and a long clock. The society is still an output of those numbers.'
  };
}

export const COMM = [
  { id: 'radio', name: 'Radio', range: 'Interplanetary to nearby stars', block: 'Ionosphere, plasma, distance', note: 'Inverse-square falloff. Slow to cross a galaxy. This is the SETI band.' },
  { id: 'microwave', name: 'Microwave', range: 'Similar to radio, tighter beams', block: 'Water, plasma', note: 'Higher bandwidth than broadcast radio.' },
  { id: 'optical', name: 'Optical and laser', range: 'A tight beam across many light years', block: 'Dust, clouds, a missed aim', note: 'Huge bandwidth if the aim is true. Easy to miss.' },
  { id: 'neutrino', name: 'Neutrino beacon', range: 'Through almost anything', block: 'Almost nothing. The receiver is the hard part.', note: 'Most neutrinos pass through a planet. You need a vast detector.' },
  { id: 'xray', name: 'X-ray beacon', range: 'Far, if the source is violent', block: 'Atmospheres', note: 'A natural advertisement of compact objects.' },
  { id: 'gw', name: 'Gravitational waves', range: 'Across the galaxy, from compact masses', block: 'Nothing material. Only a detector hears them.', note: 'Speculative as a deliberate beacon. The waves themselves are real, and they cost enormous energy, or a neutron star, or a black hole.' }
];
