# Sync Notes

## First sync — June 2026

- Shape: `package` (no Storybook; 28 named exports from 15 component files)
- `vite-plugin-dts` required for component discovery — generates `.d.ts` in `dist/src/`
- `types` field in `package.json` → `./dist/src/index.d.ts` (not `./dist/index.d.ts`)
- Google Fonts CDN import triggers `[FONT_REMOTE]` info — non-blocking, families served at runtime

## Browser-event gated components

`InstallPrompt` and `OfflineBanner` return `null` until browser events fire
(`beforeinstallprompt` / `navigator.onLine === false`). Their previews use
inline-styles reproductions of the visible-state JSX — not the real component.
If the component UI changes, update `.design-sync/previews/InstallPrompt.tsx`
and `.design-sync/previews/OfflineBanner.tsx` manually.

## Skeleton exports

`Skeleton.jsx` exports 12+ named variants. Each is registered as its own
component in ds-bundle (SkeletonBlock is the primitive; the rest are page-level
skeletons with zero props).

## Re-sync

Run from `design-system/`:
```
node .ds-sync/resync.mjs
```
