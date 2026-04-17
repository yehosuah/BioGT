import type {
  AreaRecord,
  CitationRecord,
  FeatureProperties,
  InternalOccurrence,
  MapFeature,
  MapFeatureCollection,
  SearchResult,
  SourceRecord,
  SpeciesRecord,
  StoryModule
} from "@/lib/types";

const rectangle = (
  west: number,
  south: number,
  east: number,
  north: number,
  properties: FeatureProperties
): MapFeature => ({
  type: "Feature",
  properties,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south]
      ]
    ]
  }
});

export const sources: SourceRecord[] = [
  {
    id: "biodiversidad-gt",
    slug: "biodiversidad-gt",
    name: "Portal de Biodiversidad de Guatemala",
    tier: "institutional",
    license: "CC0 / según colección",
    freshness: "Actualización continua con DwC-A público",
    homepage: "https://biodiversidad.gt/portal/index.php",
    citation:
      "Biodiversidad de Guatemala. 2026. Portal de Biodiversidad de Guatemala. Accedido vía biodiversidad.gt/portal.",
    description:
      "Columna vertebral institucional para ocurrencias, listados interactivos, multimedia y paquetes Darwin Core."
  },
  {
    id: "wdpa",
    slug: "wdpa",
    name: "Protected Planet / WDPA",
    tier: "official",
    license: "Según términos de Protected Planet",
    freshness: "Corte mensual recomendado",
    homepage: "https://www.protectedplanet.net/en",
    citation:
      "UNEP-WCMC and IUCN. Protected Planet: The World Database on Protected Areas (WDPA).",
    description:
      "Referencia de polígonos de áreas protegidas para navegación principal y contexto territorial."
  },
  {
    id: "geoboundaries",
    slug: "geoboundaries",
    name: "geoBoundaries Guatemala ADM",
    tier: "official",
    license: "Open boundary distribution",
    freshness: "Corte versionado por dataset",
    homepage: "https://www.geoboundaries.org",
    citation:
      "geoBoundaries Global Administrative Database. Guatemala administrative boundaries.",
    description:
      "Capas administrativas de respaldo para departamentos y municipios cuando no exista una alternativa redistribuible más oficial."
  },
  {
    id: "gbif",
    slug: "gbif",
    name: "GBIF Guatemala enrichments",
    tier: "institutional",
    license: "Según dataset de origen",
    freshness: "Sincronización programada",
    homepage: "https://www.gbif.org",
    citation:
      "GBIF.org occurrence enrichments, consulted for cross-institutional context.",
    description:
      "Cobertura adicional para enriquecer listas de presencia y metadatos taxonómicos."
  },
  {
    id: "inaturalist",
    slug: "inaturalist",
    name: "iNaturalist community layer",
    tier: "community",
    license: "Según observación",
    freshness: "Sincronización programada",
    homepage: "https://www.inaturalist.org",
    citation:
      "iNaturalist community observations, exposed as labeled overlay only.",
    description:
      "Capa comunitaria claramente etiquetada; no participa en conteos canónicos de riqueza en Fase 1."
  }
];

