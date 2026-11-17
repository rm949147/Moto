import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBikeModsToSpec, DEFAULT_BIKE_MODS, getBikeById, MOD_PRESETS, MOTORCYCLE_CATALOG } from './catalog';
import {
  computeGearAndRpm,
  createCrashTumble,
  createInitialRideState,
  evaluateTrafficInteraction,
  ROAD_HALF_WIDTH,
  stepBikeRidePhysics,
  stepCrashTumble,
  validateRiderLogin,
  type TrafficBox,
} from './physics';

test('motorcycle accelerates under throttle and respects top speed cap', () => {
  const spec = getBikeById('r15m');
  let state = createInitialRideState();
  const initialSpeed = state.speedKmh;

  for (let i = 0; i < 60; i++) {
    state = stepBikeRidePhysics(
      state,
      { throttle: true, brake: false, left: false, right: false, nitro: false },
      spec,
      0.05,
    );
  }

  assert.ok(state.speedKmh > initialSpeed, 'Speed should increase under throttle');
  assert.ok(state.speedKmh <= spec.topSpeedKmh + 0.5, 'Speed should not exceed top speed without nitro');
  assert.ok(state.z > 50, 'Bike should travel forward along +Z');
});

test('steering induces realistic lean angle and counter-rotates handlebar angle', () => {
  const spec = getBikeById('zx25r');
  let state = createInitialRideState();

  for (let i = 0; i < 20; i++) {
    state = stepBikeRidePhysics(
      state,
      { throttle: true, brake: false, left: false, right: true, nitro: false },
      spec,
      0.03,
    );
  }

  assert.ok(state.x > 0, 'Right steering moves bike toward +X');
  assert.ok(state.leanAngleRad < -0.1, 'Right steering leans bike smoothly into the turn');
  assert.ok(state.steerAngleRad < 0, 'Steering angle reflects turn input');
});

test('braking reduces speed and pitches bike forward (fork dive)', () => {
  const spec = getBikeById('cbr150r');
  let state = createInitialRideState();
  state.speedMs = 30;
  state.speedKmh = 108;

  for (let i = 0; i < 15; i++) {
    state = stepBikeRidePhysics(
      state,
      { throttle: false, brake: true, left: false, right: false, nitro: false },
      spec,
      0.04,
    );
  }

  assert.ok(state.speedKmh < 85, 'Braking must noticeably decelerate bike');
  assert.ok(state.pitchAngleRad < -0.02, 'Braking causes front fork dive pitch');
});

test('guardrail collision clamps lateral position and damages integrity on hard hit', () => {
  const spec = getBikeById('gsxr150');
  let state = createInitialRideState();
  state.x = ROAD_HALF_WIDTH;
  state.vx = 6.5;

  state = stepBikeRidePhysics(
    state,
    { throttle: true, brake: false, left: false, right: true, nitro: false },
    spec,
    0.04,
  );

  assert.ok(state.x < ROAD_HALF_WIDTH, 'Bike must stay inside road guardrail');
  assert.ok(state.integrity < 100, 'Hard guardrail impact reduces bike integrity');
  assert.ok(state.vx < 0, 'Guardrail rebounds lateral velocity');
});

test('gear and RPM computation scales across gears and redlines correctly', () => {
  const zx25r = getBikeById('zx25r');
  const low = computeGearAndRpm(25, true, false, zx25r);
  const high = computeGearAndRpm(195, true, false, zx25r);

  assert.equal(low.gear, 1);
  assert.ok(high.gear >= 5);
  assert.ok(high.rpm <= zx25r.redlineRpm);
  assert.ok(high.rpm > low.rpm);
});

test('traffic collision detects direct crash vs side scrape vs near-miss', () => {
  const bike = createInitialRideState();
  bike.x = 0;
  bike.z = 100;
  bike.speedMs = 35; // 126 km/h
  bike.speedKmh = 126;

  const directObstacle: TrafficBox = {
    id: 1,
    x: 0.1,
    z: 100.2,
    halfWidth: 0.9,
    halfLength: 2.1,
    speedMs: 12,
    kind: 'sedan',
    passedNearMiss: false,
  };
  const directHit = evaluateTrafficInteraction(bike, directObstacle);
  assert.equal(directHit.collided, true);
  assert.equal(directHit.severity, 'heavy');
  assert.ok(directHit.damage > 40);

  const nearMissObstacle: TrafficBox = {
    id: 2,
    x: 1.85,
    z: 100.0,
    halfWidth: 0.9,
    halfLength: 2.0,
    speedMs: 12,
    kind: 'suv',
    passedNearMiss: false,
  };
  const nearMissResult = evaluateTrafficInteraction(bike, nearMissObstacle);
  assert.equal(nearMissResult.collided, false);
  assert.equal(nearMissResult.nearMiss, true);
});

test('crash tumble simulation decelerates with ground friction and settles', () => {
  const bike = createInitialRideState();
  bike.speedMs = 28;
  bike.speedKmh = 100.8;
  let crash = createCrashTumble(bike, 8);

  for (let i = 0; i < 80; i++) {
    crash = stepCrashTumble(crash, 0.04);
  }

  assert.equal(crash.settled, true, 'Crash tumble should settle within ~3s');
  assert.ok(crash.z > bike.z, 'Crashed bike slides forward along the road');
  assert.ok(crash.y >= 0.22, 'Crashed bike stays above ground surface');
});

test('rider login validation rejects empty or too-short callsigns', () => {
  assert.equal(validateRiderLogin('', 'B 1234').valid, false);
  assert.equal(validateRiderLogin('A', 'B 1234').valid, false);
  assert.equal(validateRiderLogin('Raka Apex', 'B 4412 ZX').valid, true);
});

test('aftermarket exhaust and racing chain modifications improve bike performance specs', () => {
  const base = getBikeById('r15m');
  const stock = applyBikeModsToSpec(base, DEFAULT_BIKE_MODS);
  const modded = applyBikeModsToSpec(base, {
    exhaust: 'sc-titanium',
    light: 'demon-red',
    chain: 'did-gold',
  });

  assert.equal(stock.topSpeedKmh, base.topSpeedKmh);
  assert.ok(modded.topSpeedKmh > stock.topSpeedKmh, 'SC Project exhaust increases top speed');
  assert.ok(modded.horsepowerHp > stock.horsepowerHp, 'Aftermarket exhaust increases HP');
  assert.ok(modded.accelRate > stock.accelRate, 'Exhaust + DID Gold chain increases acceleration');
});

test('expanded 8-bike catalog includes CBR250RR, YZF-R1M, BMW M 1000 RR and valid tuning presets', () => {
  assert.equal(MOTORCYCLE_CATALOG.length, 8);
  const cbr250rr = getBikeById('cbr250rr');
  const r1m = getBikeById('r1m');
  const bmw = getBikeById('s1000rr');

  assert.equal(cbr250rr.cylinders, 2);
  assert.equal(cbr250rr.exhaustStyle, 'dual-stacked');
  assert.equal(r1m.cylinders, 4);
  assert.equal(r1m.headlightStyle, 'r1m-m-duct');
  assert.equal(bmw.brand, 'BMW');
  assert.equal(bmw.headlightStyle, 'bmw-split-kidney');
  assert.ok(bmw.topSpeedKmh >= 300);

  for (const preset of MOD_PRESETS) {
    const tuned = applyBikeModsToSpec(bmw, preset.mods);
    assert.ok(tuned.horsepowerHp >= bmw.horsepowerHp);
    assert.ok(tuned.topSpeedKmh >= bmw.topSpeedKmh);
  }
});

