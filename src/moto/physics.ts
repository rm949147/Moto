import type { MotorcycleSpec } from './catalog';

export const ROAD_HALF_WIDTH = 5.4; // total asphalt 10.8m wide (3 lanes of 3.6m)
export const BIKE_HALF_WIDTH = 0.42;
export const BIKE_HALF_LENGTH = 1.05;

export interface RideInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
}

export interface RidePhysicsState {
  x: number; // lateral position on road (-ROAD_HALF_WIDTH .. +ROAD_HALF_WIDTH)
  z: number; // forward distance traveled along road (meters, increasing positive)
  vx: number; // lateral velocity (m/s)
  speedMs: number; // forward velocity (m/s)
  speedKmh: number;
  leanAngleRad: number; // roll angle (radians)
  steerAngleRad: number; // handlebar / front fork yaw angle
  pitchAngleRad: number; // wheelie (+) / brake dive (-)
  wheelRotationRad: number;
  rpm: number;
  gear: number; // 0 = N, 1..6
  nitroFuel: number; // 0..100
  isNitroActive: boolean;
  integrity: number; // 0..100 bike health/integrity
  invulnerableTimer: number; // brief i-frames after glancing scrape
  hitstopTimer: number; // freeze frame on impact
  trauma: number; // 0..1 camera shake trauma
  score: number;
  nearMissCount: number;
  comboMultiplier: number;
  comboTimer: number;
  isCrashed: boolean;
  crashCause: string;
}

export interface CrashTumbleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  angVelX: number;
  angVelY: number;
  angVelZ: number;
  impactSpeedKmh: number;
  elapsed: number;
  settled: boolean;
}

export interface TrafficBox {
  id: number;
  x: number;
  z: number;
  halfWidth: number;
  halfLength: number;
  speedMs: number;
  kind: 'sedan' | 'suv' | 'truck' | 'barrier';
  passedNearMiss: boolean;
}

export interface CollisionOutcome {
  collided: boolean;
  nearMiss: boolean;
  severity: 'none' | 'scrape' | 'heavy' | 'fatal';
  damage: number;
  lateralImpulse: number;
  speedDropFactor: number;
  hitstop: number;
  trauma: number;
  cause: string;
}

export function createInitialRideState(): RidePhysicsState {
  return {
    x: 0,
    z: 0,
    vx: 0,
    speedMs: 14, // start rolling smoothly (~50 km/h) so first seconds survive cleanly
    speedKmh: 50.4,
    leanAngleRad: 0,
    steerAngleRad: 0,
    pitchAngleRad: 0,
    wheelRotationRad: 0,
    rpm: 3200,
    gear: 2,
    nitroFuel: 100,
    isNitroActive: false,
    integrity: 100,
    invulnerableTimer: 0,
    hitstopTimer: 0,
    trauma: 0,
    score: 0,
    nearMissCount: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    isCrashed: false,
    crashCause: '',
  };
}

export function computeGearAndRpm(
  speedKmh: number,
  throttle: boolean,
  nitroActive: boolean,
  spec: MotorcycleSpec,
): { gear: number; rpm: number } {
  if (speedKmh < 2) {
    return {
      gear: 0,
      rpm: throttle ? Math.min(spec.redlineRpm * 0.65, spec.idleRpm + 3500) : spec.idleRpm,
    };
  }
  const top = spec.topSpeedKmh * (nitroActive ? 1.12 : 1.0);
  const ratio = Math.min(1, Math.max(0, speedKmh / top));
  const gearThresholds = [0, 0.2, 0.37, 0.54, 0.71, 0.86, 1.0];
  let gear = 1;
  for (let g = 1; g <= 6; g++) {
    if (ratio >= gearThresholds[g - 1]) {
      gear = g;
    }
  }
  const low = gearThresholds[gear - 1];
  const high = gearThresholds[gear];
  const gearProgress = Math.min(1, Math.max(0, (ratio - low) / Math.max(0.05, high - low)));
  const floorFraction = gear === 1 ? 0.18 : Math.min(0.68, 0.36 + (gear - 1) * 0.06);
  const minGearRpm = spec.idleRpm + (spec.redlineRpm - spec.idleRpm) * floorFraction;
  const ceilingRpm = spec.redlineRpm * (gear === 6 ? 1.0 : 0.94);
  const targetRpm =
    minGearRpm +
    gearProgress * (ceilingRpm - minGearRpm) * (throttle || nitroActive ? 1.0 : 0.8);
  return {
    gear,
    rpm: Math.round(Math.min(spec.redlineRpm, Math.max(spec.idleRpm, targetRpm))),
  };
}

