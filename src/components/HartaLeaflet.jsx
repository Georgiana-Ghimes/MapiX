import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { extragePoligoane } from '@/lib/reguliTaxe';

export const CULORI_ZONA = {
  'Taxată': { culoare: '#2563eb', umplere: '#3b82f6' },
  'Restricționată': { culoare: '#d97706', umplere: '#f59e0b' },
  'Interzisă': { culoare: '#dc2626', umplere: '#ef4444' },
  'Reglementată': { culoare: '#475569', umplere: '#64748b' },
  'Informativă': { culoare: '#0e7490', umplere: '#06b6d4' },
};

function inverseaza(coordonate) {
  return coordonate.map(([lng, lat]) => [lat, lng]);
}

export default function HartaLeaflet({
  localitati = [],
  zone = [],
  centru = [44.45, 26.1],
  zoom = 11,
  onSelectZona,
  onSelectLocalitate,
}) {
  const puncte = useMemo(
    () => localitati.filter((l) => typeof l.latitudine === 'number' && typeof l.longitudine === 'number'),
    [localitati]
  );

  const poligoane = useMemo(() => {
    const lista = [];
    zone.forEach((z) => {
      const geometrii = extragePoligoane(z.geometrie_geojson);
      geometrii.forEach((g, index) => {
        lista.push({ zona: z, cheie: `${z.id}-${index}`, pozitii: inverseaza(g.coordinates[0] || []) });
      });
    });
    return lista.filter((p) => p.pozitii.length >= 3);
  }, [zone]);

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 lg:h-[620px]">
      <MapContainer key={`${centru[0]}-${centru[1]}`} center={centru} zoom={zoom} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {poligoane.map(({ zona, cheie, pozitii }) => {
          const stil = CULORI_ZONA[zona.tip_zona] || CULORI_ZONA.Reglementată;
          const neverificata = zona.status_geometrie !== 'Confirmată';
          return (
            <Polygon
              key={cheie}
              positions={pozitii}
              pathOptions={{
                color: stil.culoare,
                fillColor: stil.umplere,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: neverificata ? '6 4' : undefined,
              }}
              eventHandlers={{ click: () => onSelectZona?.(zona) }}
            >
              <Tooltip sticky>
                {zona.nume_zona} · {zona.tip_zona}
                {neverificata ? ' · geometrie neverificată' : ''}
              </Tooltip>
            </Polygon>
          );
        })}
        {puncte.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.latitudine, l.longitudine]}
            radius={7}
            pathOptions={{ color: '#1e3a8a', fillColor: '#1d4ed8', fillOpacity: 0.85, weight: 2 }}
            eventHandlers={{ click: () => onSelectLocalitate?.(l) }}
          >
            <Tooltip>{l.nume}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}