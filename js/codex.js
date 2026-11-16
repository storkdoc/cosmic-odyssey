/* One real principle per moment. The Loom is named in the dedication entry. */
export const CODEX = [
  {
    id: 'newton',
    title: 'Newton’s second law',
    principle: 'Force equals mass times acceleration. A heavier ship needs a larger push for the same change of speed.',
    note: 'This is the law under every burn you fly.',
    when: 'thrust'
  },
  {
    id: 'kepler',
    title: 'Kepler’s third law',
    principle: 'The square of an orbital period grows with the cube of the distance. Farther worlds take much longer to go around.',
    note: 'A transfer window is just waiting until two clocks line up.',
    when: 'land'
  },
  {
    id: 'rocket',
    title: 'The rocket equation',
    principle: 'The speed you can gain is exhaust speed times the logarithm of how much mass you throw away.',
    note: 'This is why Voyager left most of its mass behind as fuel, and why an ion drive sips instead of gulps.',
    when: 'colony'
  },
  {
    id: 'oberth',
    title: 'The Oberth effect',
    principle: 'The same burn adds more energy when you are already moving quickly, deep in a gravity well.',
    note: 'Probes often burn at periapsis for this reason.',
    when: 'sling'
  },
  {
    id: 'inverse',
    title: 'The inverse-square law',
    principle: 'Light, and gravity, thin out with the square of distance. Twice as far is a quarter of the light.',
    note: 'A closer star gives more power to a collector, and more flares.',
    when: 'habitat'
  },
  {
    id: 'blackbody',
    title: 'Blackbody color',
    principle: 'A hotter surface shines bluer. A cool red dwarf is red because its photosphere is only a few thousand kelvin.',
    note: 'Proxima and TRAPPIST-1 are M dwarfs. Their light is deep orange-red.',
    when: 'flight'
  },
  {
    id: 'doppler',
    title: 'The Doppler effect',
    principle: 'Light from a source moving away is stretched to the red. Light from one approaching is squeezed to the blue.',
    note: 'This is how the speed of a star, and the expansion of space, is read from a spectrum.',
    when: 'visit'
  },
  {
    id: 'roche',
    title: 'The Roche limit',
    principle: 'Inside a certain distance, a moon is pulled apart by tides faster than its own gravity can hold it.',
    note: 'Many planetary rings are rubble that crossed that line.',
    when: 'ring'
  },
  {
    id: 'tides',
    title: 'Tidal locking',
    principle: 'Tides drain a world’s spin until one face stays toward its star. The habitable place is a ring of twilight, not a whole globe.',
    note: 'Proxima b and the TRAPPIST-1 worlds are expected to be locked this way.',
    when: 'land'
  },
  {
    id: 'hz',
    title: 'The habitable zone',
    principle: 'There is a band of orbits where a world with a reasonable air could keep liquid water.',
    note: 'Too close and the water boils. Too far and it freezes. Air can shift the edges.',
    when: 'colony'
  },
  {
    id: 'greenhouse',
    title: 'The greenhouse effect',
    principle: 'Air that holds infrared light raises the surface above the temperature the sunlight alone would give.',
    note: 'Earth’s air adds about 33 kelvin. A thick carbon-dioxide blanket can add far more.',
    when: 'habitat'
  },
  {
    id: 'stars',
    title: 'Stellar life cycles',
    principle: 'A heavy star burns bright and dies young. A red dwarf sips its fuel and can shine for trillions of years.',
    note: 'The main-sequence lifetime falls steeply as mass rises.',
    when: 'loom'
  },
  {
    id: 'dark',
    title: 'Dark matter and rotation',
    principle: 'Galaxies spin faster in their outskirts than the visible stars can explain. The missing pull is called dark matter.',
    note: 'The scoop in this ship is a story told ahead of the evidence. The rotation curves are not.',
    when: 'sail'
  },
  {
    id: 'hubble',
    title: 'Hubble’s law',
    principle: 'The farther a galaxy, the faster it recedes. Space itself is stretching.',
    note: 'The Behram Constant in the Loom is a play on this: one number that sets how fast a new cosmos opens.',
    when: 'loom'
  },
  {
    id: 'supernova',
    title: 'Supernovae',
    principle: 'A dying massive star throws radiation and a shock outward. The shock arrives later, by the light-travel time, and can strip ozone, end most surface life, and seed new heavy elements.',
    note: 'The enrichment is why rocky worlds have iron at all.',
    when: 'event'
  },
  {
    id: 'grb',
    title: 'Gamma-ray bursts',
    principle: 'A gamma-ray burst is a beam, not a sphere. Only systems inside the cone take the hit. Oceans, magnetic fields, and rock overhead are shielding.',
    note: 'A buried society, the kind a hard star produces, is the one that weathers it.',
    when: 'event'
  },
  {
    id: 'scramble',
    title: 'Mergers and detectors',
    principle: 'A compact merger rings spacetime. For a short while a gravitational-wave detector is blinded, and the Contact Log loses resolution.',
    note: 'The wave is real. Using one as a beacon on purpose would take a star’s worth of energy, or the merger itself.',
    when: 'event'
  },
  {
    id: 'forest',
    title: 'The dark forest, as speculation',
    principle: 'The Fermi paradox asks why a loud galaxy is so quiet. The dark forest hypothesis, which is speculation, says silence is safer than a beacon.',
    note: 'In this voyage, silence is a choice about energy and who can find you. It never makes another player an enemy. Contact, when it happens, is an exchange.',
    when: 'silence'
  },
  {
    id: 'lightcone',
    title: 'Light cones and detection',
    principle: 'Nothing outruns light, and there is no universal now across light-years. The ruler is a game abstraction so windows can share a line. A message arrives at t_e plus distance over c, not at the sender’s present.',
    note: 'SETI listens in radio. The Wow! signal was a strong, unexplained radio spike. The Drake equation counts the chances. The Fermi paradox asks why the sky is so quiet. A gravitational-wave beacon would not even register until you built the receiver.',
    when: 'log'
  },
  {
    id: 'cmb',
    title: 'The cosmic microwave background',
    principle: 'The oldest light in the universe is a cold radio glow, left from when the cosmos first became transparent.',
    note: 'It is almost the same in every direction, a fossil of the first four hundred thousand years.',
    when: 'codex'
  }
];

export function codexById(id) {
  return CODEX.find((c) => c.id === id) || CODEX[0];
}
