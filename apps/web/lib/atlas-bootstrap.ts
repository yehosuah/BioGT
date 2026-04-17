import type { PoolClient } from "pg";

import {
  areaGeometry,
  areas,
  citations,
  internalOccurrences,
  sources,
  species,
  storyModules
} from "@/lib/demo-data";
import { maybeOne, withTransaction } from "@/lib/db";

let bootstrapPromise: Promise<void> | null = null;

const BOOTSTRAP_CELL_WIDTH = 0.18;

const roundCell = (value: number) => Math.round(value * 4) / 4;

const buildCellId = (longitude: number, latitude: number) =>
  `hex:${roundCell(longitude).toFixed(2)}:${roundCell(latitude).toFixed(2)}`;

const buildCellPolygon = (longitude: number, latitude: number) => {
  const centerLng = roundCell(longitude);
  const centerLat = roundCell(latitude);
  const half = BOOTSTRAP_CELL_WIDTH / 2;

  return {
    type: "Polygon",
    coordinates: [
      [
        [centerLng - half, centerLat - half],
        [centerLng + half, centerLat - half],
        [centerLng + half, centerLat + half],
        [centerLng - half, centerLat + half],
        [centerLng - half, centerLat - half]
      ]
    ]
  };
};

const isBootstrapEnabled = () => process.env.BIOGT_BOOTSTRAP_DEMO_DATA === "true";

const insertGeometry = async (
  client: PoolClient,
  {
    externalKey,
    feature,
    kind,
    label
  }: {
    externalKey: string;
    feature: unknown;
    kind: string;
    label: string;
  }
) => {
  const result = await client.query<{ id: string }>(
    `
      insert into area_geometries (external_key, kind, label, geom)
      values ($1, $2::area_kind, $3, st_setsrid(st_geomfromgeojson($4), 4326))
      on conflict (external_key) do update
      set kind = excluded.kind,
          label = excluded.label,
          geom = excluded.geom
      returning id
    `,
    [externalKey, kind, label, JSON.stringify((feature as { geometry: unknown }).geometry)]
  );

  return result.rows[0]!.id;
};

const ensureSources = async (client: PoolClient) => {
  const datasetIds = new Map<string, string>();

  for (const source of sources) {
    await client.query(
      `
        insert into sources (
          id,
          slug,
          name,
          tier,
          license,
          freshness,
          homepage,
          citation,
          description
        )
        values ($1, $2, $3, $4::source_tier, $5, $6, $7, $8, $9)
        on conflict (id) do update
        set slug = excluded.slug,
            name = excluded.name,
            tier = excluded.tier,
            license = excluded.license,
            freshness = excluded.freshness,
            homepage = excluded.homepage,
            citation = excluded.citation,
            description = excluded.description
      `,
      [
        source.id,
        source.slug,
        source.name,
        source.tier,
        source.license,
        source.freshness,
        source.homepage,
        source.citation,
        source.description
      ]
    );

    const dataset = await client.query<{ id: string }>(
      `
        insert into datasets (
          source_id,
          external_key,
          title,
          description,
          metadata_url,
          refreshed_at
        )
        values ($1, $2, $3, $4, $5, now())
        on conflict do nothing
        returning id
      `,
      [
        source.id,
        `${source.id}-seed`,
        `${source.name} seed dataset`,
        `Bootstrapped Phase 1 atlas dataset for ${source.name}.`,
        source.homepage
      ]
    );

    const datasetId =
      dataset.rows[0]?.id ??
      (
        await client.query<{ id: string }>(
          `select id from datasets where source_id = $1 order by created_at asc limit 1`,
          [source.id]
        )
      ).rows[0]!.id;

    datasetIds.set(source.id, datasetId);
  }

  return datasetIds;
};

