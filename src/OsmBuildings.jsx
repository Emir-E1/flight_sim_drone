import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

// Convertit un point lat/lon en position locale (mètres) relative à un centre — approximation
// plate valide pour de petites zones, cohérente avec SatelliteGround.jsx.
function lonLatToLocalMeters(lon, lat, centerLon, centerLat) {
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  return {
    x: (lon - centerLon) * metersPerDegLon,
    z: (lat - centerLat) * metersPerDegLat,
  };
}

function polygonPerimeter(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].z - points[i].z
    );
  }
  return total;
}

// --- Texture générée en code (canvas), aucun fichier à télécharger ---
// Mise en cache : générée une seule fois, réutilisée (clonée) par tous les bâtiments.
let cachedFacadeTexture = null;
function getFacadeTexture() {
  if (cachedFacadeTexture) return cachedFacadeTexture;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#a89f92";
  ctx.fillRect(0, 0, size, size);

  // Motif de fenêtres — contraste marqué pour rester lisible même à distance/en tuilage réduit
  const cols = 4,
    rows = 5;
  const cw = size / cols,
    ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const padX = cw * 0.15;
      const padY = ch * 0.18;
      const shade = 20 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      ctx.fillRect(c * cw + padX, r * ch + padY, cw - 2 * padX, ch - 2 * padY);
    }
  }

  cachedFacadeTexture = new THREE.CanvasTexture(canvas);
  cachedFacadeTexture.wrapS = cachedFacadeTexture.wrapT = THREE.RepeatWrapping;
  cachedFacadeTexture.needsUpdate = true;
  return cachedFacadeTexture;
}

/**
 * Récupère les vrais bâtiments OpenStreetMap (gratuit, sans clé, sans compte) autour d'un point,
 * et les extrude en volumes 3D texturés, alignés sur le même sol satellite (mêmes lat/lon).
 */
export function OsmBuildings({
  lat = 48.8566,
  lon = 2.3522,
  radiusMeters = 300,
}) {
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const dLat = radiusMeters / 111320;
    const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
    const south = lat - dLat,
      north = lat + dLat;
    const west = lon - dLon,
      east = lon + dLon;

    const query = `[out:json][timeout:25];way["building"](${south},${west},${north},${east});out geom;`;

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const parsed = (data.elements || [])
          .filter((el) => el.geometry && el.geometry.length >= 3)
          .map((el) => {
            const points = el.geometry.map((p) =>
              lonLatToLocalMeters(p.lon, p.lat, lon, lat)
            );
            const tags = el.tags || {};
            const height = tags.height
              ? parseFloat(tags.height)
              : tags["building:levels"]
              ? parseFloat(tags["building:levels"]) * 3
              : 6 + Math.random() * 9;
            return { points, height };
          });
        setBuildings(parsed);
      })
      .catch(() => {
        if (!cancelled) setBuildings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon, radiusMeters]);

  return (
    <group>
      {buildings.map((b, i) => (
        <BuildingMesh key={i} points={b.points} height={b.height} />
      ))}
    </group>
  );
}

function BuildingMesh({ points, height }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [points, height]);

  // Un seul matériau pour tout le bâtiment (murs + toit) — évite le problème d'ordre des
  // groupes de ExtrudeGeometry qui empêchait le rendu correct avec un tableau de matériaux.
  const material = useMemo(() => {
    const perimeter = polygonPerimeter(points);
    const tex = getFacadeTexture().clone();
    tex.needsUpdate = true;
    // Borné entre 2 et 5 : évite qu'un grand bâtiment ait un tiling trop fin qui redevient flou/gris à distance
    const repeatX = THREE.MathUtils.clamp(Math.round(perimeter / 8), 2, 5);
    const repeatY = THREE.MathUtils.clamp(Math.round(height / 4), 1, 3);
    tex.repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  }, [points, height]);

  return <mesh geometry={geometry} material={material} />;
}
