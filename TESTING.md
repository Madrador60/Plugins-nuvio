# Provider Test Report

Last manual test: 2026-05-13

Command used:

```powershell
node scripts\test-providers.js --timeout=45000
```

## Current Status

| Status | Provider | Notes |
|---|---|---|
| OK | `anime-sama` | Returned streams for One Piece S1E1 |
| OK | `voiranime` | Returned streams for One Piece S1E1 |
| OK | `vostfree` | Returned streams for One Piece S1E1 |
| Unstable | `animoflix` | Worked once, then timed out on a later run |
| OK | `french-anime` | Returned streams for One Piece S1E1 |
| OK | `animevostfr` | Returned streams for One Piece S1E1 |
| OK | `animesultra` | Returned streams for One Piece S1E1 |
| OK, slow | `jetanimes` | Returned streams with a 45s timeout |
| Zero | `sekai` | Returned 0 streams for One Piece S1E1 |
| OK | `movix` | Returned streams for Interstellar |
| OK | `mugiwarastream` | Returned streams for One Piece S1E1 |
| Timeout | `animesite` | Timed out during latest tests |
| OK | `frenchstream` | Returned streams for Interstellar |
| OK | `nakios` | Returned streams for Interstellar |
| OK | `purstream` | Returned streams for Interstellar |
| OK | `toflix` | Returned streams for Interstellar |
| OK, slow | `videasy` | Returned streams with a 45s timeout |
| Zero | `cinemacity` | Returned 0 streams without private cookie/access |

## Notes

- A provider returning `0` is not always dead. It can mean the tested title is missing, the site changed layout, or the domain requires access.
- Timeout-sensitive providers should be tested with `--timeout=45000` or higher.
- CinemaCity should stay documented as limited unless a public, cookie-free path is confirmed.
