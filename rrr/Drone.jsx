import { forwardRef, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useKeyboardControls } from "../src/useKeyboardControls";

const DEFAULT_MOVE_SPEED = 8;
const MIN_SPEED = 0; // Vitesse à 0 autorisée pour le mode stationnaire
const MAX_SPEED = 20;
const SPEED_STEP = 2;

const YAW_SPEED = 1.8; // Vitesse de rotation sur soi-même avec les flèches

const MAX_TILT = 0.5;
const TILT_EASE = 6;

const ARM_POSITIONS = [
  { x: 1.1, z: 1.1, front: true },
  { x: -1.1, z: 1.1, front: true },
  { x: 1.1, z: -1.1, front: false },
  { x: -1.1, z: -1.1, front: false },
];

export const Drone = forwardRef(function Drone(props, ref) {
  const keys = useKeyboardControls();

  const innerRef = useRef();
  const rotorRefs = useRef([]);
  const controlsRef = useRef();

  const pitchState = useRef(0);
  const rollState = useRef(0);
  const currentSpeed = useRef(DEFAULT_MOVE_SPEED);
  const speedChangeCooldown = useRef(0);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  const prevDronePosition = useRef(null);

  useEffect(() => {
    if (ref?.current) {
      ref.current.userData.tiltGroup = innerRef.current;
    }
  }, [ref]);

  useFrame((_, dt) => {
    const drone = ref?.current;
    const tilt = innerRef.current;

    if (!drone || !tilt) return;

    if (!prevDronePosition.current) {
      prevDronePosition.current = drone.position.clone();
      if (controlsRef.current) {
        controlsRef.current.target.copy(drone.position);
      }
    }

    const k = keys.current;

    // =========================================================
    // GESTION DE LA VITESSE (+ / -)
    // =========================================================
    if (speedChangeCooldown.current > 0) {
      speedChangeCooldown.current -= dt;
    }

    if (speedChangeCooldown.current <= 0) {
      if (k["NumpadAdd"] || k["Equal"]) {
        currentSpeed.current = Math.min(
          MAX_SPEED,
          currentSpeed.current + SPEED_STEP
        );
        speedChangeCooldown.current = 0.2;
      }
      if (k["NumpadSubtract"] || k["Minus"]) {
        currentSpeed.current = Math.max(
          MIN_SPEED,
          currentSpeed.current - SPEED_STEP
        );
        speedChangeCooldown.current = 0.2;
      }
    }

    const yaw = drone.rotation.y;
    const speed = currentSpeed.current;

    forward.current.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.current.set(Math.cos(yaw), 0, -Math.sin(yaw));

    // =========================================================
    // COMPORTEMENT SELON LA VITESSE (0 = Rotation sur soi / >0 = Déplacement)
    // =========================================================
    if (speed === 0) {
      // Vitesse à 0 : Les flèches Gauche / Droite font tourner le drone sur lui-même (360°)
      if (k["ArrowLeft"]) {
        drone.rotation.y += YAW_SPEED * dt;
      }
      if (k["ArrowRight"]) {
        drone.rotation.y -= YAW_SPEED * dt;
      }
    } else {
      // Vitesse > 0 : Déplacement normal avec les flèches
      moveDirection.current.set(0, 0, 0);

      if (k["ArrowUp"]) moveDirection.current.add(forward.current);
      if (k["ArrowDown"]) moveDirection.current.sub(forward.current);
      if (k["ArrowLeft"]) moveDirection.current.sub(right.current);
      if (k["ArrowRight"]) moveDirection.current.add(right.current);

      if (moveDirection.current.lengthSq() > 0) {
        moveDirection.current.normalize();

        drone.position.x += moveDirection.current.x * speed * dt;
        drone.position.z += moveDirection.current.z * speed * dt;

        if (!k["ArrowDown"] || k["ArrowLeft"] || k["ArrowRight"]) {
          let targetYaw = Math.atan2(
            -moveDirection.current.x,
            -moveDirection.current.z
          );
          let diff = targetYaw - drone.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          drone.rotation.y += diff * Math.min(1, YAW_SPEED * dt);
        }
      }
    }

    // =========================================================
    // ALTITUDE
    // =========================================================
    if (k["Space"]) {
      drone.position.y += Math.max(DEFAULT_MOVE_SPEED, speed) * dt;
    }
    if (k["ShiftLeft"]) {
      drone.position.y -= Math.max(DEFAULT_MOVE_SPEED, speed) * dt;
    }

    drone.position.y = Math.max(0.6, drone.position.y);

    // =========================================================
    // TILT VISUEL
    // =========================================================
    let targetPitch = 0;
    if (k["KeyZ"]) targetPitch += MAX_TILT;
    if (k["KeyS"]) targetPitch -= MAX_TILT;
    if (k["ArrowUp"]) targetPitch -= MAX_TILT;
    if (k["ArrowDown"]) targetPitch += MAX_TILT;
    targetPitch = THREE.MathUtils.clamp(targetPitch, -MAX_TILT, MAX_TILT);

    let targetRoll = 0;
    if (k["KeyA"]) targetRoll += MAX_TILT;
    if (k["KeyE"]) targetRoll -= MAX_TILT;
    // Le roll visuel ne s'applique que si on est en mouvement (vitesse > 0)
    if (speed > 0) {
      if (k["ArrowLeft"]) targetRoll += MAX_TILT;
      if (k["ArrowRight"]) targetRoll -= MAX_TILT;
    }
    targetRoll = THREE.MathUtils.clamp(targetRoll, -MAX_TILT, MAX_TILT);

    const ease = 1 - Math.exp(-TILT_EASE * dt);

    pitchState.current = THREE.MathUtils.lerp(
      pitchState.current,
      targetPitch,
      ease
    );
    rollState.current = THREE.MathUtils.lerp(
      rollState.current,
      targetRoll,
      ease
    );

    tilt.rotation.set(pitchState.current, 0, rollState.current);

    // =========================================================
    // ROTORS
    // =========================================================
    rotorRefs.current.forEach((rotor) => {
      if (rotor) {
        // Les rotors tournent plus vite si la vitesse augmente
        rotor.rotation.y += dt * (25 + speed * 2);
      }
    });

    // =========================================================
    // GESTION FLUIDE DE LA CAMÉRA (ORBIT CONTROLS)
    // =========================================================
    if (controlsRef.current && prevDronePosition.current) {
      const deltaPos = new THREE.Vector3().subVectors(
        drone.position,
        prevDronePosition.current
      );

      controlsRef.current.target.add(deltaPos);
      controlsRef.current.object.position.add(deltaPos);

      controlsRef.current.update();
    }

    if (prevDronePosition.current) {
      prevDronePosition.current.copy(drone.position);
    }
  });

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableRotate={true}
        enableZoom={true}
        enablePan={false}
        mouseButtons={{
          LEFT: null,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: null,
        }}
      />

      <group ref={ref} position={[0, 5, 0]} {...props}>
        <group ref={innerRef}>
          {/* Corps */}
          <mesh>
            <boxGeometry args={[1.4, 0.35, 1.4]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>

          {/* Bras + rotors */}
          {ARM_POSITIONS.map((p, i) => {
            const angle = Math.atan2(p.x, p.z);

            return (
              <group key={i}>
                <mesh
                  position={[p.x * 0.55, 0, p.z * 0.55]}
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.12, 0.12, 1.3]} />
                  <meshStandardMaterial color="#555b66" />
                </mesh>

                <mesh
                  ref={(el) => {
                    rotorRefs.current[i] = el;
                  }}
                  position={[p.x, 0.12, p.z]}
                >
                  <cylinderGeometry args={[0.42, 0.42, 0.05, 16]} />
                  <meshStandardMaterial
                    color={p.front ? "#ff4d4d" : "#111318"}
                    emissive={p.front ? "#330000" : "#000000"}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </>
  );
});
