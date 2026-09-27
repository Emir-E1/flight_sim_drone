import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

// --- Conversion lat/lon <-> tuile (schéma "slippy map" standard, utilisé par OSM/Esri/Google) ---
function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

// Résolution réelle (mètres/pixel) à une latitude et un niveau de zoom donnés (formule Web Mercator standard)
function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

const TILE_SIZE_PX = 256;
// Service Esri World Imagery — public, gratuit, sans clé API. Attribution obligatoire (cf. composant plus bas).
const esriTileUrl = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

/**
 * Sol texturé avec une vraie photo satellite (gratuit, sans compte, sans carte bancaire).
 * Par défaut centré sur Paris — change lat/lon pour survoler n'importe quelle zone du monde.
 *
 * zoom recommandé : 17-18 pour une vue "quartier" (bon compromis netteté/couverture),
 * 19 pour du détail bâtiment mais couvre une zone plus petite.
 */
export function SatelliteGround({
  lat = 48.8566,
  lon = 2.3522,
  zoom = 18,
  gridSize = 5,
}) {
  const [texture, setTexture] = useState(null);

  const worldSizeMeters = useMemo(
    () => gridSize * TILE_SIZE_PX * metersPerPixel(lat, zoom),
    [lat, zoom, gridSize]
  );

  useEffect(() => {
    let cancelled = false;
    const center = lonLatToTile(lon, lat, zoom);
    const half = Math.floor(gridSize / 2);

    const canvas = document.createElement("canvas");
    canvas.width = gridSize * TILE_SIZE_PX;
    canvas.height = gridSize * TILE_SIZE_PX;
    const ctx = canvas.getContext("2d");

    const loads = [];
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = center.x + dx;
        const ty = center.y + dy;
        const px = (dx + half) * TILE_SIZE_PX;
        const py = (dy + half) * TILE_SIZE_PX;

        loads.push(
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              ctx.drawImage(img, px, py, TILE_SIZE_PX, TILE_SIZE_PX);
              resolve();
            };
            img.onerror = () => resolve(); // tuile indisponible -> on laisse un vide plutôt que de bloquer
            img.src = esriTileUrl(zoom, tx, ty);
          })
        );
      }
    }

    Promise.all(loads).then(() => {
      if (cancelled) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lon, zoom, gridSize]);

  if (!texture) return null; // rien tant que les tuiles ne sont pas chargées

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[worldSizeMeters, worldSizeMeters]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

// Attribution obligatoire selon les conditions d'utilisation d'Esri World Imagery — à afficher quelque part visible
export function SatelliteAttribution() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 6,
        right: 8,
        fontSize: 10,
        color: "#33413a",
        fontFamily: "sans-serif",
        background: "rgba(255,255,255,.6)",
        padding: "2px 6px",
        borderRadius: 4,
      }}
    >
      Imagery © Esri, Maxar, Earthstar Geographics
    </div>
  );
}