export function stepBikeRidePhysics(
  state: RidePhysicsState,
  input: RideInput,
  spec: MotorcycleSpec,
  rawDt: number,
): RidePhysicsState {
  const dt = Math.min(rawDt, 0.05);
  if (dt <= 0 || state.isCrashed) return state;

  const next = { ...state };
  next.trauma = Math.max(0, next.trauma - dt * 1.8);
  next.invulnerableTimer = Math.max(0, next.invulnerableTimer - dt);
  if (next.comboTimer > 0) {
    next.comboTimer = Math.max(0, next.comboTimer - dt);
    if (next.comboTimer === 0) next.comboMultiplier = 1;
  }

  // Nitro logic
  const wantsNitro = input.nitro && next.nitroFuel > 2 && next.speedMs > 5;
  next.isNitroActive = wantsNitro;
  if (wantsNitro) {
    next.nitroFuel = Math.max(0, next.nitroFuel - dt * 22);
  } else {
    next.nitroFuel = Math.min(100, next.nitroFuel + dt * 5.5);
  }

  const maxSpeedMs = (spec.topSpeedKmh / 3.6) * (wantsNitro ? 1.15 : 1.0);
  const minCoastMs = 9.5; // gentle rolling idle speed ~34 km/h unless braking

  // Longitudinal acceleration & braking
  let accel = 0;
  if (input.brake) {
    accel = -spec.brakeRate;
  } else if (input.throttle || wantsNitro) {
    const speedFactor = 1 - Math.pow(Math.min(1, next.speedMs / maxSpeedMs), 1.65) * 0.65;
    accel = spec.accelRate * speedFactor * (wantsNitro ? 1.48 : 1.0);
  } else {
    // Engine braking / aerodynamic drag down to gentle cruise
    if (next.speedMs > minCoastMs) {
      accel = -3.2 - next.speedMs * 0.045;
    } else if (next.speedMs < minCoastMs) {
      accel = 2.0;
    }
  }

  next.speedMs = Math.max(0, Math.min(maxSpeedMs, next.speedMs + accel * dt));
  next.speedKmh = next.speedMs * 3.6;

  // Steering & lateral velocity
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speedSteeringAuthority = Math.min(1, 0.35 + next.speedMs / 25);
  const targetVx = steerInput * 7.8 * spec.handlingGrip * speedSteeringAuthority;
  const latLambda = steerInput !== 0 ? 9.5 : 11.5;
  const latAlpha = 1 - Math.exp(-latLambda * dt);
  next.vx = next.vx + (targetVx - next.vx) * latAlpha;

  next.x += next.vx * dt;
  next.z += next.speedMs * dt;

  // Guardrail / shoulder boundary collision (scrape physics if hitting edge guardrail)
  const guardLimit = ROAD_HALF_WIDTH - BIKE_HALF_WIDTH;
  if (next.x > guardLimit) {
    next.x = guardLimit;
    if (next.vx > 2.2) {
      next.vx = -next.vx * 0.52;
      next.speedMs *= 0.88;
      next.trauma = Math.min(1, next.trauma + 0.35);
      if (next.invulnerableTimer <= 0) {
        next.integrity = Math.max(0, next.integrity - 14);
        next.invulnerableTimer = 0.55;
        if (next.integrity <= 0) {
          next.isCrashed = true;
          next.crashCause = 'Menabrak pembatas jalan sisi kanan';
        }
      }
    } else {
      next.vx = Math.min(0, next.vx);
    }
  } else if (next.x < -guardLimit) {
    next.x = -guardLimit;
    if (next.vx < -2.2) {
      next.vx = -next.vx * 0.52;
      next.speedMs *= 0.88;
      next.trauma = Math.min(1, next.trauma + 0.35);
      if (next.invulnerableTimer <= 0) {
        next.integrity = Math.max(0, next.integrity - 14);
        next.invulnerableTimer = 0.55;
        if (next.integrity <= 0) {
          next.isCrashed = true;
          next.crashCause = 'Menabrak pembatas jalan sisi kiri';
        }
      }
    } else {
      next.vx = Math.max(0, next.vx);
    }
  }

  // Lean (roll) & handlebar steer angle
  const maxLeanRad = (spec.maxLeanDeg * Math.PI) / 180;
  const targetLean = -(next.vx / 8.5) * maxLeanRad;
  const clampedTargetLean = Math.max(-maxLeanRad, Math.min(maxLeanRad, targetLean));
  const leanAlpha = 1 - Math.exp(-10 * dt);
  next.leanAngleRad += (clampedTargetLean - next.leanAngleRad) * leanAlpha;

  const targetSteer = -steerInput * 0.28 * (1 - Math.min(0.65, next.speedMs / 75));
  next.steerAngleRad += (targetSteer - next.steerAngleRad) * (1 - Math.exp(-14 * dt));

  // Pitch (wheelie on hard throttle/nitro, fork dive on brake)
  let targetPitch = 0;
  if (input.brake && next.speedMs > 3) {
    targetPitch = -0.095;
  } else if (wantsNitro && next.speedMs > 10) {
    targetPitch = 0.11;
  } else if (input.throttle && accel > 4) {
    targetPitch = 0.045;
  }
  next.pitchAngleRad += (targetPitch - next.pitchAngleRad) * (1 - Math.exp(-9 * dt));

  // Wheel rotation synced to ground distance (wheel radius ~0.31m)
  const wheelRadius = 0.31;
  next.wheelRotationRad = (next.wheelRotationRad + (next.speedMs * dt) / wheelRadius) % (Math.PI * 200);

  // Gear & RPM
  const { gear, rpm } = computeGearAndRpm(next.speedKmh, input.throttle, wantsNitro, spec);
  next.gear = gear;
  next.rpm += (rpm - next.rpm) * (1 - Math.exp(-15 * dt));

  // Distance score
  next.score += next.speedMs * dt * 0.45 * next.comboMultiplier;

  return next;
}

