type MapControlsProps = {
  mapReady: boolean;
  loading: boolean;
  statusLabel?: string | null;
  filtersActive?: boolean;
  legendActive?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onToggleFilters: () => void;
  onToggleLegend: () => void;
};

export function MapControls({
  mapReady,
  loading,
  statusLabel,
  filtersActive = false,
  legendActive = false,
  onZoomIn,
  onZoomOut,
  onRecenter,
  onToggleFilters,
  onToggleLegend
}: MapControlsProps) {
  return (
    <div className="atlas-map-controls">
      <div className="atlas-map-control-group">
        <button
          aria-label="Abrir filtros y capas"
          aria-pressed={filtersActive}
          onClick={onToggleFilters}
          type="button"
        >
          Filtros
        </button>
        <button
          aria-label="Abrir leyenda"
          aria-pressed={legendActive}
          onClick={onToggleLegend}
          type="button"
        >
          Leyenda
        </button>
      </div>

      <div className="atlas-map-control-group atlas-map-control-group-compact">
        <button aria-label="Acercar mapa" disabled={!mapReady} onClick={onZoomIn} type="button">
          +
        </button>
        <button aria-label="Alejar mapa" disabled={!mapReady} onClick={onZoomOut} type="button">
          −
        </button>
        <button aria-label="Volver a vista inicial" disabled={!mapReady} onClick={onRecenter} type="button">
          Centro
        </button>
      </div>

      {loading || statusLabel ? (
        <div aria-live="polite" className="atlas-map-controls-status">
          {loading ? "Actualizando capas…" : statusLabel}
        </div>
      ) : null}
    </div>
  );
}
