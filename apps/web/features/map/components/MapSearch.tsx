import type { SearchResult } from "@/lib/types";

type MapSearchProps = {
  query: string;
  results: SearchResult[];
  loading?: boolean;
  className?: string;
  floating?: boolean;
  onQueryChange: (value: string) => void;
  onSelectResult: (result: SearchResult) => void;
};

const searchResultTypeLabels: Record<SearchResult["type"], string> = {
  species: "Especie",
  area: "Área",
  source: "Fuente"
};

export function MapSearch({
  query,
  results,
  loading = false,
  className = "atlas-search",
  floating = false,
  onQueryChange,
  onSelectResult
}: MapSearchProps) {
  const shouldShowResults = query.trim().length >= 2;

  return (
    <div className={`${className}${floating ? " atlas-search-floating" : ""}`}>
      <input
        aria-label="Buscar especie, área o fuente"
        data-testid="search-input"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar especie, área o fuente"
        type="search"
        value={query}
      />

      {shouldShowResults ? (
        <div className="atlas-search-results" role="listbox">
          {loading ? <span className="atlas-search-status">Buscando…</span> : null}

          {!loading && results.length === 0 ? (
            <span className="atlas-search-status" data-testid="search-empty">
              No hay resultados
            </span>
          ) : null}

          {!loading
            ? results.slice(0, 7).map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => onSelectResult(result)}
                  type="button"
                >
                  <strong>{result.title}</strong>
                  <span>
                    {searchResultTypeLabels[result.type]} · {result.subtitle}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