const ensureTaxa = async (client: PoolClient) => {
  const taxonIds = new Map<string, string>();

  for (const entry of species) {
    const result = await client.query<{ id: string }>(
      `
        insert into taxa (
          slug,
          common_name,
          scientific_name,
          taxonomic_group,
          status,
          endemism,
          summary,
          hero_metric,
          featured_rank
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (slug) do update
        set common_name = excluded.common_name,
            scientific_name = excluded.scientific_name,
            taxonomic_group = excluded.taxonomic_group,
            status = excluded.status,
            endemism = excluded.endemism,
            summary = excluded.summary,
            hero_metric = excluded.hero_metric,
            featured_rank = excluded.featured_rank
        returning id
      `,
      [
        entry.slug,
        entry.commonName,
        entry.scientificName,
        entry.group,
        entry.status,
        entry.endemism,
        entry.summary,
        entry.heroMetric,
        species.findIndex((item) => item.id === entry.id) + 1
      ]
    );

    taxonIds.set(entry.id, result.rows[0]!.id);

    for (const sourceId of entry.sourceIds) {
      await client.query(
        `
          insert into entity_source_links (entity_type, entity_ref, source_id)
          values ('species', $1, $2)
          on conflict (entity_type, entity_ref, source_id) do nothing
        `,
        [entry.id, sourceId]
      );
    }
  }

  return taxonIds;
};

const ensureAreas = async (client: PoolClient) => {
  const areaIds = new Map<string, string>();
  const adminAreaIds = new Map<string, string>();
  const protectedAreaIds = new Map<string, string>();

  for (const [externalKey, feature] of Object.entries(areaGeometry)) {
    const properties = (feature as unknown as { properties: { kind: string; label: string } })
      .properties;
    const id = await insertGeometry(client, {
      externalKey,
      feature,
      kind: properties.kind,
      label: properties.label
    });
    areaIds.set(externalKey, id);
  }

  for (const area of areas) {
    if (area.kind === "protected_area") {
      const result = await client.query<{ id: string }>(
        `
          insert into areas_protected (
            slug,
            name,
            summary,
            geometry_id,
            department,
            featured_rank
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict (slug) do update
          set name = excluded.name,
              summary = excluded.summary,
              geometry_id = excluded.geometry_id,
              department = excluded.department,
              featured_rank = excluded.featured_rank
          returning id
        `,
        [
          area.slug,
          area.name,
          area.summary,
          areaIds.get(area.geometryId),
          area.department ?? null,
          areas.findIndex((item) => item.id === area.id) + 1
        ]
      );
      protectedAreaIds.set(area.id, result.rows[0]!.id);
    } else {
      const result = await client.query<{ id: string }>(
        `
          insert into areas_admin (
            slug,
            name,
            kind,
            summary,
            geometry_id,
            department,
            featured_rank
          )
          values ($1, $2, $3::area_kind, $4, $5, $6, $7)
          on conflict (slug) do update
          set name = excluded.name,
              kind = excluded.kind,
              summary = excluded.summary,
              geometry_id = excluded.geometry_id,
              department = excluded.department,
              featured_rank = excluded.featured_rank
          returning id
        `,
        [
          area.slug,
          area.name,
          area.kind,
          area.summary,
          areaIds.get(area.geometryId),
          area.department ?? null,
          areas.findIndex((item) => item.id === area.id) + 1
        ]
      );
      adminAreaIds.set(area.id, result.rows[0]!.id);
    }

    await client.query(
      `
        insert into area_metrics (
          area_kind,
          area_ref,
          species_count,
          endemic_count,
          protected_count,
          story_label,
          refreshed_at
        )
        values ($1::area_kind, $2, $3, $4, $5, $6, now())
        on conflict do nothing
      `,
      [
        area.kind,
        area.id,
        area.metrics.speciesCount,
        area.metrics.endemicCount,
        area.metrics.protectedCount,
        area.metrics.storyLabel
      ]
    );

    for (const sourceId of area.sourceIds) {
      await client.query(
        `
          insert into entity_source_links (entity_type, entity_ref, source_id)
          values ('area', $1, $2)
          on conflict (entity_type, entity_ref, source_id) do nothing
        `,
        [area.id, sourceId]
      );
    }
  }

  return {
    adminAreaIds,
    protectedAreaIds
  };
};

const ensureStoryModules = async (client: PoolClient) => {
  for (const [index, module] of storyModules.entries()) {
    await client.query(
      `
        insert into story_modules (
          slug,
          eyebrow,
          title,
          body,
          accent,
          target_href,
          published,
          sort_order
        )
        values ($1, $2, $3, $4, $5, $6, true, $7)
        on conflict (slug) do update
        set eyebrow = excluded.eyebrow,
            title = excluded.title,
            body = excluded.body,
            accent = excluded.accent,
            target_href = excluded.target_href,
            published = excluded.published,
            sort_order = excluded.sort_order
      `,
      [
        module.id,
        module.eyebrow,
        module.title,
        module.body,
        module.accent,
        module.href ?? null,
        index + 1
      ]
    );
  }
};

