# ADR 0003: Host on Vercel with cross-origin isolation headers

Status: accepted (2026-11-16)

## Context
The site is static (Astro). philo uses WASM threads, which need `SharedArrayBuffer`, and that requires the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. GitHub Pages can't set custom headers. The domain `samuelcglantz.com` already has its DNS on Vercel.

## Decision
Deploy to **Vercel** at `samuelcglantz.com`.
- Set `COOP: same-origin` and `COEP: require-corp` (or `credentialless`) in `vercel.json`.
- Use Vercel Web Analytics, which is cookieless.
- Cloudflare Pages was considered. It was rejected because it would mean moving DNS for no real gain.

## Consequences
- No DNS migration.
- Every cross-origin resource on isolated pages (fonts, videos, embeds) must be served with CORP/CORS headers or self-hosted. Self-hosting fonts and media is the default.
- The Hobby plan covers this non-commercial personal portfolio. Large VM assets have to stay within the bandwidth limits.
