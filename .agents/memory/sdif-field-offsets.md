---
name: SDIF field offsets
description: Correct byte positions for D0 (entry) and D3 (result) records in SDIF v3.0 HY3/CL2 files
---

## Rule
SDIF columns are 1-indexed in the spec but JavaScript substring() is 0-indexed.
"Column 73" in the spec = `line.substring(72, 79)` in JS.

## Key positions (0-indexed substrings)
- D0/D3 seedTime / finishTime: `substring(72, 79)` — 7 chars (MMSSss or NTblanks)
- D0/D3 course (Y/S/L): `line[79]`
- D3 place: `substring(80, 84)`
- D3 points: `substring(84, 88)`
- D3 dq flag: `line[88]`
- D3 dqCode: `substring(89, 91)`
- D3 ns flag: `line[91]`
- D3 dnf flag: `line[92]`

## Relay records
E0 (relay entry), E1 (relay leg), E2 (relay exchange) are handled by flushing
`currentEntry` to the team and setting it to null. They are otherwise skipped —
no relay data is imported (only individual event entries are supported).

## Standalone D3 (results-only file)
When D3 appears without a preceding D0, `seedTime` = null (D3 has no seed time
field; the time bytes hold the finish time).

**Why:** Off-by-one bug caused seed times to parse one column early, hitting a
blank or wrong digit; relay records between D0 and D3 caused result contamination.
