import { useMemo } from "react";
import * as THREE from "three";
import { registerBuildings } from "./buildingRegistry";

// --- Textures générées en code, une seule fois, partagées entre tous les bâtiments ---
function makeFacadeTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#a89f92";
  ctx.fillRect(0, 0, size, size);
  const cols = 4,
    rows = 5;
  const cw = size / cols,
    ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const padX = cw * 0.15,
        padY = ch * 0.18;
      const shade = 20 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      ctx.fillRect(c * cw + padX, r * ch + padY, cw - 2 * padX, ch - 2 * padY);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeRoofTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#7d766c";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    const shade = 90 + Math.random() * 45;
    ctx.fillStyle = `rgba(${shade}, ${shade - 5}, ${shade - 15}, 0.18)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * size,
      Math.random() * size,
      1.5 + Math.random() * 6,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeGroundTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8c8474";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const shade = 120 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 20}, 0.08)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * size,
      Math.random() * size,
      1 + Math.random() * 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ville fictive générée proceduralement : grille de blocs séparés par des routes,
 * un bâtiment par bloc (footprint/hauteur variables, quelques lots vides pour l'organique).
 * Génération 100% locale, synchrone, aucune dépendance réseau — fiable à 100%.
 *
 * rows/cols : nombre de blocs. blockSize : taille d'un bloc (m). roadWidth : largeur des routes (m).
 */
export function ProceduralCity({
  rows = 6,
  cols = 6,
  blockSize = 30,
  roadWidth = 7,
  seed = 1,
}) {
  const city = useMemo(() => {
    // petit générateur pseudo-aléatoire à seed fixe, pour un résultat reproductible entre rechargements
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const cellPitch = blockSize + roadWidth;
    const totalSize = cols * cellPitch + roadWidth;
    const originX = -totalSize / 2;
    const originZ = -totalSize / 2;

    const buildings = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.15) continue; // ~15% de lots vides pour casser la grille trop parfaite

        const blockCx = originX + roadWidth + c * cellPitch + blockSize / 2;
        const blockCz = originZ + roadWidth + r * cellPitch + blockSize / 2;

        const margin = 2 + rand() * 3;
        const w = blockSize - margin * 2 * (0.8 + rand() * 0.4);
        const d = blockSize - margin * 2 * (0.8 + rand() * 0.4);
        const height = 6 + rand() * 16;
        const jitterX = (rand() - 0.5) * 3;
        const jitterZ = (rand() - 0.5) * 3;

        buildings.push({
          cx: blockCx + jitterX,
          cz: blockCz + jitterZ,
          width: w,
          depth: d,
          height,
        });
      }
    }

    return { buildings, totalSize };
  }, [rows, cols, blockSize, roadWidth, seed]);

  // Collisions : enregistré une seule fois à la génération (synchrone, pas de course possible)
  useMemo(() => {
    registerBuildings(
      city.buildings.map((b) => ({
        minX: b.cx - b.width / 2,
        maxX: b.cx + b.width / 2,
        minZ: b.cz - b.depth / 2,
        maxZ: b.cz + b.depth / 2,
        maxY: b.height,
      }))
    );
  }, [city]);

  const facadeTex = useMemo(() => makeFacadeTexture(), []);
  const roofTex = useMemo(() => makeRoofTexture(), []);
  const groundTex = useMemo(() => {
    const tex = makeGroundTexture();
    tex.repeat.set(city.totalSize / 20, city.totalSize / 20);
    return tex;
  }, [city.totalSize]);

  return (
    <group>
      {/* Sol de base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[city.totalSize, city.totalSize]} />
        <meshStandardMaterial map={groundTex} roughness={1} />
      </mesh>

      {/* Routes : simples bandes sombres superposées au sol, sur chaque ligne de grille */}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <mesh
          key={`road-h-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            0,
            0.01,
            -city.totalSize / 2 + i * (blockSize + roadWidth) + roadWidth / 2,
          ]}
        >
          <planeGeometry args={[city.totalSize, roadWidth]} />
          <meshStandardMaterial color="#3a3a3a" roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: cols + 1 }).map((_, i) => (
        <mesh
          key={`road-v-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            -city.totalSize / 2 + i * (blockSize + roadWidth) + roadWidth / 2,
            0.011,
            0,
          ]}
        >
          <planeGeometry args={[roadWidth, city.totalSize]} />
          <meshStandardMaterial color="#3a3a3a" roughness={1} />
        </mesh>
      ))}

      {/* Bâtiments */}
      {city.buildings.map((b, i) => (
        <Building key={i} data={b} facadeTex={facadeTex} roofTex={roofTex} />
      ))}
    </group>
  );
}

function Building({ data, facadeTex, roofTex }) {
  const { cx, cz, width, depth, height } = data;

  const wallTex = useMemo(() => {
    const t = facadeTex.clone();
    t.needsUpdate = true;
    const perimeter = 2 * (width + depth);
    t.repeat.set(
      THREE.MathUtils.clamp(Math.round(perimeter / 8), 2, 5),
      THREE.MathUtils.clamp(Math.round(height / 4), 1, 3)
    );
    return t;
  }, [facadeTex, width, depth, height]);

  const roofTexClone = useMemo(() => {
    const t = roofTex.clone();
    t.needsUpdate = true;
    t.repeat.set(2, 2);
    return t;
  }, [roofTex]);

  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial map={wallTex} roughness={0.9} />
      </mesh>
      <mesh position={[0, height + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={roofTexClone} roughness={1} />
      </mesh>
    </group>
  );
}