const ensureCitations = async (client: PoolClient) => {
  for (const citation of citations) {
    await client.query(
      `
        insert into citations (entity_type, entity_ref, title, citation_text, href)
        values ($1, $2, $3, $4, $5)
        on conflict do nothing
      `,
      [citation.entityType, citation.entityId, citation.title, citation.text, citation.href]
    );
  }
};

const ensureOccurrences = async (
  client: PoolClient,
  {
    adminAreaIds,
    datasetIds,
    protectedAreaIds,
    taxonIds
  }: {
    adminAreaIds: Map<string, string>;
    datasetIds: Map<string, string>;
    protectedAreaIds: Map<string, string>;
    taxonIds: Map<string, string>;
  }
) => {
  for (const occurrence of internalOccurrences) {
    const raw = await client.query<{ id: string }>(
      `
        insert into occurrences_raw (
          dataset_id,
          source_id,
          source_occurrence_id,
          payload
        )
        values ($1, $2, $3, $4::jsonb)
        returning id
      `,
      [
        datasetIds.get(occurrence.sourceId) ?? null,
        occurrence.sourceId,
        occurrence.id,
        JSON.stringify(occurrence)
      ]
    );

    const publicPolygon = buildCellPolygon(occurrence.lng, occurrence.lat);
    const normalized = await client.query<{ id: string }>(
      `
        insert into occurrences_normalized (
          raw_occurrence_id,
          taxon_id,
          source_id,
          visibility,
          area_admin_id,
          area_protected_id,
          observed_at,
          elevation_band,
          is_sensitive,
          exact_geom,
          public_geom
        )
        values (
          $1,
          $2,
          $3,
          $4::visibility,
          $5,
          $6,
          $7,
          $8,
          $9,
          st_setsrid(st_makepoint($10, $11), 4326),
          st_setsrid(st_geomfromgeojson($12), 4326)
        )
        returning id
      `,
      [
        raw.rows[0]!.id,
        taxonIds.get(occurrence.speciesId) ?? null,
        occurrence.sourceId,
        occurrence.visibility,
        adminAreaIds.get(occurrence.departmentSlug) ?? null,
        protectedAreaIds.get(occurrence.areaId) ?? null,
        occurrence.observedAt,
        occurrence.elevationBand,
        occurrence.visibility === "internal_exact",
        occurrence.lng,
        occurrence.lat,
        JSON.stringify(publicPolygon)
      ]
    );

    await client.query(
      `
        insert into occurrences_public (
          normalized_occurrence_id,
          visibility,
          public_geom,
          public_summary
        )
        values (
          $1,
          'generalized_public'::visibility,
          st_setsrid(st_geomfromgeojson($2), 4326),
          $3::jsonb
        )
      `,
      [
        normalized.rows[0]!.id,
        JSON.stringify(publicPolygon),
        JSON.stringify({
          cellId: buildCellId(occurrence.lng, occurrence.lat),
          departmentSlug: occurrence.departmentSlug,
          speciesId: occurrence.speciesId,
          protectedArea: occurrence.protectedArea,
          sourceId: occurrence.sourceId
        })
      ]
    );
  }
};

const upsertTaxonPresenceRollups = async (client: PoolClient, sql: string) => {
  await client.query(`
    ${sql}
    on conflict (taxon_id, area_kind, area_ref, source_tier) do update
    set occurrence_count = excluded.occurrence_count,
        protected_occurrence_count = excluded.protected_occurrence_count,
        latest_observed_at = excluded.latest_observed_at,
        elevation_bands = excluded.elevation_bands,
        refreshed_at = excluded.refreshed_at
  `);
};

