import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Drone } from "./Drone";

// Composant invisible pour capturer la vue depuis la position du drone vers le bas
function SatelliteCapture({ target, triggerRef }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    triggerRef.current = () => {
      const drone = target.current;
      if (!drone) return;

      // 1. Sauvegarde de la position et de l'orientation actuelles du renderer/caméra principale si besoin
      // 2. Création d'une caméra temporaire positionnée sur le drone et orientée vers le bas (-Y)
      const captureCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      captureCamera.position.copy(drone.position);

      // Oriente la caméra strictement vers le bas
      captureCamera.up.set(0, 0, -1);
      captureCamera.lookAt(
        drone.position.x,
        drone.position.y - 10,
        drone.position.z
      );

      // 3. Force le rendu de la scène avec cette caméra zénithale
      gl.render(scene, captureCamera);

      // 4. Récupération de l'image sous forme de Data URL
      const dataUrl = gl.domElement.toDataURL("image/png");

      // 5. Déclenchement du téléchargement (équivalent de l'enregistrement)
      const link = document.createElement("a");
      link.download = `drone_sat_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      // Note : Le canvas principal se rafraîchira automatiquement à la frame suivante avec la caméra normale.
    };
  }, [gl, scene, target, triggerRef]);

  return null;
}

// Caméra 3e personne : suit position + CAP (yaw) du drone
function ChaseCamera({ target }) {
  useFrame(({ camera }, dt) => {
    const drone = target.current;
    if (!drone) return;
    const offset = new THREE.Vector3(0, 3.2, 8).applyQuaternion(
      drone.quaternion
    );
    const desired = drone.position.clone().add(offset);
    camera.position.lerp(desired, 1 - Math.pow(0.0005, dt));
    camera.lookAt(drone.position);
  });
  return null;
}

// Met à jour le HUD (DOM hors Canvas) sans re-render React à 60fps
function HudUpdater({ target, refs }) {
  useFrame(() => {
    const drone = target.current;
    if (!drone) return;
    const tiltGroup = drone.userData.tiltGroup;
    const yaw = new THREE.Euler().setFromQuaternion(drone.quaternion, "YXZ").y;
    const pitch = tiltGroup ? tiltGroup.rotation.x : 0;
    const roll = tiltGroup ? tiltGroup.rotation.z : 0;

    if (refs.px.current)
      refs.px.current.textContent = drone.position.x.toFixed(1);
    if (refs.py.current)
      refs.py.current.textContent = drone.position.y.toFixed(1);
    if (refs.pz.current)
      refs.pz.current.textContent = drone.position.z.toFixed(1);
    if (refs.rp.current)
      refs.rp.current.textContent = THREE.MathUtils.radToDeg(pitch).toFixed(0);
    if (refs.ry.current)
      refs.ry.current.textContent = THREE.MathUtils.radToDeg(yaw).toFixed(0);
    if (refs.rr.current)
      refs.rr.current.textContent = THREE.MathUtils.radToDeg(roll).toFixed(0);
  });
  return null;
}

export default function DroneSimScene() {
  const droneRef = useRef();
  const captureTriggerRef = useRef(null);

  const hudRefs = {
    px: useRef(),
    py: useRef(),
    pz: useRef(),
    rp: useRef(),
    ry: useRef(),
    rr: useRef(),
  };

  const handleTakeSnapshot = () => {
    if (captureTriggerRef.current) {
      captureTriggerRef.current();
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#bfe3f7" }}>
      <Canvas camera={{ position: [0, 6, 14], fov: 65 }}>
        <fog attach="fog" args={["#bfe3f7", 80, 260]} />

        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#bfe3f7", "#4a6b4f", 0.8]} />
        <directionalLight position={[30, 50, 20]} intensity={1.3} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#5f9463" />
        </mesh>
        <gridHelper args={[400, 80, "#ffffff", "#88b98a"]} />

        <Drone ref={droneRef} />
        <ChaseCamera target={droneRef} />
        <HudUpdater target={droneRef} refs={hudRefs} />
        <SatelliteCapture target={droneRef} triggerRef={captureTriggerRef} />
      </Canvas>

      <div style={hudWrapStyle}>
        <div style={hudBoxStyle}>
          Position — X: <b ref={hudRefs.px}>0.0</b> Y:{" "}
          <b ref={hudRefs.py}>0.0</b> Z: <b ref={hudRefs.pz}>0.0</b>
        </div>
        <div style={hudBoxStyle}>
          Cap/Tilt° — Pitch: <b ref={hudRefs.rp}>0</b> Yaw:{" "}
          <b ref={hudRefs.ry}>0</b> Roll: <b ref={hudRefs.rr}>0</b>
        </div>
      </div>

      {/* Bouton de capture photo satellite */}
      <div style={buttonContainerStyle}>
        <button style={snapshotBtnStyle} onClick={handleTakeSnapshot}>
          📸 Prendre une photo satellite
        </button>
      </div>

      <div style={legendStyle}>
        Translation (à plat, toujours horizontale) : <b>↑/↓</b> avant-arrière ·{" "}
        <b>←/→</b> strafe ou rotation (si vitesse = 0) · <b>Espace/Maj</b>{" "}
        monter-descendre
        <br />
        Vitesse : touches <b>+ / -</b> du pavé numérique (ou <b>= / -</b>)
      </div>
    </div>
  );
}

const hudWrapStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  padding: "12px 14px",
  pointerEvents: "none",
  color: "#1c2a22",
  fontFamily: "sans-serif",
  fontSize: 13,
  textShadow: "0 1px 2px rgba(255,255,255,.6)",
};

const hudBoxStyle = {
  background: "rgba(255,255,255,.7)",
  border: "1px solid rgba(0,0,0,.12)",
  borderRadius: 10,
  padding: "8px 12px",
  backdropFilter: "blur(6px)",
  pointerEvents: "auto",
};

const buttonContainerStyle = {
  position: "fixed",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
};

const snapshotBtnStyle = {
  background: "#2b2f36",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontFamily: "sans-serif",
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  transition: "background 0.2s",
};

const legendStyle = {
  position: "fixed",
  bottom: 14,
  left: 14,
  color: "#1c2a22",
  fontSize: 12,
  fontFamily: "sans-serif",
  background: "rgba(255,255,255,.7)",
  border: "1px solid rgba(0,0,0,.12)",
  borderRadius: 10,
  padding: "8px 12px",
  maxWidth: 480,
};
