# Map SVG Assets

BioGT keeps map SVGs in one provider-agnostic pipeline so marker, legend, popup, and future overlay code can resolve icons by meaning instead of by map SDK.

## Folders

- `raw/`: editable source SVGs.
- `optimized/`: generated output from `npm run optimize:svg`.

## Rules

- Every SVG must keep a valid `viewBox`.
- Do not hardcode `width` or `height` in source files.
- Use `currentColor` unless a fixed color is essential.
- Keep shapes simple enough to read at marker sizes around `16px` to `28px`.
- Do not add provider-specific naming such as `mapbox-pin` or `leaflet-cluster`.
- Accessibility labels belong in inline renderers like `MapIcon`; use `<title>` there when icon is meaningful.

## Add New Icon

1. Add source file to `raw/`.
2. Run `npm run optimize:svg`.
3. Run `npm run check:svg`.
4. Register icon in:
   - `apps/web/features/map/assets/iconTypes.ts`
   - `apps/web/features/map/assets/iconDefinitions.ts`
   - `apps/web/features/map/assets/iconMetadata.ts`
5. Update category/feature mapping in `apps/web/features/map/assets/iconRegistry.ts`.
6. Add or update tests in `apps/web/features/map/assets/iconRegistry.test.ts`.

## Adapter Consumption

- UI should call registry helpers like `getMapIcon`, `getIconForCategory`, and `getIconForFeature`.
- Map adapters should receive resolved metadata or icon ids from app logic. They should not decide categories themselves.
- If a provider needs DOM markers, use plain icon definition metadata or rendered `MapIcon` output. If a provider needs URL assets later, use matching file in `optimized/`.
