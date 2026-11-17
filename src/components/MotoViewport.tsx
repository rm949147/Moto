import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MotoAudioEngine } from '../moto/audio';
import { buildMotorcycleRig, type MotorcycleRig } from '../moto/bikeBuilder';
import {
  applyBikeModsToSpec,
  DEFAULT_BIKE_MODS,
  getBikeById,
  type BikeId,
  type BikeMods,
} from '../moto/catalog';
import {
  createCrashTumble,
  createInitialRideState,
  evaluateTrafficInteraction,
  stepBikeRidePhysics,
  stepCrashTumble,
  type CrashTumbleState,
  type RideInput,
  type RidePhysicsState,
} from '../moto/physics';
import { createProceduralTextures } from '../moto/textures';
import { HighwayWorld } from '../moto/worldBuilder';

export type AppPhase = 'login' | 'garage' | 'playing' | 'paused' | 'gameover';
export type CameraViewMode = 'chase' | 'cockpit' | 'action';

export interface LiveHudMetrics {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  gear: number;
  nitroFuel: number;
  isNitroActive: boolean;
  integrity: number;
  distanceKm: number;
  score: number;
  nearMissCount: number;
  comboMultiplier: number;
  activeThrottle: boolean;
  activeBrake: boolean;
  activeNitro: boolean;
}

export interface CrashSummary {
  impactSpeedKmh: number;
  distanceKm: number;
  score: number;
  nearMissCount: number;
  cause: string;
}

interface MotoViewportProps {
  phase: AppPhase;
  selectedBikeId: BikeId;
  liveryIndex: number;
  mods?: BikeMods;
  cameraMode: CameraViewMode;
  showRiderInGarage?: boolean;
  rideSessionId: number;
  audio: MotoAudioEngine;
  touchInputRef: React.MutableRefObject<Partial<RideInput>>;
  onHudTick: (metrics: LiveHudMetrics) => void;
  onCrash: (summary: CrashSummary) => void;
  onNearMissEvent: (combo: number) => void;
}

let cachedSoftwareGl: boolean | null = null;

function detectSoftwareWebGLOnce(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = false;
      return false;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = false;
    return false;
  }
}

