import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { registerBuildings } from "./buildingRegistry";

const MIN_COLLIDABLE_SIZE = 2; // en mètres — ignore les petits objets (fenêtres, lampes...) pour la collision

/**
 * Charge la ville exportée depuis Blender (public/models/city.glb) et calcule
 * automatiquement les boîtes de collision de chaque objet assez grand (bâtiments).
 * Pas besoin de connaître les noms des objets à l'avance : on parcourt tout le modèle.
 */
export function CityModel({ url = "/models/city.glb", scale = 1 }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.scale.setScalar(scale);
    scene.updateMatrixWorld(true);

    const boxes = [];
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim < MIN_COLLIDABLE_SIZE) return; // trop petit -> pas un bâtiment, on ignore

      boxes.push({
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z,
        maxY: box.max.y,
      });
    });

    console.log(
      `[CityModel] ${boxes.length} objets enregistrés pour les collisions (sur un total parcouru)`
    );
    registerBuildings(boxes);

    return () => registerBuildings([]);
  }, [scene, scale]);

  return <primitive object={scene} />;
}

useGLTF.preload("/models/city.glb");