export const citations: CitationRecord[] = [
  {
    id: "citation-area-lachua",
    entityType: "area",
    entityId: "laguna-lachua",
    title: "Lachuá / biodiversidad base",
    text: "Síntesis construida a partir de Biodiversidad.gt, Protected Planet y referencias curatoriales del portal.",
    href: "https://biodiversidad.gt/portal/checklists/checklist.php?clid=12169&pid=9"
  },
  {
    id: "citation-area-tikal",
    entityType: "area",
    entityId: "tikal",
    title: "Tikal / riqueza y presencia",
    text: "Riqueza pública agregada con geoprivacidad aplicada. Los puntos exactos no son expuestos.",
    href: "https://biodiversidad.gt/portal/projects/index.php"
  },
  {
    id: "citation-species-quetzal",
    entityType: "species",
    entityId: "resplandeciente-quetzal",
    title: "Citación del quetzal",
    text: "Distribución pública resumida desde colecciones institucionales y capas de áreas protegidas.",
    href: "https://biodiversidad.gt/portal/checklists/index.php"
  },
  {
    id: "citation-species-jaguar",
    entityType: "species",
    entityId: "jaguar",
    title: "Citación del jaguar",
    text: "Las presencias sensibles se agregan a nivel de área protegida y celdas públicas generalizadas.",
    href: "https://biodiversidad.gt/portal/includes/usagepolicy.php"
  },
  {
    id: "citation-source-biodiversidad",
    entityType: "source",
    entityId: "biodiversidad-gt",
    title: "Política de uso de datos",
    text: "El portal solicita citación adecuada y evita redistribución sin permiso de los propietarios.",
    href: "https://biodiversidad.gt/portal/includes/usagepolicy.php"
  }
];

export const storyModules: StoryModule[] = [
  {
    id: "story-watershed",
    eyebrow: "Relato territorial",
    title: "Bosques nublados, humedales y selva baja en una misma interfaz",
    body:
      "La portada introduce Guatemala como un mosaico vivo: cada región abre su historia ecológica, sus especies destacadas y el estado de su riqueza visible.",
    accent: "var(--chart-cyan)",
    href: "/map"
  },
  {
    id: "story-protected-areas",
    eyebrow: "Navegación principal",
    title: "Las áreas protegidas son la puerta de entrada",
    body:
      "El recorrido arranca con Lachuá, Tikal y Sierra de las Minas. Desde allí el usuario baja a especies, citas, capas públicas y filtros temáticos.",
    accent: "var(--chart-gold)",
    href: "/sources"
  },
  {
    id: "story-geoprivacy",
    eyebrow: "Diseño responsable",
    title: "Riqueza visible sin exponer coordenadas sensibles",
    body:
      "La interfaz muestra presencia, gradientes y celdas generalizadas. Las decisiones de visibilidad quedan explicadas con lenguaje claro y trazabilidad de fuente.",
    accent: "var(--chart-rose)"
  }
];