export default function MotoViewport({
  phase,
  selectedBikeId,
  liveryIndex,
  mods = DEFAULT_BIKE_MODS,
  cameraMode,
  showRiderInGarage = true,
  rideSessionId,
  audio,
  touchInputRef,
  onHudTick,
  onCrash,
  onNearMissEvent,
}: MotoViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store reactive props in refs so WebGLRenderer never tears down
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const bikeIdRef = useRef(selectedBikeId);
  bikeIdRef.current = selectedBikeId;

  const liveryIdxRef = useRef(liveryIndex);
  liveryIdxRef.current = liveryIndex;

  const modsRef = useRef(mods);
  modsRef.current = mods;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const showRiderInGarageRef = useRef(showRiderInGarage);
  showRiderInGarageRef.current = showRiderInGarage;

  const onHudTickRef = useRef(onHudTick);
  onHudTickRef.current = onHudTick;

  const onCrashRef = useRef(onCrash);
  onCrashRef.current = onCrash;

  const onNearMissRef = useRef(onNearMissEvent);
  onNearMissRef.current = onNearMissEvent;

  const sessionIdRef = useRef(rideSessionId);
  const needsBikeRebuildRef = useRef(false);
  const needsRideResetRef = useRef(false);
  const forceShowroomSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    needsBikeRebuildRef.current = true;
    forceShowroomSyncRef.current?.();
  }, [selectedBikeId, liveryIndex, mods, showRiderInGarage]);

  useEffect(() => {
    if (sessionIdRef.current !== rideSessionId) {
      sessionIdRef.current = rideSessionId;
      needsRideResetRef.current = true;
    }
  }, [rideSessionId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGLOnce();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'default',
      preserveDrawingBuffer: isSoftwareGl,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(
      container.clientWidth || window.innerWidth || 1280,
      container.clientHeight || window.innerHeight || 720,
    );
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    let contextLost = renderer.getContext().isContextLost();
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const handleContextRestored = () => {
      contextLost = false;
      needsBikeRebuildRef.current = true;
      if (!disposed) {
        lastTimeMs = performance.now();
        tick();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const highwayFogColor = new THREE.Color('#BDD3E6');
    const garageFogColor = new THREE.Color('#0B0E15');
    scene.background = garageFogColor;
    scene.fog = new THREE.FogExp2('#0B0E15', 0.022);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth || 1280) /
        (container.clientHeight || window.innerHeight || 720),
      0.12,
      500,
    );

    // Three-Point Warm/Cool Studio & Golden-Hour Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#D8ECFF', '#30392E', 0.96);
    scene.add(hemiLight);

    const keySun = new THREE.DirectionalLight('#FFF4DF', 2.75);
    keySun.position.set(16, 28, -14);
    keySun.castShadow = !isSoftwareGl;
    keySun.shadow.mapSize.set(1024, 1024);
    keySun.shadow.camera.near = 2;
    keySun.shadow.camera.far = 90;
    const d = 22;
    keySun.shadow.camera.left = -d;
    keySun.shadow.camera.right = d;
    keySun.shadow.camera.top = d;
    keySun.shadow.camera.bottom = -d;
    keySun.shadow.bias = -0.0005;
    keySun.shadow.normalBias = 0.02;
    scene.add(keySun);
    scene.add(keySun.target);

    const rimLight = new THREE.DirectionalLight('#7DD3FC', 1.15);
    rimLight.position.set(-12, 10, 18);
    scene.add(rimLight);

    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
    const world = new HighwayWorld(textures, !isSoftwareGl);
    scene.add(world.group);
    scene.add(world.garageGroup);

    let bikeRig: MotorcycleRig | null = null;
    const rebuildBike = () => {
      if (bikeRig) {
        scene.remove(bikeRig.root);
        bikeRig.dispose();
      }
      const spec = getBikeById(bikeIdRef.current);
      const livery = spec.liveries[liveryIdxRef.current % spec.liveries.length] ?? spec.liveries[0];
      bikeRig = buildMotorcycleRig(spec, livery, textures, !isSoftwareGl, modsRef.current);
      scene.add(bikeRig.root);
    };
    rebuildBike();

    forceShowroomSyncRef.current = () => {
      if (disposed || contextLost || renderer.getContext().isContextLost()) return;
      const p = phaseRef.current;
      if (p !== 'garage' && p !== 'login') return;
      if (needsBikeRebuildRef.current) {
        needsBikeRebuildRef.current = false;
        rebuildBike();
      }
      if (bikeRig) {
        bikeRig.root.position.set(0, 0.08, 0);
        bikeRig.root.rotation.set(0, 0, 0);
        bikeRig.chassisPivot.rotation.set(0, 0, -0.05);
        bikeRig.steeringPivot.rotation.y = 0.22;
        bikeRig.nitroFlameMesh.visible = false;
        bikeRig.taillightMat.emissiveIntensity = 1.1;
        bikeRig.contactShadowMesh.visible = true;
        bikeRig.riderGroup.visible = showRiderInGarageRef.current;
        bikeRig.riderTorsoPivot.position.set(0, 0.05, 0.02);
        bikeRig.riderTorsoPivot.rotation.set(0.54, 0, 0);
        bikeRig.riderHeadPivot.rotation.set(-0.42, 0.14, 0);
      }
      renderer.render(scene, camera);
    };

    // Keyboard & Pointer drag-orbit in Garage
    const keysPressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };
    const clearInputs = () => {
      keysPressed.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    let garageOrbitYaw = 0.65;
    let garageOrbitPitch = 0.18;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current === 'garage' || phaseRef.current === 'login') {
        isDragging = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      garageOrbitYaw -= dx * 0.008;
      garageOrbitPitch = THREE.MathUtils.clamp(garageOrbitPitch + dy * 0.005, 0.04, 0.52);
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, entry.contentRect.width);
      const h = Math.max(1, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (!disposed && !contextLost && !renderer.getContext().isContextLost()) {
        renderer.render(scene, camera);
      }
    });
    resizeObserver.observe(container);

    // Simulation state
    let rideState: RidePhysicsState = createInitialRideState();
    let crashState: CrashTumbleState | null = null;
    let crashModalSent = false;
    let lastHudPush = 0;
    let lastInputMask = -1;

    // Pre-allocated camera vectors (Zero-GC)
    const desiredCamPos = new THREE.Vector3();
    const desiredLookAt = new THREE.Vector3();
    const smoothLookAt = new THREE.Vector3(0, 0.7, 2);
    const camForward = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let camInitialized = false;

    const resetRide = () => {
      rideState = createInitialRideState();
      crashState = null;
      crashModalSent = false;
      world.resetTraffic(0);
      camInitialized = false;
    };

    let lastTimeMs = performance.now();
    const startTimeMs = lastTimeMs;
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed || contextLost) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl.isContextLost() || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed || contextLost || gl.isContextLost()) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed || contextLost || renderer.getContext().isContextLost()) return;
      const nowMs = performance.now();
      const rawDt = Math.max(0.001, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;
      const dt = Math.min(rawDt, 0.05);
      const elapsed = (nowMs - startTimeMs) / 1000;

      if (needsBikeRebuildRef.current) {
        needsBikeRebuildRef.current = false;
        rebuildBike();
      }
      if (needsRideResetRef.current) {
        needsRideResetRef.current = false;
        resetRide();
      }

      const currentPhase = phaseRef.current;
      const spec = applyBikeModsToSpec(getBikeById(bikeIdRef.current), modsRef.current);
      const isShowroom = currentPhase === 'login' || currentPhase === 'garage';

      world.garageGroup.visible = isShowroom;
      world.group.visible = !isShowroom;

      if (isShowroom) {
        scene.background = garageFogColor;
        (scene.fog as THREE.FogExp2).color.copy(garageFogColor);
        (scene.fog as THREE.FogExp2).density = 0.025;
        keySun.position.set(6, 10, 8);
        keySun.target.position.set(0, 0.6, 0);
        audio.updateEngine(0, 0, spec.cylinders, false, false);

        if (!isDragging) {
          garageOrbitYaw += dt * 0.32;
        }
        if (bikeRig) {
          bikeRig.root.position.set(0, 0.08, 0);
          bikeRig.root.rotation.set(0, 0, 0);
          bikeRig.chassisPivot.rotation.set(0, 0, -0.05); // sleek kickstand lean
          bikeRig.steeringPivot.rotation.y = 0.22; // turned front wheel showcase pose
          bikeRig.frontWheelSpin.rotation.x = 0;
          bikeRig.rearWheelSpin.rotation.x = 0;
          bikeRig.nitroFlameMesh.visible = false;
          bikeRig.taillightMat.emissiveIntensity = 1.1;
          bikeRig.contactShadowMesh.visible = true;

          // Showcase racing rider stance
          bikeRig.riderGroup.visible = showRiderInGarageRef.current;
          bikeRig.riderTorsoPivot.position.set(0, 0.05, 0.02);
          bikeRig.riderTorsoPivot.rotation.set(0.54, 0, 0);
          bikeRig.riderHeadPivot.rotation.set(-0.42, 0.14, 0);
        }

        const radius = currentPhase === 'login' ? 3.2 : 2.85;
        desiredCamPos.set(
          Math.sin(garageOrbitYaw) * radius,
          0.95 + Math.sin(garageOrbitPitch) * 1.25,
          Math.cos(garageOrbitYaw) * radius,
        );
        desiredLookAt.set(0, 0.64, 0.05);
        if (currentPhase === 'login') {
          // Shift look target to camera-left so the bike frames cleanly in the open right half
          camForward.subVectors(desiredLookAt, desiredCamPos).normalize();
          camRight.crossVectors(camForward, worldUp).normalize();
          desiredLookAt.addScaledVector(camRight, -0.78);
          desiredCamPos.addScaledVector(camRight, -0.52);
        }

        if (!camInitialized) {
          camera.position.copy(desiredCamPos);
          smoothLookAt.copy(desiredLookAt);
          camInitialized = true;
        } else {
          const alpha = 1 - Math.exp(-8 * dt);
          camera.position.lerp(desiredCamPos, alpha);
          smoothLookAt.lerp(desiredLookAt, alpha);
        }
        camera.fov = THREE.MathUtils.damp(camera.fov, 44, 6, dt);
        camera.updateProjectionMatrix();
        camera.lookAt(smoothLookAt);
      } else {
        // HIGHWAY RIDE MODE
        scene.background = highwayFogColor;
        (scene.fog as THREE.FogExp2).color.copy(highwayFogColor);
        (scene.fog as THREE.FogExp2).density = 0.0046;

        const isPlaying = currentPhase === 'playing';
        const touch = touchInputRef.current;
        const activeThrottle =
          isPlaying && (keysPressed.has('KeyW') || keysPressed.has('ArrowUp') || !!touch.throttle);
        const activeBrake =
          isPlaying && (keysPressed.has('KeyS') || keysPressed.has('ArrowDown') || !!touch.brake);
        const activeNitro =
          isPlaying &&
          (keysPressed.has('ShiftLeft') ||
            keysPressed.has('ShiftRight') ||
            keysPressed.has('Space') ||
            !!touch.nitro);

        if (isPlaying) {
          if (rideState.hitstopTimer > 0) {
            rideState.hitstopTimer = Math.max(0, rideState.hitstopTimer - dt);
            rideState.trauma = Math.max(0, rideState.trauma - dt * 1.4);
          } else if (!rideState.isCrashed) {
            const input: RideInput = {
              throttle: activeThrottle,
              brake: activeBrake,
              left: keysPressed.has('KeyA') || keysPressed.has('ArrowLeft') || !!touch.left,
              right: keysPressed.has('KeyD') || keysPressed.has('ArrowRight') || !!touch.right,
              nitro: activeNitro,
            };

            const prevIntegrity = rideState.integrity;
            rideState = stepBikeRidePhysics(rideState, input, spec, dt);

            // Detect guardrail damage triggered inside stepBikeRidePhysics
            if (rideState.integrity < prevIntegrity) {
              world.spawnImpactParticles(rideState.x, 0.45, rideState.z, 18, true);
              audio.playCrashImpact(rideState.isCrashed);
              if (rideState.isCrashed && !crashState) {
                crashState = createCrashTumble(rideState, rideState.vx);
              }
            }

            const trafficBoxes = world.update(rideState.z, dt, true);

            // Evaluate traffic collisions & near-misses
            for (const obs of trafficBoxes) {
              const outcome = evaluateTrafficInteraction(rideState, obs);
              if (outcome.collided && rideState.invulnerableTimer <= 0) {
                rideState.integrity = Math.max(0, rideState.integrity - outcome.damage);
                rideState.vx = outcome.lateralImpulse;
                rideState.speedMs *= outcome.speedDropFactor;
                rideState.speedKmh = rideState.speedMs * 3.6;
                rideState.hitstopTimer = outcome.hitstop;
                rideState.trauma = Math.min(1, rideState.trauma + outcome.trauma);
                rideState.invulnerableTimer = 0.65;
                rideState.comboMultiplier = 1;
                rideState.comboTimer = 0;

                world.spawnImpactParticles(rideState.x, 0.6, rideState.z + 0.5, outcome.severity === 'fatal' ? 36 : 18, true);
                world.spawnImpactParticles(rideState.x, 0.4, rideState.z + 0.4, 12, false);
                audio.playCrashImpact(outcome.severity === 'fatal' || rideState.integrity <= 0);

                if (outcome.severity === 'fatal' || rideState.integrity <= 0) {
                  rideState.isCrashed = true;
                  rideState.crashCause = outcome.cause;
                  crashState = createCrashTumble(rideState, outcome.lateralImpulse);
                }
                break;
              } else if (outcome.nearMiss) {
                obs.passedNearMiss = true;
                rideState.nearMissCount += 1;
                rideState.comboMultiplier = Math.min(5, rideState.comboMultiplier + 1);
                rideState.comboTimer = 4.0;
                rideState.score += 120 * rideState.comboMultiplier;
                rideState.nitroFuel = Math.min(100, rideState.nitroFuel + 14);
                rideState.trauma = Math.min(1, rideState.trauma + outcome.trauma);
                audio.playNearMiss();
                onNearMissRef.current(rideState.comboMultiplier);
              }
            }

            if (rideState.isNitroActive) {
              world.spawnImpactParticles(rideState.x, 0.42, rideState.z - 0.85, 1, true);
            }
          } else if (crashState) {
            // Advance crash tumble physics!
            crashState = stepCrashTumble(crashState, dt);
            world.update(crashState.z, dt, true);
            if (!crashState.settled && Math.random() < 0.65) {
              world.spawnImpactParticles(crashState.x, 0.22, crashState.z, 3, true);
              world.spawnImpactParticles(crashState.x, 0.25, crashState.z, 2, false);
            }
            if ((crashState.settled || crashState.elapsed > 1.35) && !crashModalSent) {
              crashModalSent = true;
              audio.silence();
              onCrashRef.current({
                impactSpeedKmh: crashState.impactSpeedKmh,
                distanceKm: Number((rideState.z / 1000).toFixed(2)),
                score: Math.round(rideState.score),
                nearMissCount: rideState.nearMissCount,
                cause: rideState.crashCause || 'Kecelakaan berkecepatan tinggi',
              });
            }
          }

          audio.updateEngine(
            rideState.rpm,
            rideState.speedKmh,
            spec.cylinders,
            rideState.isNitroActive,
            !rideState.isCrashed,
            modsRef.current.exhaust,
          );
        } else {
          // Paused or Game Over
          world.update(crashState ? crashState.z : rideState.z, 0, false);
          audio.updateEngine(0, 0, spec.cylinders, false, false, modsRef.current.exhaust);
        }

        const mode = cameraModeRef.current;

        // Apply transforms to Motorcycle Rig & Rider
        if (bikeRig) {
          if (crashState) {
            bikeRig.root.position.set(-crashState.x, crashState.y, crashState.z);
            bikeRig.root.rotation.set(crashState.rotX, crashState.rotY, crashState.rotZ);
            bikeRig.chassisPivot.rotation.set(0, 0, 0);
            bikeRig.steeringPivot.rotation.y = 0.4;
            bikeRig.nitroFlameMesh.visible = false;
            bikeRig.contactShadowMesh.visible = false;
            bikeRig.riderGroup.visible = false;
          } else {
            bikeRig.root.position.set(-rideState.x, 0, rideState.z);
            bikeRig.root.rotation.set(0, 0, 0);
            // Lean around ground contact patch (+rotation.z leans toward -X = screen right)
            bikeRig.chassisPivot.rotation.z = -rideState.leanAngleRad;
            // Pitch (-rotation.x lifts front nose up for wheelie)
            bikeRig.chassisPivot.rotation.x = -rideState.pitchAngleRad;
            // Steering fork & stang turn
            bikeRig.steeringPivot.rotation.y = rideState.steerAngleRad;
            // Wheels spin cleanly forward
            bikeRig.frontWheelSpin.rotation.x = rideState.wheelRotationRad;
            bikeRig.rearWheelSpin.rotation.x = rideState.wheelRotationRad;
            // Brake taillight & Nitro flame
            bikeRig.taillightMat.emissiveIntensity = activeBrake ? 4.2 : 1.5;
            bikeRig.nitroFlameMesh.visible = rideState.isNitroActive;
            if (rideState.isNitroActive) {
              bikeRig.nitroFlameMesh.scale.set(1, 1, 0.85 + Math.sin(elapsed * 45) * 0.25);
            }
            bikeRig.contactShadowMesh.visible = true;
            bikeRig.contactShadowMesh.position.x = -rideState.leanAngleRad * 0.28;

            // Rider articulation (hidden in Cockpit view so TFT dash & stang stay clear)
            bikeRig.riderGroup.visible = mode !== 'cockpit';
            if (bikeRig.riderGroup.visible) {
              const speedTuck = THREE.MathUtils.clamp((rideState.speedKmh - 40) / 160, 0, 1);
              bikeRig.riderTorsoPivot.position.set(rideState.leanAngleRad * 0.14, 0.05, 0.02);
              bikeRig.riderTorsoPivot.rotation.set(
                0.52 + speedTuck * 0.28 + (rideState.isNitroActive ? 0.08 : 0),
                0,
                -rideState.leanAngleRad * 0.28,
              );
              bikeRig.riderHeadPivot.rotation.set(
                -(0.4 + speedTuck * 0.24),
                rideState.steerAngleRad * 0.55,
                0,
              );
            }
          }
        }

        // Keep shadow frustum anchored to bike position
        const activeZ = crashState ? crashState.z : rideState.z;
        const activeX = crashState ? -crashState.x : -rideState.x;
        keySun.position.set(activeX + 18, 28, activeZ - 12);
        keySun.target.position.set(activeX, 0, activeZ + 6);

        // Camera Rig with exponential damping + trauma shake + speed FOV kick
        if (crashState) {
          desiredCamPos.set(activeX + 2.2, 2.3, activeZ - 4.8);
          desiredLookAt.set(activeX, 0.5, activeZ + 0.5);
        } else if (mode === 'cockpit') {
          desiredCamPos.set(
            activeX - rideState.leanAngleRad * 0.44,
            1.14 - Math.abs(rideState.leanAngleRad) * 0.12,
            activeZ + 0.16,
          );
          desiredLookAt.set(
            activeX - rideState.leanAngleRad * 0.85,
            0.9 - rideState.pitchAngleRad * 0.55,
            activeZ + 12,
          );
        } else if (mode === 'action') {
          desiredCamPos.set(activeX - 2.3, 1.08, activeZ + 2.65);
          desiredLookAt.set(activeX, 0.72, activeZ + 0.2);
        } else {
          // Chase Cam
          desiredCamPos.set(
            activeX * 0.86 - rideState.leanAngleRad * 0.35,
            1.68,
            activeZ - 3.65,
          );
          desiredLookAt.set(activeX * 0.92, 0.85, activeZ + 8.5);
        }

        const camAlpha = mode === 'cockpit' ? 1 - Math.exp(-24 * dt) : 1 - Math.exp(-11 * dt);
        if (!camInitialized) {
          camera.position.copy(desiredCamPos);
          smoothLookAt.copy(desiredLookAt);
          camInitialized = true;
        } else {
          camera.position.lerp(desiredCamPos, camAlpha);
          smoothLookAt.lerp(desiredLookAt, camAlpha);
        }

        // Trauma shake
        const shakeAmt = rideState.trauma * rideState.trauma * 0.24;
        if (shakeAmt > 0.001) {
          camera.position.x += (Math.random() - 0.5) * shakeAmt;
          camera.position.y += (Math.random() - 0.5) * shakeAmt;
        }

        const targetFov =
          mode === 'cockpit'
            ? 68 + (rideState.speedKmh / 300) * 14
            : 58 + (rideState.speedKmh / 300) * 18 + (rideState.isNitroActive ? 5 : 0);
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        camera.updateProjectionMatrix();
        camera.lookAt(smoothLookAt);

        if (mode === 'chase' && !crashState) {
          camera.rotation.z += rideState.leanAngleRad * 0.14;
        } else if (mode === 'cockpit' && !crashState) {
          camera.rotation.z += rideState.leanAngleRad * 0.45;
        }

        // Throttled HUD sync (~15Hz) + instant pedal state change
        const inputMask = (activeThrottle ? 1 : 0) | (activeBrake ? 2 : 0) | (activeNitro ? 4 : 0);
        if (elapsed - lastHudPush > 0.065 || inputMask !== lastInputMask) {
          lastHudPush = elapsed;
          lastInputMask = inputMask;
          onHudTickRef.current({
            speedKmh: Math.round(rideState.speedKmh),
            rpm: Math.round(rideState.rpm),
            redlineRpm: spec.redlineRpm,
            gear: rideState.gear,
            nitroFuel: Math.round(rideState.nitroFuel),
            isNitroActive: rideState.isNitroActive,
            integrity: Math.round(rideState.integrity),
            distanceKm: Number((rideState.z / 1000).toFixed(2)),
            score: Math.round(rideState.score),
            nearMissCount: rideState.nearMissCount,
            comboMultiplier: rideState.comboMultiplier,
            activeThrottle,
            activeBrake,
            activeNitro,
          });
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Draw the initial frame immediately so first paint never shows a blank canvas
    tick();

    return () => {
      disposed = true;
      forceShowroomSyncRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      bikeRig?.dispose();
      world.dispose();
      textures.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audio, touchInputRef]);

  return (
    <div
      ref={mountRef}
      data-testid="moto-viewport"
      className="fixed inset-0 w-full h-full bg-[#0B0E14]"
    />
  );
}
