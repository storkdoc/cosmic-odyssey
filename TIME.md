# The ruler

Cosmic time in this game is a **fixed ruler**. Year 0 is the start of the simulation. It is chosen with the galaxy seed and it never moves. Wall-clock time does not push it. Two players who look at year 2.1 billion are looking at the same year, whether they logged in today or next month.

The module is `js/engine/timeline.js`. This file is the contract.

## The ruler

```
year 0                                                     the far end
|----pin----pin----pin----pin----pin----------------------------|
^
fixed by the galaxy seed
```

Pins are supernovae, gamma-ray bursts, and gravitational-wave scrambles. Index `n` is always the same event: `pinnedEvent(n, seed)`. Their positions are functions of the seed, not of anyone's login.

There is no universal "now" across light-years. The ruler is a **game abstraction** of cosmic time so that windows and signals can be drawn on one line. A Codex card says so. Simultaneity on the ruler is not simultaneity in anyone's sky.

## Windows and cursors

Each civilization owns a window `[start, end]` on the ruler. The start can sit anywhere the physics allow: the star has to exist, and life can only be as far along as deep evolution permits at that year. One player may enter at year 2.0 billion, while life is just beginning. Another may enter at 2.1 billion, already civilized.

```
Ruler
0              2.0e9          2.1e9                 5e9
               [A========>                        ]
               start      cursor=end
                              [B====>             ]
                              start  cursor
               ^^^^^^^^ overlap
```

The **cursor** is the civilization's present. Play moves it forward (a deep-time skip, or the zoomed clock). The window **only grows**. The start does not slide. The end is at least the cursor. Logout saves the whole state **at the cursor** and does not move it. Standing directives (research, silence or broadcast, expansion) describe the dormant society. They do not advance the cursor.

A signal that falls after an offline cursor waits as pending until that player resumes and plays forward.

## Deep evolution

The state of a system at ruler position `t` is a pure function of:

- the system seed and the physical design (the central body and the worlds)
- galaxy pins with position `<= t`
- the log of events that affect that system with stamp `<= t`

Visitors evaluate the same function. An owner who is offline is not frozen in a secret way: anyone can recompute them at `t`. Checkpoints can cache a hash. They must not change the result.

## The time lens

When a society is technological, play drops into a zoom of tens of thousands of years. That span is short on the ruler. The default lens is 50,000 years. Against a billion-year stretch the zoom factor is twenty thousand. The UI calls this the time lens. It does not move the ruler.

## Contact

An emission is stamped with the sender's ruler position `t_e` and a place in space. For a receiver at distance `d`:

```
t_a = t_e + d / v
```

`v = c` for light and for gravitational waves (one light-year per year in these units). A vessel uses its own speed.

```
sender cursor ---- t_e -------- t_a ----
                         \ light /
receiver window   [ start ---- cursor ---- end ]
```

An exchange happens only when `t_a` lies inside the receiver's window, the receiver can hear that channel at `t_a`, and a scramble event is not blinding the detector.

| Where `t_a` sits | What the game does |
|---|---|
| Ahead of the cursor, and the window is still open | Pending. An offline cursor is this case: the signal waits until they resume and play forward. |
| Exactly on the cursor | Delivered. The past is not rewritten. |
| Inside the already-played span, behind the cursor | An archive echo. The past is not rewritten. Next session surfaces "a signal arrived unnoticed," with a payoff only if a deterministic detection check clears. |
| Before the window starts, or after a closed end | A permanent echo. A later civilization near that region, whose own window covers `t_a`, may discover it. Otherwise it is missed. |
| While a GW scramble covers `t_a` | The gravitational-wave channel is blind. |

An open window has its end on the cursor. That end is a frontier, not a wall. A signal past it is pending. A window is closed only when that civilization will not play further. Then a signal past the end is a permanent echo.

```
open, offline                         closed
start ---- cursor/end                 start ---- end|
              ^ signal waits                       ^ signal is a permanent echo
```

```
already played          frontier
[ start ========= cursor ]
        ^ archive echo
                          \ in flight /
                     t_e ============> t_a
```

The wedge on the Ruler is that in-flight segment. It is drawn from `t_e` to `t_a`. When the cursor reaches `t_a` the wedge is gone and the signal is delivered, or filed as an echo if nobody could hear it.

A reply is not a rewrite of the first signal. It is a new row, stamped at the replier's cursor, and it travels by the same rule.

Silence is a directive. It does not move the cursor, and it does not make another player an enemy. It lowers the detection chance of that player's own beacons. The Codex labels this as speculation.

The detection check is a pure function of the galaxy seed, the emission id, and the receiver's system id. Two clients roll the same number. A clear roll pays off with a discovery. A miss pays nothing. Neither one edits the years already played.

Replies are new emissions from the replier's own cursor. They obey the same rule.

The Contact Log redacts on the client from the viewer's tech. A gravitational-wave greeting with no gravitational-wave receiver is only "an unexplained exchange occurred near the Behram Nebula." Names and the body are not drawn. The stored row still has them. The screen does not.

## Storage

The shared log is append-only. Each row has a ruler position, a system id, and an event id. Merge is sort by position, then system id, then event id. Duplicates keep one row. A late write does not rewrite an earlier year. Logout snapshots store the cursor. Validation rejects an emission stamped ahead of the sender's cursor, and rejects a window that shrinks or jumps backward.

## Joining

A new system is placed at the entry year the player chooses, if the star and the life model allow it. `entryVerdict` refuses a year before the star forms and a year after it dies. The stage at that year is `evolveSystem` and nothing further along. They can meet contemporaries whose windows overlap, and they can find echoes from societies whose windows have already ended.

The opening of a technological window sits a short way into the time lens, so the Contact Log can already hold one archived greeting while a slower note is still in flight. That offset is play on the ruler. It is not wall-clock time.

## Checkpoints

`evolveCached(system, t, seed, cache)` stores the evolution under a key of seed, system seed, design, and `t`. A second evaluation returns the stored result. The result matches a fresh `evolveSystem` call. The cache is an optimization. It is not an input.

## What the module exports

Windows: `createWindow`, `advanceCursor`, `validateGrowth`, `overlap`, `openWindow`, `entryVerdict`, `setDirectives`.

Timekeeping: `pinnedEvent`, `pinsUpTo`, `arrivalTime`, `zoomFactor`, `localClock`, `lightCone`, `inFlightSignals`.

Contact: `validateEmission`, `resolveEmission`, `advanceAndDeliver`, `surfaceEcho`, `nextSession`, `discoverPermanent`, `replyTo`, `detectionChance`.

Memory: `evolveSystem`, `evolveCached`, `logoutSnapshot`, `resumeSnapshot`, `mergeEvents`, `validateLogged`.

`js/clock.js` only re-exports the ruler. It does not read the wall clock. The old scheduler that stepped a clock with UTC is not part of the game.
