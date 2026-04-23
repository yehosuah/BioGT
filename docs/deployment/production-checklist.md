# Production Deployment Checklist

## Install

```bash
npm install
```

## Build

Preferred local production-style validation:

```bash
npm run typecheck
npm run test:web
npm run build
```

If local Node version is outside repo support range, use Docker or Node 22 LTS:

```bash
docker compose build web
```

## Preview

```bash
npm run start
```

Smoke-test `http://localhost:3000/map` after a production build.

## Required map env vars

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_MAP_PROVIDER`
- `NEXT_PUBLIC_DEFAULT_LAT`
- `NEXT_PUBLIC_DEFAULT_LNG`
- `NEXT_PUBLIC_DEFAULT_ZOOM`

Provider-specific requirements:

- `NEXT_PUBLIC_MAPBOX_TOKEN` for `NEXT_PUBLIC_MAP_PROVIDER=mapbox`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` for `NEXT_PUBLIC_MAP_PROVIDER=google`
- `NEXT_PUBLIC_ARCGIS_API_KEY` for `NEXT_PUBLIC_MAP_PROVIDER=arcgis`
- `NEXT_PUBLIC_TILE_URL_TEMPLATE` for `NEXT_PUBLIC_MAP_PROVIDER=leaflet`
- `NEXT_PUBLIC_MAP_STYLE_URL` or `NEXT_PUBLIC_TILE_URL_TEMPLATE` for `NEXT_PUBLIC_MAP_PROVIDER=maplibre`

## Provider key restrictions

- Apply domain/referrer restrictions before production cutover.
- Limit credentials to only required APIs and services.
- Use separate keys per environment.
- Verify billing dashboards after first production traffic.

## Domain restriction checks

- Production hostname allowed
- Staging hostname allowed
- Localhost allowed only for development credentials
- Old or retired preview domains removed from allowlists

## Smoke-test checklist

- `/map` renders base map successfully.
- Map fallback state appears on invalid provider config.
- Layer errors produce recoverable UI, not blank screen.
- Search, filter changes, and selection interactions still work.
- Telemetry emits `map_loaded`, `layer_loaded`, and failure events with sanitized payloads.
- No raw credentials appear in console or error output.

## Rollback checklist

- Keep last known-good env values and deployment artifact available.
- Revert to prior deployment if `map_preflight_failed` or `map_failed` spikes.
- Rotate provider credentials if rollback follows accidental exposure.
- Re-run smoke tests after rollback.

## Monitoring checklist

- Watch `map_preflight_failed`
- Watch `map_failed`
- Watch `layer_failed`
- Watch `large_dataset_warning`
- Watch `provider_usage_warning`
- Watch provider quota and billing anomalies