export function evaluateTrafficInteraction(
  bike: RidePhysicsState,
  obstacle: TrafficBox,
): CollisionOutcome {
  const dx = bike.x - obstacle.x;
  const dz = bike.z - obstacle.z;
  const overlapX = BIKE_HALF_WIDTH + obstacle.halfWidth - Math.abs(dx);
  const overlapZ = BIKE_HALF_LENGTH + obstacle.halfLength - Math.abs(dz);

  if (overlapX > 0 && overlapZ > 0) {
    const relSpeedMs = Math.max(4, bike.speedMs - obstacle.speedMs);
    const relSpeedKmh = relSpeedMs * 3.6;

    // Determine glancing side-scrape vs direct rear-end / barrier smash
    const isGlancingEdge = overlapX < 0.34 && Math.abs(dx) > obstacle.halfWidth * 0.65 && obstacle.kind !== 'barrier';

    if (isGlancingEdge && bike.integrity > 28) {
      const pushDir = dx >= 0 ? 1 : -1;
      return {
        collided: true,
        nearMiss: false,
        severity: 'scrape',
        damage: Math.min(34, Math.round(14 + relSpeedKmh * 0.12)),
        lateralImpulse: pushDir * (7.5 + relSpeedMs * 0.15),
        speedDropFactor: 0.72,
        hitstop: 0.045,
        trauma: 0.55,
        cause: `Bersenggolan dengan ${labelForObstacle(obstacle.kind)}`,
      };
    }

    const damage = obstacle.kind === 'barrier' ? 100 : Math.min(100, Math.round(42 + relSpeedKmh * 0.55));
    const fatal = bike.integrity - damage <= 0 || relSpeedKmh > 95 || obstacle.kind === 'barrier';
    const pushDir = dx >= 0 ? 1 : -1;

    return {
      collided: true,
      nearMiss: false,
      severity: fatal ? 'fatal' : 'heavy',
      damage,
      lateralImpulse: pushDir * (9.0 + relSpeedMs * 0.25),
      speedDropFactor: fatal ? 0.35 : 0.48,
      hitstop: fatal ? 0.08 : 0.06,
      trauma: fatal ? 1.0 : 0.85,
      cause: `Menabrak ${labelForObstacle(obstacle.kind)} pada ${Math.round(bike.speedKmh)} km/jam`,
    };
  }

  // Near-miss check when passing beside a vehicle within 0.95m lateral gap
  const nearMissGap = BIKE_HALF_WIDTH + obstacle.halfWidth + 0.95;
  if (
    !obstacle.passedNearMiss &&
    Math.abs(dz) < obstacle.halfLength + BIKE_HALF_LENGTH &&
    Math.abs(dx) < nearMissGap &&
    bike.speedKmh > 65
  ) {
    return {
      collided: false,
      nearMiss: true,
      severity: 'none',
      damage: 0,
      lateralImpulse: 0,
      speedDropFactor: 1,
      hitstop: 0,
      trauma: 0.08,
      cause: '',
    };
  }

  return {
    collided: false,
    nearMiss: false,
    severity: 'none',
    damage: 0,
    lateralImpulse: 0,
    speedDropFactor: 1,
    hitstop: 0,
    trauma: 0,
    cause: '',
  };
}

