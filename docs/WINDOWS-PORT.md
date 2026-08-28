# WINDOWS PORT — continuing this project on a Windows machine

Written on the Mac session that shipped the project (2026-08-15). The
goal: a fresh Claude session on Windows picks up exactly where the Mac
one left off.

## What arrives by cloning (no copying needed)

    git clone https://github.com/Radi0Show/jevil-sim

Everything ships in the repo: sim, renderer, suites, the sprite/font/
audio packs, docs (PLAYBOOK, HANDOFF, STATUS, VERIFICATION, this file).
The deployed site (https://radi0show.github.io/jevil-sim/web/) keeps
auto-deploying from pushes to main, gated on the suites.

Optionally also clone the reference implementation:

    git clone https://github.com/Radi0Show/knight-sim

## What must be COPIED from the Mac (the transfer bundle)

The Mac's `~/Desktop/claude-windows-transfer/` folder holds both pieces:

1. **`jevil-research/` (~23MB)** → place at `%USERPROFILE%\jevil-research`
   - PRIVATE AND LOCAL. Never a git remote, never published, never
     committed into jevil-sim. Same rule as on the Mac.
   - Contains: `gml_dump/` (the chapter 1 decompilation + masks +
     objects), `traces/` (every oracle recording the suites replay),
     `tools/` (recorder patches, drivers, lint), `notes/`, `reference/`.
   - The Mac bundle EXCLUDED `oracle/` and `oracle-instrumented/`
     (863MB each): those are macOS .app builds, useless on Windows.
     See "Rebuilding the oracle" below.
   - The suites find it via `homedir()/jevil-research` — placing it at
     `%USERPROFILE%\jevil-research` makes all 25 suites green with no
     path changes.

2. **`claude-memory-export/`** — the Mac Claude's memory files.
   Tell the Windows Claude: "import the memory export at <path>"
   (it has an import-memory skill). This carries the cross-project
   context that is NOT in this repo's docs (the boss-sim ecosystem map,
   asset-permission decisions, tool traps).

## What to INSTALL fresh on Windows

- **Node >= 20** — `npm run verify` must print `all 25 suites passed`.
  That is the port's acceptance test; run it before anything else.
- **Python 3** — the dev server: `py tools\devserver.py 8214`
  (`python3` on the Mac; the script itself is portable).
- **UndertaleModCli** — download the Windows build (it is a .NET tool,
  native on Windows; the Mac copy is not portable). Only needed when a
  NEW oracle recording or asset extraction is required — day-to-day
  play-and-fix work never touches it.
- **git + gh CLI** authenticated to the Radi0Show account (pushes to
  main deploy the site).

## Rebuilding the oracle (only when a new recording is needed)

The oracle is an instrumented copy of the game, rebuilt from a pristine
copy on every patch (PLAYBOOK: never modify the real install).

Windows differences from the Mac setup, all confined to
`jevil-research/tools/build-oracle.sh` and the run scripts:

- The chapter data is `chapter1_windows/data.win` inside the DELTARUNE
  install directory — NOT `DELTARUNE.app/Contents/Resources/
  chapter1_mac/game.ios`. UndertaleModCli reads both formats; the GML,
  RNG, and data are the same, so recordings remain byte-comparable.
- Copy the user's Windows DELTARUNE install to
  `%USERPROFILE%\jevil-research\oracle\` as the pristine source, then
  adapt build-oracle.sh's SRC/DST/REL paths (bash → run under Git Bash,
  or translate to PowerShell — it is ~40 lines).
- No `codesign` step on Windows (the Mac re-sign block just goes away).
- The save/config staging dir is `%LOCALAPPDATA%\DELTARUNE` (the Mac
  used `~/Library/Application Support/com.tobyfox.deltarune`) — the
  recorder reads `oracle_inputs.txt` / `oracle_config.txt` from there
  and writes `oracle_trace.csv` next to them.
- UTMT CLI trap (from memory, applies on Windows too): redirect its
  output and it hangs unless stdin is `< /dev/null` (or `< NUL`).

The saved traces in `jevil-research/traces/` are the ground truth the
suites replay — they do NOT need re-recording on Windows. Rebuild the
oracle only for NEW probes.

## Session basics that change

| Mac | Windows |
|---|---|
| `export PATH="$HOME/tools/node/bin:$PATH"` | not needed if Node is on PATH |
| `~/jevil-research` | `%USERPROFILE%\jevil-research` |
| `python3 tools/devserver.py 8214` | `py tools\devserver.py 8214` |
| `.claude/launch.json` runtimeExecutable `python3` | change to `py` (or `python`) |

Everything else in CLAUDE.md still applies verbatim: the five rules,
the fight table, the clean-room boundary, "jevil-research is never
published".

## Where the project stands (so the first Windows session knows)

SHIPPED and live. Core verification complete (three endings byte-exact
against oracle recordings; 25 suites; docs/HANDOFF.md has the full trap
catalog — read the two 2026-08-15 entries first). Current mode: player
feedback (playbook §10.10) — bug reports arrive as `?replay=` URLs
(press B in the sim to copy one); verify every report against
`gml_dump/` before fixing. Open items live at the bottom of
docs/STATUS.md.