const ensureTaxonPresenceRollups = async (client: PoolClient) => {
  await upsertTaxonPresenceRollups(
    client,
    `
      insert into taxon_presence_rollups (
        taxon_id,
        area_kind,
        area_ref,
        source_tier,
        occurrence_count,
        protected_occurrence_count,
        latest_observed_at,
        elevation_bands,
        refreshed_at
      )
      select
        occ.taxon_id,
        'country'::area_kind as area_kind,
        'guatemala' as area_ref,
        src.tier,
        count(*)::int as occurrence_count,
        count(*) filter (where occ.area_protected_id is not null)::int as protected_occurrence_count,
        max(occ.observed_at) as latest_observed_at,
        coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}') as elevation_bands,
        now() as refreshed_at
      from occurrences_normalized occ
      join sources src on src.id = occ.source_id
      where occ.taxon_id is not null
      group by occ.taxon_id, src.tier
    `
  );

  await upsertTaxonPresenceRollups(
    client,
    `
      insert into taxon_presence_rollups (
        taxon_id,
        area_kind,
        area_ref,
        source_tier,
        occurrence_count,
        protected_occurrence_count,
        latest_observed_at,
        elevation_bands,
        refreshed_at
      )
      select
        occ.taxon_id,
        'department'::area_kind as area_kind,
        dept.slug as area_ref,
        src.tier,
        count(*)::int as occurrence_count,
        count(*) filter (where occ.area_protected_id is not null)::int as protected_occurrence_count,
        max(occ.observed_at) as latest_observed_at,
        coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}') as elevation_bands,
        now() as refreshed_at
      from occurrences_normalized occ
      join sources src on src.id = occ.source_id
      join areas_admin dept on dept.id = occ.area_admin_id
      where occ.taxon_id is not null
        and dept.kind = 'department'
      group by occ.taxon_id, dept.slug, src.tier
    `
  );

  await upsertTaxonPresenceRollups(
    client,
    `
      insert into taxon_presence_rollups (
        taxon_id,
        area_kind,
        area_ref,
        source_tier,
        occurrence_count,
        protected_occurrence_count,
        latest_observed_at,
        elevation_bands,
        refreshed_at
      )
      select
        occ.taxon_id,
        'protected_area'::area_kind as area_kind,
        pa.slug as area_ref,
        src.tier,
        count(*)::int as occurrence_count,
        count(*) filter (where occ.area_protected_id is not null)::int as protected_occurrence_count,
        max(occ.observed_at) as latest_observed_at,
        coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}') as elevation_bands,
        now() as refreshed_at
      from occurrences_normalized occ
      join sources src on src.id = occ.source_id
      join areas_protected pa on pa.id = occ.area_protected_id
      where occ.taxon_id is not null
      group by occ.taxon_id, pa.slug, src.tier
    `
  );

  await upsertTaxonPresenceRollups(
    client,
    `
      insert into taxon_presence_rollups (
        taxon_id,
        area_kind,
        area_ref,
        source_tier,
        occurrence_count,
        protected_occurrence_count,
        latest_observed_at,
        elevation_bands,
        refreshed_at
      )
      select
        occ.taxon_id,
        'public_hex'::area_kind as area_kind,
        'hex:' || md5(st_asgeojson(pub.public_geom)) as area_ref,
        src.tier,
        count(*)::int as occurrence_count,
        count(*) filter (where occ.area_protected_id is not null)::int as protected_occurrence_count,
        max(occ.observed_at) as latest_observed_at,
        coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}') as elevation_bands,
        now() as refreshed_at
      from occurrences_normalized occ
      join occurrences_public pub on pub.normalized_occurrence_id = occ.id
      join sources src on src.id = occ.source_id
      where occ.taxon_id is not null
      group by occ.taxon_id, 'hex:' || md5(st_asgeojson(pub.public_geom)), src.tier
    `
  );
};

const runBootstrap = async () => {
  const existing = await maybeOne<{ count: string }>(`select count(*)::text as count from sources`);
  if (Number(existing?.count ?? 0) > 0) {
    return;
  }

  await withTransaction(async (client) => {
    const datasetIds = await ensureSources(client);
    const taxonIds = await ensureTaxa(client);
    const { adminAreaIds, protectedAreaIds } = await ensureAreas(client);
    await ensureStoryModules(client);
    await ensureCitations(client);
    await ensureOccurrences(client, {
      adminAreaIds,
      datasetIds,
      protectedAreaIds,
      taxonIds
    });
    await ensureTaxonPresenceRollups(client);
  });
};

export const ensureAtlasBootstrap = async () => {
  if (!isBootstrapEnabled()) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
};