export const species: SpeciesRecord[] = [
  {
    id: "resplandeciente-quetzal",
    slug: "resplandeciente-quetzal",
    commonName: "Quetzal resplandeciente",
    scientificName: "Pharomachrus mocinno",
    group: "aves",
    status: "Amenazada",
    endemism: "Mesoamérica",
    summary:
      "Ave emblemática de los bosques nublados guatemaltecos. En el producto se destaca por su capacidad de conectar turismo, conservación y educación pública.",
    presenceAreaIds: ["laguna-lachua", "sierra-de-las-minas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "2 corredores priorizados"
  },
  {
    id: "jaguar",
    slug: "jaguar",
    commonName: "Jaguar",
    scientificName: "Panthera onca",
    group: "mamiferos",
    status: "Protegida",
    endemism: "No endémica",
    summary:
      "Gran carnívoro paraguas para la narrativa de conectividad. Su capa pública se muestra siempre agregada y sin puntos exactos.",
    presenceAreaIds: ["tikal", "sierra-de-las-minas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "Geoprivacidad estricta"
  },
  {
    id: "incilius-bocourti",
    slug: "incilius-bocourti",
    commonName: "Sapo de Bocourt",
    scientificName: "Incilius bocourti",
    group: "anfibios",
    status: "Preocupación menor",
    endemism: "Guatemala y Chiapas",
    summary:
      "Ejemplo de especie usada para cruzar listados interactivos del portal con presencia por región y capas públicas de área protegida.",
    presenceAreaIds: ["laguna-lachua", "tikal"],
    sourceIds: ["biodiversidad-gt"],
    heroMetric: "Listados enlazados"
  },
  {
    id: "heliconia-latispatha",
    slug: "heliconia-latispatha",
    commonName: "Platanillo rojo",
    scientificName: "Heliconia latispatha",
    group: "flora",
    status: "Nativa",
    endemism: "Mesoamérica",
    summary:
      "Planta bandera para la capa de flora. Sirve como ejemplo de visualización pública no sensible y riqueza vegetal en corredores húmedos.",
    presenceAreaIds: ["laguna-lachua", "chocon-machacas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "Presencia en humedales"
  },
  {
    id: "papilio-polyxenes",
    slug: "papilio-polyxenes",
    commonName: "Mariposa cola de golondrina negra",
    scientificName: "Papilio polyxenes asterius",
    group: "insectos",
    status: "Observación pública",
    endemism: "No endémica",
    summary:
      "Capa idónea para mostrar cómo un mismo mapa combina insectos visibles, áreas protegidas y cobertura institucional.",
    presenceAreaIds: ["tikal", "laguna-lachua", "sierra-de-las-minas"],
    sourceIds: ["biodiversidad-gt", "inaturalist"],
    heroMetric: "Overlay comunitario etiquetado"
  },
  {
    id: "guacamaya-roja",
    slug: "guacamaya-roja",
    commonName: "Guacamaya roja",
    scientificName: "Ara macao cyanopterus",
    group: "aves",
    status: "Amenazada",
    endemism: "Mesoamérica",
    summary:
      "Ave bandera de selvas tropicales y turismo de observación. Aporta una lectura clara de corredores, refugios y cobertura pública por celda.",
    presenceAreaIds: ["tikal", "chocon-machacas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "Cobertura en selva y humedal"
  },
  {
    id: "ceiba-pentandra",
    slug: "ceiba-pentandra",
    commonName: "Ceiba",
    scientificName: "Ceiba pentandra",
    group: "flora",
    status: "Nativa",
    endemism: "Neotrópico",
    summary:
      "Árbol emblemático para dar presencia a flora de baja y media altitud. Ayuda a que la lectura del mapa no dependa solo de fauna carismática.",
    presenceAreaIds: ["tikal", "laguna-lachua", "chocon-machacas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "Gradiente de bosque húmedo"
  },
  {
    id: "tapirus-bairdii",
    slug: "tapirus-bairdii",
    commonName: "Tapir centroamericano",
    scientificName: "Tapirus bairdii",
    group: "mamiferos",
    status: "En peligro",
    endemism: "Mesoamérica",
    summary:
      "Mamífero de gran escala territorial que refuerza la capa de presencia generalizada y la lectura de conectividad biológica.",
    presenceAreaIds: ["laguna-lachua", "sierra-de-las-minas"],
    sourceIds: ["biodiversidad-gt", "gbif"],
    heroMetric: "Conectividad de bosque húmedo"
  }
];

export const areas: AreaRecord[] = [
  {
    id: "guatemala",
    slug: "guatemala",
    name: "Guatemala",
    kind: "country",
    summary:
      "Vista nacional con narrativa, riqueza resumida por departamento y protagonismo de áreas protegidas prioritarias.",
    metrics: {
      speciesCount: 912,
      protectedCount: 54,
      endemicCount: 63,
      storyLabel: "Pulso nacional"
    },
    featuredSpeciesIds: [
      "resplandeciente-quetzal",
      "jaguar",
      "heliconia-latispatha"
    ],
    sourceIds: ["biodiversidad-gt", "wdpa", "geoboundaries"],
    visibility: "summary_only",
    geometryId: "country"
  },
  {
    id: "peten",
    slug: "peten",
    name: "Petén",
    kind: "department",
    summary:
      "Cobertura alta de selva baja y conectividad biológica. La capa departamental se usa cuando el mapa está alejado.",
    metrics: {
      speciesCount: 384,
      protectedCount: 12,
      endemicCount: 18,
      storyLabel: "Selva baja y conectividad"
    },
    featuredSpeciesIds: ["jaguar", "incilius-bocourti", "papilio-polyxenes"],
    sourceIds: ["biodiversidad-gt", "geoboundaries"],
    visibility: "summary_only",
    geometryId: "dept-peten"
  },
  {
    id: "alta-verapaz",
    slug: "alta-verapaz",
    name: "Alta Verapaz",
    kind: "department",
    summary:
      "Departamento clave para transiciones altitudinales, agua dulce y bosques húmedos.",
    metrics: {
      speciesCount: 291,
      protectedCount: 8,
      endemicCount: 15,
      storyLabel: "Bosque húmedo y karst"
    },
    featuredSpeciesIds: [
      "resplandeciente-quetzal",
      "heliconia-latispatha",
      "incilius-bocourti"
    ],
    sourceIds: ["biodiversidad-gt", "geoboundaries"],
    visibility: "summary_only",
    geometryId: "dept-alta-verapaz"
  },
  {
    id: "izabal",
    slug: "izabal",
    name: "Izabal",
    kind: "department",
    summary:
      "Nodo costero y caribeño con gradientes de humedal, marino costero y montaña.",
    metrics: {
      speciesCount: 256,
      protectedCount: 9,
      endemicCount: 10,
      storyLabel: "Costa, humedal y montaña"
    },
    featuredSpeciesIds: [
      "resplandeciente-quetzal",
      "heliconia-latispatha",
      "papilio-polyxenes"
    ],
    sourceIds: ["biodiversidad-gt", "geoboundaries"],
    visibility: "summary_only",
    geometryId: "dept-izabal"
  },
  {
    id: "tikal",
    slug: "tikal",
    name: "Parque Nacional Tikal",
    kind: "protected_area",
    department: "Petén",
    summary:
      "Área protegida ancla del norte. En el flujo público sirve para pasar de la narrativa territorial a especies y citas.",
    metrics: {
      speciesCount: 198,
      protectedCount: 1,
      endemicCount: 9,
      storyLabel: "Selva baja protegida"
    },
    featuredSpeciesIds: ["jaguar", "incilius-bocourti", "papilio-polyxenes"],
    sourceIds: ["biodiversidad-gt", "wdpa"],
    visibility: "generalized_public",
    geometryId: "pa-tikal"
  },
  {
    id: "laguna-lachua",
    slug: "laguna-lachua",
    name: "Parque Nacional Laguna Lachuá",
    kind: "protected_area",
    department: "Alta Verapaz",
    summary:
      "Humedal kárstico y selva húmeda. Ideal para mostrar filtros por grupos taxonómicos, riqueza y citas institucionales.",
    metrics: {
      speciesCount: 164,
      protectedCount: 1,
      endemicCount: 7,
      storyLabel: "Agua dulce y selva húmeda"
    },
    featuredSpeciesIds: [
      "resplandeciente-quetzal",
      "heliconia-latispatha",
      "incilius-bocourti"
    ],
    sourceIds: ["biodiversidad-gt", "wdpa"],
    visibility: "generalized_public",
    geometryId: "pa-lachua"
  },
  {
    id: "sierra-de-las-minas",
    slug: "sierra-de-las-minas",
    name: "Reserva de Biosfera Sierra de las Minas",
    kind: "protected_area",
    department: "Izabal",
    summary:
      "Reserva clave para la historia de conectividad altitudinal y especies sensibles. El mapa la prioriza en zoom intermedio.",
    metrics: {
      speciesCount: 219,
      protectedCount: 1,
      endemicCount: 14,
      storyLabel: "Bosque nuboso y conectividad"
    },
    featuredSpeciesIds: [
      "resplandeciente-quetzal",
      "jaguar",
      "papilio-polyxenes"
    ],
    sourceIds: ["biodiversidad-gt", "wdpa"],
    visibility: "generalized_public",
    geometryId: "pa-sierra"
  },
  {
    id: "chocon-machacas",
    slug: "chocon-machacas",
    name: "Biotopo Chocón Machacas",
    kind: "protected_area",
    department: "Izabal",
    summary:
      "Biotopo caribeño que introduce una lectura pública entre humedales, flora y fauna de baja altitud.",
    metrics: {
      speciesCount: 142,
      protectedCount: 1,
      endemicCount: 4,
      storyLabel: "Humedal caribeño"
    },
    featuredSpeciesIds: ["heliconia-latispatha", "papilio-polyxenes"],
    sourceIds: ["biodiversidad-gt", "wdpa"],
    visibility: "generalized_public",
    geometryId: "pa-chocon"
  }
];

export const internalOccurrences: InternalOccurrence[] = [
  {
    id: "occ-001",
    speciesId: "resplandeciente-quetzal",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 15.9002,
    lng: -90.6631,
    elevationBand: "alta",
    observedAt: "2025-05-13",
    protectedArea: true
  },
  {
    id: "occ-002",
    speciesId: "resplandeciente-quetzal",
    areaId: "sierra-de-las-minas",
    departmentSlug: "izabal",
    sourceId: "gbif",
    visibility: "generalized_public",
    lat: 15.2171,
    lng: -89.8744,
    elevationBand: "alta",
    observedAt: "2025-05-21",
    protectedArea: true
  },
  {
    id: "occ-003",
    speciesId: "jaguar",
    areaId: "tikal",
    departmentSlug: "peten",
    sourceId: "biodiversidad-gt",
    visibility: "internal_exact",
    lat: 17.2344,
    lng: -89.6239,
    elevationBand: "media",
    observedAt: "2024-09-04",
    protectedArea: true
  },
  {
    id: "occ-004",
    speciesId: "jaguar",
    areaId: "sierra-de-las-minas",
    departmentSlug: "izabal",
    sourceId: "gbif",
    visibility: "internal_exact",
    lat: 15.3771,
    lng: -89.5778,
    elevationBand: "alta",
    observedAt: "2024-11-22",
    protectedArea: true
  },
  {
    id: "occ-005",
    speciesId: "incilius-bocourti",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 15.9119,
    lng: -90.6685,
    elevationBand: "media",
    observedAt: "2025-03-14",
    protectedArea: true
  },
  {
    id: "occ-006",
    speciesId: "incilius-bocourti",
    areaId: "tikal",
    departmentSlug: "peten",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 17.2194,
    lng: -89.6395,
    elevationBand: "baja",
    observedAt: "2025-01-08",
    protectedArea: true
  },
  {
    id: "occ-007",
    speciesId: "heliconia-latispatha",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 15.897,
    lng: -90.6511,
    elevationBand: "media",
    observedAt: "2024-06-09",
    protectedArea: true
  },
  {
    id: "occ-008",
    speciesId: "heliconia-latispatha",
    areaId: "chocon-machacas",
    departmentSlug: "izabal",
    sourceId: "gbif",
    visibility: "generalized_public",
    lat: 15.7611,
    lng: -88.9603,
    elevationBand: "baja",
    observedAt: "2024-07-18",
    protectedArea: true
  },
  {
    id: "occ-009",
    speciesId: "papilio-polyxenes",
    areaId: "tikal",
    departmentSlug: "peten",
    sourceId: "inaturalist",
    visibility: "generalized_public",
    lat: 17.233,
    lng: -89.6112,
    elevationBand: "baja",
    observedAt: "2025-05-02",
    protectedArea: true
  },
  {
    id: "occ-010",
    speciesId: "papilio-polyxenes",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 15.9045,
    lng: -90.6701,
    elevationBand: "media",
    observedAt: "2025-05-16",
    protectedArea: true
  },
  {
    id: "occ-011",
    speciesId: "papilio-polyxenes",
    areaId: "sierra-de-las-minas",
    departmentSlug: "izabal",
    sourceId: "inaturalist",
    visibility: "generalized_public",
    lat: 15.2712,
    lng: -89.7542,
    elevationBand: "alta",
    observedAt: "2025-05-25",
    protectedArea: true
  },
  {
    id: "occ-012",
    speciesId: "guacamaya-roja",
    areaId: "tikal",
    departmentSlug: "peten",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 17.142,
    lng: -89.451,
    elevationBand: "baja",
    observedAt: "2025-04-27",
    protectedArea: true
  },
  {
    id: "occ-013",
    speciesId: "guacamaya-roja",
    areaId: "chocon-machacas",
    departmentSlug: "izabal",
    sourceId: "gbif",
    visibility: "generalized_public",
    lat: 15.684,
    lng: -88.881,
    elevationBand: "baja",
    observedAt: "2024-08-19",
    protectedArea: true
  },
  {
    id: "occ-014",
    speciesId: "ceiba-pentandra",
    areaId: "tikal",
    departmentSlug: "peten",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 17.308,
    lng: -89.714,
    elevationBand: "baja",
    observedAt: "2025-02-11",
    protectedArea: true
  },
  {
    id: "occ-015",
    speciesId: "ceiba-pentandra",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "gbif",
    visibility: "generalized_public",
    lat: 15.842,
    lng: -90.824,
    elevationBand: "media",
    observedAt: "2024-10-03",
    protectedArea: true
  },
  {
    id: "occ-016",
    speciesId: "ceiba-pentandra",
    areaId: "chocon-machacas",
    departmentSlug: "izabal",
    sourceId: "biodiversidad-gt",
    visibility: "generalized_public",
    lat: 15.908,
    lng: -88.742,
    elevationBand: "baja",
    observedAt: "2025-01-21",
    protectedArea: true
  },
  {
    id: "occ-017",
    speciesId: "tapirus-bairdii",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "biodiversidad-gt",
    visibility: "internal_exact",
    lat: 15.966,
    lng: -90.54,
    elevationBand: "media",
    observedAt: "2024-12-16",
    protectedArea: true
  },
  {
    id: "occ-018",
    speciesId: "tapirus-bairdii",
    areaId: "sierra-de-las-minas",
    departmentSlug: "izabal",
    sourceId: "gbif",
    visibility: "internal_exact",
    lat: 15.603,
    lng: -89.314,
    elevationBand: "alta",
    observedAt: "2025-03-03",
    protectedArea: true
  },
  {
    id: "occ-019",
    speciesId: "tapirus-bairdii",
    areaId: "laguna-lachua",
    departmentSlug: "alta-verapaz",
    sourceId: "gbif",
    visibility: "generalized_public",
    lat: 15.734,
    lng: -90.922,
    elevationBand: "media",
    observedAt: "2025-02-22",
    protectedArea: true
  }
];

export const areaGeometry: Record<string, MapFeature> = {
  country: rectangle(-92.3, 13.7, -88.0, 17.9, {
    id: "country",
    label: "Guatemala",
    kind: "country",
    speciesCount: 912
  }),
  "dept-peten": rectangle(-91.8, 16.3, -89.0, 17.9, {
    id: "peten",
    label: "Petén",
    kind: "department",
    speciesCount: 384
  }),
  "dept-alta-verapaz": rectangle(-91.3, 15.3, -89.7, 16.5, {
    id: "alta-verapaz",
    label: "Alta Verapaz",
    kind: "department",
    speciesCount: 291
  }),
  "dept-izabal": rectangle(-89.9, 15.0, -88.2, 16.3, {
    id: "izabal",
    label: "Izabal",
    kind: "department",
    speciesCount: 256
  }),
  "pa-tikal": rectangle(-89.76, 17.14, -89.45, 17.34, {
    id: "tikal",
    label: "Tikal",
    kind: "protected_area",
    speciesCount: 198
  }),
  "pa-lachua": rectangle(-90.77, 15.82, -90.55, 15.97, {
    id: "laguna-lachua",
    label: "Laguna Lachuá",
    kind: "protected_area",
    speciesCount: 164
  }),
  "pa-sierra": rectangle(-90.1, 15.12, -89.37, 15.62, {
    id: "sierra-de-las-minas",
    label: "Sierra de las Minas",
    kind: "protected_area",
    speciesCount: 219
  }),
  "pa-chocon": rectangle(-89.08, 15.66, -88.83, 15.84, {
    id: "chocon-machacas",
    label: "Chocón Machacas",
    kind: "protected_area",
    speciesCount: 142
  })
};

const roundCell = (value: number): number => Math.round(value * 4) / 4;

export const buildPublicHexId = (lng: number, lat: number): string =>
  `hex:${roundCell(lng).toFixed(2)}:${roundCell(lat).toFixed(2)}`;

const cellPolygon = (centerLng: number, centerLat: number, width = 0.18): MapFeature => {
  const half = width / 2;
  return rectangle(centerLng - half, centerLat - half, centerLng + half, centerLat + half, {
    kind: "public_hex",
    label: "Celda pública"
  });
};

export const buildPublicHexCollection = (
  occurrences: InternalOccurrence[] = internalOccurrences
): MapFeatureCollection => {
  const buckets = new Map<
    string,
    {
      lat: number;
      lng: number;
      speciesIds: Set<string>;
      sourceIds: Set<string>;
      protectedCount: number;
      occurrenceCount: number;
    }
  >();

  for (const occurrence of occurrences) {
    const lat = roundCell(occurrence.lat);
    const lng = roundCell(occurrence.lng);
    const key = `${lat}:${lng}`;
    const current = buckets.get(key) ?? {
      lat,
      lng,
      speciesIds: new Set<string>(),
      sourceIds: new Set<string>(),
      protectedCount: 0,
      occurrenceCount: 0
    };
    current.speciesIds.add(occurrence.speciesId);
    current.sourceIds.add(occurrence.sourceId);
    current.occurrenceCount += 1;
    if (occurrence.protectedArea) {
      current.protectedCount += 1;
    }
    buckets.set(key, current);
  }

  return {
    type: "FeatureCollection",
    features: Array.from(buckets.values()).map((bucket) => {
      const feature = cellPolygon(bucket.lng, bucket.lat);
      const id = buildPublicHexId(bucket.lng, bucket.lat);
      feature.id = id;
      feature.properties = {
        ...feature.properties,
        id,
        speciesCount: bucket.speciesIds.size,
        protectedCount: bucket.protectedCount,
        occurrenceCount: bucket.occurrenceCount,
        visibility: "generalized_public",
        sourceCount: bucket.sourceIds.size,
        centerLng: bucket.lng,
        centerLat: bucket.lat,
        biodiversityLabel:
          bucket.speciesIds.size >= 4
            ? "Pulso biodiverso alto"
            : bucket.speciesIds.size >= 2
              ? "Pulso biodiverso medio"
              : "Pulso biodiverso localizado"
      };
      return feature;
    })
  };
};

export const departmentCollection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    areaGeometry["dept-peten"],
    areaGeometry["dept-alta-verapaz"],
    areaGeometry["dept-izabal"]
  ]
};

export const protectedAreaCollection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    areaGeometry["pa-tikal"],
    areaGeometry["pa-lachua"],
    areaGeometry["pa-sierra"],
    areaGeometry["pa-chocon"]
  ]
};

export const searchIndex = (): SearchResult[] => [
  ...areas.map((area) => ({
    id: area.id,
    slug: area.slug,
    type: "area" as const,
    title: area.name,
    subtitle: area.summary,
    href: area.kind === "protected_area" || area.kind === "department" || area.kind === "country"
      ? `/areas/${area.slug}`
      : "/map"
  })),
  ...species.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    type: "species" as const,
    title: entry.commonName,
    subtitle: entry.scientificName,
    href: `/species/${entry.slug}`
  })),
  ...sources.map((source) => ({
    id: source.id,
    slug: source.slug,
    type: "source" as const,
    title: source.name,
    subtitle: source.description,
    href: "/sources"
  }))
];