function labelForObstacle(kind: TrafficBox['kind']): string {
  switch (kind) {
    case 'truck':
      return 'truk logistik';
    case 'suv':
      return 'mobil SUV';
    case 'sedan':
      return 'mobil sedan';
    case 'barrier':
      return 'beton pembatas jalan';
  }
}

export function createCrashTumble(
  bike: RidePhysicsState,
  lateralImpulse: number,
): CrashTumbleState {
  const forwardFactor = Math.max(8, bike.speedMs * 0.72);
  const spinSign = lateralImpulse >= 0 ? 1 : -1;
  return {
    x: bike.x,
    y: 0.18,
    z: bike.z,
    vx: lateralImpulse * 0.65,
    vy: Math.min(7.5, 2.8 + bike.speedMs * 0.11),
    vz: forwardFactor,
    rotX: 0.25,
    rotY: spinSign * 0.3,
    rotZ: bike.leanAngleRad,
    angVelX: 2.2 + bike.speedMs * 0.08,
    angVelY: spinSign * (4.5 + bike.speedMs * 0.12),
    angVelZ: spinSign * 7.8,
    impactSpeedKmh: Math.round(bike.speedKmh),
    elapsed: 0,
    settled: false,
  };
}

export function stepCrashTumble(crash: CrashTumbleState, rawDt: number): CrashTumbleState {
  const dt = Math.min(rawDt, 0.05);
  if (crash.settled || dt <= 0) return crash;

  const next = { ...crash, elapsed: crash.elapsed + dt };
  const gravity = 22.0;

  next.vy -= gravity * dt;
  next.x += next.vx * dt;
  next.y += next.vy * dt;
  next.z += next.vz * dt;

  // Clamp within road guardrails with bounce
  const limit = ROAD_HALF_WIDTH - 0.55;
  if (next.x > limit) {
    next.x = limit;
    next.vx = -Math.abs(next.vx) * 0.55;
    next.angVelY *= -0.7;
  } else if (next.x < -limit) {
    next.x = -limit;
    next.vx = Math.abs(next.vx) * 0.55;
    next.angVelY *= -0.7;
  }

  // Ground bounce & asphalt sliding friction
  if (next.y <= 0.22) {
    next.y = 0.22;
    if (next.vy < -1.8) {
      next.vy = -next.vy * 0.38;
    } else {
      next.vy = 0;
    }
    const slideFriction = Math.exp(-3.4 * dt);
    next.vx *= slideFriction;
    next.vz *= slideFriction;
    next.angVelX *= Math.exp(-5.0 * dt);
    next.angVelY *= Math.exp(-4.0 * dt);
    next.angVelZ *= Math.exp(-5.0 * dt);
  }

  next.rotX += next.angVelX * dt;
  next.rotY += next.angVelY * dt;
  next.rotZ += next.angVelZ * dt;

  // Settle on side after sliding stops or after 2.4s
  const totalSpeed = Math.hypot(next.vx, next.vz);
  if ((totalSpeed < 0.8 && next.y <= 0.25 && next.elapsed > 0.7) || next.elapsed > 2.4) {
    next.settled = true;
  }

  return next;
}

export function validateRiderLogin(name: string, plate: string): { valid: boolean; error: string } {
  const trimmedName = name.trim();
  const trimmedPlate = plate.trim();
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Nama rider minimal 2 karakter.' };
  }
  if (trimmedName.length > 24) {
    return { valid: false, error: 'Nama rider maksimal 24 karakter.' };
  }
  if (trimmedPlate.length > 12) {
    return { valid: false, error: 'Nomor pelat maksimal 12 karakter.' };
  }
  return { valid: true, error: '' };
}
