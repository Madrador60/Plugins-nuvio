# Provider Test Report

Last manual test: 2026-05-13

## Stremio / Render checks

Checked on 2026-05-13:

| Check | Result | Notes |
|---|---|---|
| `/manifest.json` | OK | HTTP 200, CORS enabled |
| `/test-player` | OK | Page loads and can search |
| `/search.json?type=movie&q=Interstellar` | OK | Returns TMDB results |
| `/stream/movie/tt0816692.json` | OK | Returns proxied MP4/M3U8 streams |
| MP4 proxy range | OK | HTTP 206, `Content-Range`, `Accept-Ranges`, exposed CORS headers |

Last important commits:

```text
68bec26 Harden Stremio web playback headers
e162620 Add searchable test player
```

Command used:

```powershell
node scripts\test-providers.js --timeout=45000
```

Quick movie-provider test:

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

Result:

| Status | Provider | Streams | Time |
|---|---|---:|---:|
| OK | `movix` | 2 | 674ms |
| OK | `frenchstream` | 2 | 2134ms |
| OK | `nakios` | 3 | 370ms |
| OK | `toflix` | 1 | 460ms |

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
