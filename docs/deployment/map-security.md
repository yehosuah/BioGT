# Map Security and Operations

## Public environment variables

These values are safe to expose to browser code because they are intended for public frontend runtime configuration:

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_MAP_PROVIDER`
- `NEXT_PUBLIC_DEFAULT_LAT`
- `NEXT_PUBLIC_DEFAULT_LNG`
- `NEXT_PUBLIC_DEFAULT_ZOOM`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- `NEXT_PUBLIC_ARCGIS_API_KEY`
- `NEXT_PUBLIC_MAP_STYLE_URL`
- `NEXT_PUBLIC_TILE_URL_TEMPLATE`
- `NEXT_PUBLIC_ENABLE_MAP_DEBUG`
- `NEXT_PUBLIC_ENABLE_MAP_TELEMETRY`

Browser-exposed keys are not secret once shipped. Safety comes from provider restrictions, least privilege, monitoring, and safe fallbacks.

## Mapbox token restriction checklist

- Restrict token to approved production, staging, and localhost origins.
- Limit token scopes to only APIs/styles actually used.
- Keep separate tokens for development, staging, and production.
- Rotate token if it appears in unexpected logs, screenshots, or support dumps.
- Review usage and billing anomalies regularly.

## Google Maps API key restriction checklist

- Restrict key by HTTP referrer for browser usage.
- Restrict key to only required Google Maps APIs.
- Keep separate keys for development, staging, and production.
- Rotate key if usage spikes or unexpected origins appear.
- Review quota, billing, and rejected-request dashboards regularly.

## ArcGIS key restriction checklist

- Restrict key to approved referrers or application identities where supported.
- Limit access to required ArcGIS services only.
- Separate development, staging, and production credentials.
- Monitor service usage and rotate keys on suspected exposure.

## Tile provider and caching notes

- Confirm tile/style provider terms before production use.
- Do not assume public demo tiles are production-safe for heavy traffic.
- If a provider enforces origin restrictions, enable them before deployment.
- Avoid logging full tile/style URLs when they contain query-string credentials.

## Production deployment checklist

- Keep `.env.example` committed and real `.env` files out of git.
- Validate `NEXT_PUBLIC_MAP_PROVIDER` before deployment.
- Confirm provider keys are restricted to production domains.
- Confirm only required provider services are enabled.
- Verify fallback UI appears on bad config or blocked network paths.
- Verify GeoJSON returned to public clients remains generalized and geoprivacy-safe.
- Verify large dataset warnings and slow-layer warnings appear in telemetry during smoke tests.

## Debugging checklist

- Check `NEXT_PUBLIC_MAP_PROVIDER`, style URL, and required provider key first.
- Confirm provider origin/referrer restrictions include current deployment hostname.
- Confirm map fallback renders instead of blank screen on bad config.
- Inspect sanitized telemetry and error logs for `map_preflight_failed`, `map_failed`, `layer_failed`, and `provider_usage_warning`.
- Re-test on clean network and blocked-network scenarios.

## What not to log

- Full Mapbox, Google Maps, or ArcGIS credentials.
- Full URLs with `key`, `token`, `access_token`, or `api_key` query params.
- Raw GeoJSON geometries or exact occurrence coordinates.
- Raw user search history tied to precise location or private identifiers.
- Full provider error payloads that echo secrets.

## What to monitor

- `map_preflight_failed`
- `map_failed`
- `layer_failed`
- `large_dataset_warning`
- `provider_usage_warning`
- Provider billing and quota anomalies
- Unusual 4xx or 5xx rates from map-related API routes
- Unexpected spikes in map initialization failures after deploy

## Security checklist

- Restrict public browser keys by domain/referrer where provider supports it.
- Restrict keys to only required APIs/services where provider supports it.
- Rotate keys if exposed unexpectedly.
- Use separate keys for development, staging, and production.
- Avoid committing `.env` files.
- Keep `.env.example` committed.
- Monitor usage and billing anomalies.
- Do not log full API URLs with key/token query params.
- Do not ship private datasets as static public files unless intended.
- Validate GeoJSON before rendering when possible.
