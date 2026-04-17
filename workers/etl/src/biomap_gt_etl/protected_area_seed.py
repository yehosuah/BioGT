from __future__ import annotations


PROTECTED_AREA_SEED: list[dict[str, object]] = [
    {
        "slug": "tikal",
        "name": "Parque Nacional Tikal",
        "department": "Petén",
        "summary": (
            "Área protegida ancla del norte. Mantiene la transición de mapa departamental "
            "a lectura detallada de especies y cobertura pública."
        ),
        "wdpa_id": None,
        "geometry_external_key": "pa-tikal",
        "geometry_label": "Tikal",
        "source_ids": ["biodiversidad-gt", "wdpa"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-89.76, 17.14],
                [-89.45, 17.14],
                [-89.45, 17.34],
                [-89.76, 17.34],
                [-89.76, 17.14],
            ]],
        },
    },
    {
        "slug": "laguna-lachua",
        "name": "Parque Nacional Laguna Lachuá",
        "department": "Alta Verapaz",
        "summary": (
            "Humedal kárstico y selva húmeda usados en la primera iteración pública del atlas "
            "para navegación protegida de media escala."
        ),
        "wdpa_id": None,
        "geometry_external_key": "pa-lachua",
        "geometry_label": "Laguna Lachuá",
        "source_ids": ["biodiversidad-gt", "wdpa"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-90.77, 15.82],
                [-90.55, 15.82],
                [-90.55, 15.97],
                [-90.77, 15.97],
                [-90.77, 15.82],
            ]],
        },
    },
    {
        "slug": "sierra-de-las-minas",
        "name": "Reserva de Biosfera Sierra de las Minas",
        "department": "Izabal",
        "summary": (
            "Reserva priorizada en el mapa intermedio por su conectividad altitudinal y su valor "
            "para lectura pública de presencia sensible."
        ),
        "wdpa_id": None,
        "geometry_external_key": "pa-sierra",
        "geometry_label": "Sierra de las Minas",
        "source_ids": ["biodiversidad-gt", "wdpa"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-90.1, 15.12],
                [-89.37, 15.12],
                [-89.37, 15.62],
                [-90.1, 15.62],
                [-90.1, 15.12],
            ]],
        },
    },
    {
        "slug": "chocon-machacas",
        "name": "Biotopo Chocón Machacas",
        "department": "Izabal",
        "summary": (
            "Biotopo caribeño conservado como subconjunto inicial de áreas protegidas en la "
            "primera carga nacional del atlas."
        ),
        "wdpa_id": None,
        "geometry_external_key": "pa-chocon",
        "geometry_label": "Chocón Machacas",
        "source_ids": ["biodiversidad-gt", "wdpa"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-89.08, 15.66],
                [-88.83, 15.66],
                [-88.83, 15.84],
                [-89.08, 15.84],
                [-89.08, 15.66],
            ]],
        },
    },
]
