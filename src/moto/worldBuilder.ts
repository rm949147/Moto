import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { ROAD_HALF_WIDTH, type TrafficBox } from './physics';
import type { ProceduralTexturePack } from './textures';

const SEGMENT_LENGTH = 80;
const SEGMENT_COUNT = 5; // 400m rolling highway window
const TOTAL_LOOP_LENGTH = SEGMENT_LENGTH * SEGMENT_COUNT;

const TREE_COUNT = 190;
const SHRUB_COUNT = 130;
const POLE_COUNT = 30;
const STUD_COUNT = 120;
const GANTRY_COUNT = 3;
const TRAFFIC_POOL_SIZE = 11;
const PARTICLE_POOL_SIZE = 120;

interface TrafficEntry {
  box: TrafficBox;
  group: THREE.Group;
  wheels: THREE.Mesh[];
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  isSpark: boolean;
}

export class HighwayWorld {
  readonly group = new THREE.Group();
  readonly garageGroup = new THREE.Group();
  readonly sky: Sky;

  private segments: THREE.Group[] = [];
  private treeTrunks: THREE.InstancedMesh;
  private treeCanopyLow: THREE.InstancedMesh;
  private treeCanopyMid: THREE.InstancedMesh;
  private treeCanopyHigh: THREE.InstancedMesh;
  private treePositions: Array<{ x: number; z: number; scale: number; rotY: number }> = [];

  private shrubsMesh: THREE.InstancedMesh;
  private shrubPositions: Array<{ x: number; z: number; scale: number; rotY: number }> = [];

  private roadStuds: THREE.InstancedMesh;
  private studPositions: Array<{ x: number; z: number }> = [];

  private polePosts: THREE.InstancedMesh;
  private poleArms: THREE.InstancedMesh;
  private poleLamps: THREE.InstancedMesh;
  private polePositions: Array<{ x: number; z: number; side: number }> = [];

  private gantries: THREE.Group[] = [];
  private trafficEntries: TrafficEntry[] = [];
  private nextTrafficId = 1;

  private particlesMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private garageTurntable: THREE.Group;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  // Pre-allocated scratch math helpers (Zero-GC in render loop)
  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();

  constructor(textures: ProceduralTexturePack, enableShadows: boolean) {
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    // 1. Procedural Sky Dome (Rich Golden-Hour Realism)
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = 5.2;
    skyUniforms['rayleigh'].value = 1.65;
    skyUniforms['mieCoefficient'].value = 0.0045;
    skyUniforms['mieDirectionalG'].value = 0.84;
    const sunVec = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(68),
      THREE.MathUtils.degToRad(140),
    );
    skyUniforms['sunPosition'].value.copy(sunVec);
    this.group.add(this.sky);

    // 2. Repeating Road + Curb Shoulder + Guardrail + Mountain Horizon Segments
    const roadMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: textures.roadColor,
        bumpMap: textures.roadBump,
        bumpScale: 0.022,
        roughnessMap: textures.roadRoughness,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    textures.roadColor.repeat.set(1, 5);

    const terrainMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: textures.grassColor,
        roughness: 0.94,
        metalness: 0.0,
      }),
    );
    const curbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#64748B',
        roughness: 0.82,
        metalness: 0.08,
      }),
    );
    const shoulderMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#374151',
        roughness: 0.9,
        metalness: 0.06,
      }),
    );
    const guardrailMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#E2E8F0',
        metalness: 0.82,
        roughness: 0.28,
      }),
    );
    const postMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#475569',
        metalness: 0.68,
        roughness: 0.42,
      }),
    );

    const roadGeo = trackGeo(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, SEGMENT_LENGTH, 1, 1));
    roadGeo.rotateX(-Math.PI / 2);

    const terrainGeo = trackGeo(new THREE.PlaneGeometry(280, SEGMENT_LENGTH, 1, 1));
    terrainGeo.rotateX(-Math.PI / 2);

    const curbGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.09, SEGMENT_LENGTH));
    const shoulderGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.06, SEGMENT_LENGTH));
    const railGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.26, SEGMENT_LENGTH));
    const railPostGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.78, 0.1));

    const foothillMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#254425',
        roughness: 0.94,
        metalness: 0.0,
      }),
    );
    const mountainMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#3E556B',
        roughness: 0.96,
        metalness: 0.0,
      }),
    );
    const hillGeo = trackGeo(new THREE.ConeGeometry(34, 18, 9));
    const mountainGeo = trackGeo(new THREE.ConeGeometry(54, 42, 7));

    for (let s = 0; s < SEGMENT_COUNT; s++) {
      const seg = new THREE.Group();
      seg.position.z = s * SEGMENT_LENGTH;

      const terrain = new THREE.Mesh(terrainGeo, terrainMat);
      terrain.position.y = -0.032;
      terrain.receiveShadow = enableShadows;
      seg.add(terrain);

      const road = new THREE.Mesh(roadGeo, roadMat);
      road.position.y = 0;
      road.receiveShadow = enableShadows;
      seg.add(road);

      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(side * (ROAD_HALF_WIDTH + 0.12), 0.02, 0);
        curb.receiveShadow = enableShadows;
        seg.add(curb);

        const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulder.position.set(side * (ROAD_HALF_WIDTH + 0.78), -0.01, 0);
        shoulder.receiveShadow = enableShadows;
        seg.add(shoulder);

        const rail = new THREE.Mesh(railGeo, guardrailMat);
        rail.position.set(side * (ROAD_HALF_WIDTH + 0.38), 0.56, 0);
        rail.castShadow = enableShadows;
        seg.add(rail);

        for (let pz = -SEGMENT_LENGTH / 2 + 4; pz < SEGMENT_LENGTH / 2; pz += 8) {
          const post = new THREE.Mesh(railPostGeo, postMat);
          post.position.set(side * (ROAD_HALF_WIDTH + 0.42), 0.36, pz);
          seg.add(post);
        }

        // Mid-ground green foothills + distant atmospheric slate mountain peaks
        const hill = new THREE.Mesh(hillGeo, foothillMat);
        hill.position.set(side * (62 + ((s * 17) % 24)), 7.2, (s % 2 === 0 ? 1 : -1) * 16);
        hill.scale.set(1.25, 0.8 + (s % 3) * 0.28, 1.9);
        seg.add(hill);

        const peak = new THREE.Mesh(mountainGeo, mountainMat);
        peak.position.set(side * (108 + ((s * 23) % 28)), 17, (s % 2 === 0 ? -1 : 1) * 20);
        peak.scale.set(1.4, 0.9 + (s % 2) * 0.35, 1.8);
        seg.add(peak);
      }

      this.segments.push(seg);
      this.group.add(seg);
    }

    // 2B. Cat's-Eye Reflective Lane Studs along lane dividers
    const studGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.022, 0.16));
    const studMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FDE68A',
        emissive: '#F59E0B',
        emissiveIntensity: 0.95,
        roughness: 0.25,
      }),
    );
    this.roadStuds = new THREE.InstancedMesh(studGeo, studMat, STUD_COUNT);
    this.roadStuds.frustumCulled = false;
    for (let i = 0; i < STUD_COUNT; i++) {
      const laneX = i % 2 === 0 ? -1.8 : 1.8;
      const z = (Math.floor(i / 2) / (STUD_COUNT / 2)) * TOTAL_LOOP_LENGTH - 30;
      this.studPositions.push({ x: laneX, z });
    }
    this.group.add(this.roadStuds);

    // 3. Instanced Multi-Tier Organic Roadside Trees + Shrubs
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.29, 2.8, 8));
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#52382B',
        roughness: 0.92,
        metalness: 0.0,
      }),
    );

    const canopyLowGeo = trackGeo(new THREE.IcosahedronGeometry(1.75, 1));
    canopyLowGeo.scale(1.1, 0.82, 1.1);
    canopyLowGeo.translate(0, 3.3, 0);
    const canopyMidGeo = trackGeo(new THREE.IcosahedronGeometry(1.38, 1));
    canopyMidGeo.scale(1.05, 0.9, 1.05);
    canopyMidGeo.translate(-0.36, 4.15, 0.25);
    const canopyHighGeo = trackGeo(new THREE.IcosahedronGeometry(1.12, 1));
    canopyHighGeo.scale(0.98, 0.95, 0.98);
    canopyHighGeo.translate(0.32, 4.7, -0.2);

    const canopyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.84,
        metalness: 0.02,
      }),
    );

    this.treeTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    this.treeCanopyLow = new THREE.InstancedMesh(canopyLowGeo, canopyMat, TREE_COUNT);
    this.treeCanopyMid = new THREE.InstancedMesh(canopyMidGeo, canopyMat, TREE_COUNT);
    this.treeCanopyHigh = new THREE.InstancedMesh(canopyHighGeo, canopyMat, TREE_COUNT);
    this.treeTrunks.castShadow = enableShadows;
    this.treeCanopyLow.castShadow = enableShadows;
    this.treeCanopyMid.castShadow = enableShadows;
    this.treeCanopyHigh.castShadow = enableShadows;
    this.treeTrunks.frustumCulled = false;
    this.treeCanopyLow.frustumCulled = false;
    this.treeCanopyMid.frustumCulled = false;
    this.treeCanopyHigh.frustumCulled = false;

    const treePalette = ['#2B6A3A', '#377A41', '#225630', '#45803F', '#1C4B2D'];
    for (let i = 0; i < TREE_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const band = i % 3 === 0 ? 9.8 + (i % 7) * 1.45 : 19 + (i % 11) * 2.9;
      const x = side * band;
      const z = (i / TREE_COUNT) * TOTAL_LOOP_LENGTH - 40;
      const scale = 0.84 + ((i * 37) % 100) / 210;
      const rotY = ((i * 73) % 360) * (Math.PI / 180);
      this.treePositions.push({ x, z, scale, rotY });

      this._color.set(treePalette[i % treePalette.length]);
      this.treeCanopyLow.setColorAt(i, this._color);
      this._color.offsetHSL(0, 0.02, 0.04);
      this.treeCanopyMid.setColorAt(i, this._color);
      this._color.offsetHSL(0, 0, 0.04);
      this.treeCanopyHigh.setColorAt(i, this._color);
    }
    this.treeCanopyLow.instanceColor!.needsUpdate = true;
    this.treeCanopyMid.instanceColor!.needsUpdate = true;
    this.treeCanopyHigh.instanceColor!.needsUpdate = true;
    this.group.add(this.treeTrunks, this.treeCanopyLow, this.treeCanopyMid, this.treeCanopyHigh);

    // Roadside shrubs / bushes for denser foreground ground breakup
    const shrubGeo = trackGeo(new THREE.DodecahedronGeometry(0.75, 1));
    shrubGeo.scale(1.25, 0.72, 1.15);
    shrubGeo.translate(0, 0.38, 0);
    this.shrubsMesh = new THREE.InstancedMesh(shrubGeo, canopyMat, SHRUB_COUNT);
    this.shrubsMesh.frustumCulled = false;
    for (let i = 0; i < SHRUB_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (7.6 + (i % 5) * 1.1);
      const z = (i / SHRUB_COUNT) * TOTAL_LOOP_LENGTH - 35;
      const scale = 0.75 + ((i * 29) % 50) / 80;
      const rotY = ((i * 53) % 360) * (Math.PI / 180);
      this.shrubPositions.push({ x, z, scale, rotY });
      this._color.set(treePalette[(i + 2) % treePalette.length]);
      this.shrubsMesh.setColorAt(i, this._color);
    }
    this.shrubsMesh.instanceColor!.needsUpdate = true;
    this.group.add(this.shrubsMesh);

    // 4. Instanced Highway Street Light Poles
    const polePostGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 8));
    polePostGeo.translate(0, 3.1, 0);
    const poleArmGeo = trackGeo(new THREE.BoxGeometry(1.6, 0.08, 0.08));
    const poleLampGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.08, 0.22));
    const lampGlowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FEF3C7',
        emissive: '#FDE68A',
        emissiveIntensity: 1.6,
      }),
    );
    this.polePosts = new THREE.InstancedMesh(polePostGeo, postMat, POLE_COUNT);
    this.poleArms = new THREE.InstancedMesh(poleArmGeo, postMat, POLE_COUNT);
    this.poleLamps = new THREE.InstancedMesh(poleLampGeo, lampGlowMat, POLE_COUNT);
    this.polePosts.frustumCulled = false;
    this.poleArms.frustumCulled = false;
    this.poleLamps.frustumCulled = false;
    for (let i = 0; i < POLE_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (ROAD_HALF_WIDTH + 1.05);
      const z = (i / POLE_COUNT) * TOTAL_LOOP_LENGTH - 30;
      this.polePositions.push({ x, z, side });
    }
    this.group.add(this.polePosts, this.poleArms, this.poleLamps);

    // 5. Highway Overhead Sign Gantries with Indonesian Directional Sign Graphics
    const gantrySteelMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#64748B', metalness: 0.78, roughness: 0.32 }),
    );
    const signFrameMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.65, roughness: 0.4 }),
    );
    const signFaceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: textures.gantrySign,
        roughness: 0.45,
        metalness: 0.08,
      }),
    );
    const legGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.2, 6.5, 8));
    const beamGeo = trackGeo(new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 2.4, 0.32, 0.32));
    const boardGeo = trackGeo(new THREE.BoxGeometry(5.2, 1.62, 0.14));
    const boardFaceGeo = trackGeo(new THREE.PlaneGeometry(5.1, 1.54));

    for (let g = 0; g < GANTRY_COUNT; g++) {
      const gantry = new THREE.Group();
      const leftLeg = new THREE.Mesh(legGeo, gantrySteelMat);
      leftLeg.position.set(-(ROAD_HALF_WIDTH + 1.0), 3.25, 0);
      const rightLeg = new THREE.Mesh(legGeo, gantrySteelMat);
      rightLeg.position.set(ROAD_HALF_WIDTH + 1.0, 3.25, 0);
      const beam = new THREE.Mesh(beamGeo, gantrySteelMat);
      beam.position.set(0, 6.3, 0);
      const signBoard = new THREE.Mesh(boardGeo, signFrameMat);
      signBoard.position.set(0, 6.2, -0.22);
      const signFace = new THREE.Mesh(boardFaceGeo, signFaceMat);
      signFace.position.set(0, 6.2, -0.3);
      signFace.rotation.y = Math.PI;
      gantry.add(leftLeg, rightLeg, beam, signBoard, signFace);
      gantry.position.z = 75 + g * (TOTAL_LOOP_LENGTH / GANTRY_COUNT);
      this.gantries.push(gantry);
      this.group.add(gantry);
    }

    // 6. Traffic Pool (Detailed Sedans, SUVs, Trucks, Road Barriers)
    const kinds: TrafficBox['kind'][] = [
      'sedan',
      'suv',
      'sedan',
      'truck',
      'sedan',
      'barrier',
      'suv',
      'sedan',
      'truck',
      'suv',
      'sedan',
    ];
    for (let i = 0; i < TRAFFIC_POOL_SIZE; i++) {
      const kind = kinds[i % kinds.length];
      const entry = this.buildTrafficVehicle(kind, textures, enableShadows, trackGeo, trackMat);
      this.trafficEntries.push(entry);
      this.group.add(entry.group);
    }
    this.resetTraffic(0);

    // 7. Pooled Zero-GC Spark & Smoke Particle System
    const pGeo = trackGeo(new THREE.OctahedronGeometry(0.08, 0));
    const pMat = trackMat(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.particlesMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particlesMesh.frustumCulled = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        isSpark: true,
      });
      this._dummy.position.set(0, -50, 0);
      this._dummy.scale.setScalar(0.001);
      this._dummy.updateMatrix();
      this.particlesMesh.setMatrixAt(i, this._dummy.matrix);
      this.particlesMesh.setColorAt(i, this._color.set('#F59E0B'));
    }
    this.particlesMesh.instanceMatrix.needsUpdate = true;
    this.particlesMesh.instanceColor!.needsUpdate = true;
    this.group.add(this.particlesMesh);

    // 8. Motorsport Pit-Box Studio Showroom Stage (Used during Login & Bike Inspection)
    const garageFloorGeo = trackGeo(new THREE.CircleGeometry(20, 48));
    garageFloorGeo.rotateX(-Math.PI / 2);
    const garageFloorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: textures.garageFloor,
        roughness: 0.28,
        metalness: 0.34,
      }),
    );
    const gFloor = new THREE.Mesh(garageFloorGeo, garageFloorMat);
    gFloor.position.y = -0.02;
    gFloor.receiveShadow = enableShadows;
    this.garageGroup.add(gFloor);

    // Multi-tier chamfered metallic + carbon turntable plinth
    this.garageTurntable = new THREE.Group();
    const plinthBaseGeo = trackGeo(new THREE.CylinderGeometry(1.86, 2.02, 0.055, 48));
    const plinthMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#1A202B',
        roughness: 0.25,
        metalness: 0.72,
      }),
    );
    const plinthBase = new THREE.Mesh(plinthBaseGeo, plinthMat);
    plinthBase.position.y = 0.027;
    plinthBase.receiveShadow = enableShadows;

    const plinthDeckGeo = trackGeo(new THREE.CylinderGeometry(1.66, 1.72, 0.032, 48));
    const plinthDeckMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: textures.carbonFiber,
        roughness: 0.34,
        metalness: 0.3,
      }),
    );
    const plinthDeck = new THREE.Mesh(plinthDeckGeo, plinthDeckMat);
    plinthDeck.position.y = 0.07;
    plinthDeck.receiveShadow = enableShadows;

    const ringGeo = trackGeo(new THREE.RingGeometry(1.67, 1.73, 48));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = trackMat(new THREE.MeshBasicMaterial({ color: '#F59E0B' }));
    const trimRing = new THREE.Mesh(ringGeo, ringMat);
    trimRing.position.y = 0.088;

    const outerAccentRingGeo = trackGeo(new THREE.RingGeometry(2.08, 2.11, 48));
    outerAccentRingGeo.rotateX(-Math.PI / 2);
    const outerAccentMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.45 }),
    );
    const outerAccentRing = new THREE.Mesh(outerAccentRingGeo, outerAccentMat);
    outerAccentRing.position.y = 0.005;

    this.garageTurntable.add(plinthBase, plinthDeck, trimRing, outerAccentRing);
    this.garageGroup.add(this.garageTurntable);

    // Architectural Pit-Bay Steel Columns & Overhead Studio LED Softbox Light Bars
    const pillarMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#1F2735', metalness: 0.78, roughness: 0.32 }),
    );
    const lightStripMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#E0F2FE' }),
    );
    const warmLightStripMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#FDE68A' }),
    );

    const pillarGeo = trackGeo(new THREE.BoxGeometry(0.24, 5.2, 0.24));
    const beamRingGeo = trackGeo(new THREE.TorusGeometry(6.8, 0.08, 8, 48));
    beamRingGeo.rotateX(Math.PI / 2);
    const overheadTruss = new THREE.Mesh(beamRingGeo, pillarMat);
    overheadTruss.position.y = 4.6;
    this.garageGroup.add(overheadTruss);

    // Overhead illuminated softbox rings & radial LED bars
    const softboxBarGeo = trackGeo(new THREE.BoxGeometry(2.4, 0.06, 0.28));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(pillarGeo, pillarMat);
      col.position.set(Math.sin(ang) * 7.2, 2.58, Math.cos(ang) * 7.2);
      col.rotation.y = ang;
      this.garageGroup.add(col);

      const strip = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.05, 3.2, 0.06)),
        i % 2 === 0 ? lightStripMat : warmLightStripMat,
      );
      strip.position.set(Math.sin(ang) * 7.05, 2.4, Math.cos(ang) * 7.05);
      strip.rotation.y = ang;
      this.garageGroup.add(strip);

      const overheadBar = new THREE.Mesh(softboxBarGeo, i % 2 === 0 ? lightStripMat : warmLightStripMat);
      overheadBar.position.set(Math.sin(ang) * 2.8, 3.85, Math.cos(ang) * 2.8);
      overheadBar.rotation.y = ang;
      this.garageGroup.add(overheadBar);
    }

    // Subtle curved pit-garage wall backdrop
    const wallGeo = trackGeo(new THREE.CylinderGeometry(15, 15, 7, 36, 1, true));
    const wallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#0C1018',
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.BackSide,
      }),
    );
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 3.4;
    this.garageGroup.add(wall);
  }

  private buildTrafficVehicle(
    kind: TrafficBox['kind'],
    textures: ProceduralTexturePack,
    enableShadows: boolean,
    trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
    trackMat: <T extends THREE.Material>(m: T) => T,
  ): TrafficEntry {
    const group = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const shadowMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
      }),
    );

    if (kind === 'barrier') {
      const barrierMat = trackMat(
        new THREE.MeshStandardMaterial({ color: '#EA580C', roughness: 0.58, metalness: 0.12 }),
      );
      const stripeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: '#F8FAFC',
          roughness: 0.4,
          emissive: '#F59E0B',
          emissiveIntensity: 0.35,
        }),
      );
      const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.75, 0.85, 0.65)), barrierMat);
      base.position.y = 0.425;
      base.castShadow = enableShadows;
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.78, 0.2, 0.68)), stripeMat);
      stripe.position.y = 0.58;
      const sh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.1, 1.1)), shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.015;
      group.add(base, stripe, sh);

      return {
        box: {
          id: this.nextTrafficId++,
          x: 0,
          z: 0,
          halfWidth: 0.86,
          halfLength: 0.34,
          speedMs: 0,
          kind,
          passedNearMiss: false,
        },
        group,
        wheels,
      };
    }

    const carColors = ['#E2E8F0', '#2563EB', '#475569', '#DC2626', '#059669', '#D97706'];
    const bodyColor = carColors[this.nextTrafficId % carColors.length];
    const paintMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        roughness: 0.18,
        metalness: 0.48,
        clearcoat: 0.95,
        clearcoatRoughness: 0.08,
      }),
    );
    const glassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: '#0B1220',
        roughness: 0.08,
        metalness: 0.35,
        clearcoat: 1.0,
      }),
    );
    const darkTrimMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#181C24', roughness: 0.65, metalness: 0.2 }),
    );
    const alloyMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.22, metalness: 0.85 }),
    );
    const tireMat = trackMat(new THREE.MeshStandardMaterial({ color: '#14161B', roughness: 0.88 }));
    const tailMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#EF4444', emissive: '#DC2626', emissiveIntensity: 2.0 }),
    );
    const headMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#E0F2FE', emissiveIntensity: 1.6 }),
    );

    const isTruck = kind === 'truck';
    const isSuv = kind === 'suv';
    const width = isTruck ? 2.15 : 1.84;
    const length = isTruck ? 5.6 : isSuv ? 4.4 : 4.25;
    const bodyHeight = isTruck ? 0.65 : isSuv ? 0.7 : 0.54;

    const lower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width, bodyHeight, length)), paintMat);
    lower.position.y = 0.34 + bodyHeight / 2;
    lower.castShadow = enableShadows;
    group.add(lower);

    // Lower diffuser / rear bumper
    const diffuser = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width * 0.96, 0.18, 0.16)),
      darkTrimMat,
    );
    diffuser.position.set(0, 0.34, -length / 2 + 0.02);
    group.add(diffuser);

    if (isTruck) {
      const cargoMat = trackMat(
        new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.6, metalness: 0.12 }),
      );
      const cargo = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width + 0.06, 1.85, 3.9)), cargoMat);
      cargo.position.set(0, 1.65, -0.75);
      cargo.castShadow = enableShadows;
      const cab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width - 0.08, 1.15, 1.35)), paintMat);
      cab.position.set(0, 1.32, 1.95);
      cab.castShadow = enableShadows;
      const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width - 0.22, 0.55, 1.38)), glassMat);
      windshield.position.set(0, 1.5, 1.97);
      group.add(cargo, cab, windshield);
    } else {
      const cabinHeight = isSuv ? 0.62 : 0.46;
      const cabin = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width * 0.82, cabinHeight, length * 0.5)),
        glassMat,
      );
      cabin.position.set(0, 0.34 + bodyHeight + cabinHeight / 2 - 0.05, -0.15);
      cabin.castShadow = enableShadows;
      const roof = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width * 0.78, 0.06, length * 0.44)),
        paintMat,
      );
      roof.position.set(0, 0.34 + bodyHeight + cabinHeight - 0.03, -0.15);
      group.add(cabin, roof);
    }

    // Glowing LED taillights + headlights + rear license plate recess
    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.12, 0.06)), tailMat);
      tl.position.set(side * (width * 0.34), 0.72, -length / 2 - 0.01);
      const hl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.11, 0.05)), headMat);
      hl.position.set(side * (width * 0.34), 0.68, length / 2 + 0.01);
      group.add(tl, hl);
    }

    // 4 wheels with alloy rims
    const wGeo = trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16));
    wGeo.rotateZ(Math.PI / 2);
    const rGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.255, 12));
    rGeo.rotateZ(Math.PI / 2);
    const wzOffset = length * 0.32;
    const wxOffset = width * 0.48;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wGeo, tireMat);
        w.position.set(sx * wxOffset, 0.34, sz * wzOffset);
        const r = new THREE.Mesh(rGeo, alloyMat);
        w.add(r);
        wheels.push(w);
        group.add(w);
      }
    }

    const sh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(width + 0.6, length + 0.6)), shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.014;
    group.add(sh);

    return {
      box: {
        id: this.nextTrafficId++,
        x: 0,
        z: 0,
        halfWidth: width * 0.48,
        halfLength: length * 0.48,
        speedMs: isTruck ? 12.5 : isSuv ? 16.0 : 18.5,
        kind,
        passedNearMiss: false,
      },
      group,
      wheels,
    };
  }

  resetTraffic(bikeZ: number) {
    const laneXs = [-3.6, 0, 3.6];
    this.trafficEntries.forEach((entry, idx) => {
      const z = bikeZ + 62 + idx * 24 + (idx % 3) * 6;
      const laneIdx = (idx + Math.floor(idx / 2)) % laneXs.length;
      entry.box.x = laneXs[laneIdx];
      entry.box.z = z;
      entry.box.passedNearMiss = false;
      entry.group.position.set(-entry.box.x, 0, entry.box.z);
    });
  }

  spawnImpactParticles(x: number, y: number, z: number, count: number, isSpark: boolean) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.4;
      slot.y = y + Math.random() * 0.3;
      slot.z = z + (Math.random() - 0.5) * 0.4;
      slot.vx = (Math.random() - 0.5) * (isSpark ? 11 : 4);
      slot.vy = Math.random() * (isSpark ? 7.5 : 3.5) + 1.5;
      slot.vz = (Math.random() - 0.5) * (isSpark ? 10 : 5);
      slot.life = 0;
      slot.maxLife = isSpark ? 0.35 + Math.random() * 0.35 : 0.5 + Math.random() * 0.4;
      slot.scale = isSpark ? 0.7 + Math.random() * 0.8 : 1.6 + Math.random() * 1.4;
      slot.isSpark = isSpark;

      this._color.set(isSpark ? (i % 2 === 0 ? '#FBBF24' : '#F97316') : '#94A3B8');
      this.particlesMesh.setColorAt(this.particleCursor, this._color);
    }
    this.particlesMesh.instanceColor!.needsUpdate = true;
  }

  update(bikeZ: number, dt: number, advanceTraffic: boolean): TrafficBox[] {
    for (const seg of this.segments) {
      while (seg.position.z < bikeZ - SEGMENT_LENGTH * 1.2) {
        seg.position.z += TOTAL_LOOP_LENGTH;
      }
      while (seg.position.z > bikeZ + TOTAL_LOOP_LENGTH - SEGMENT_LENGTH * 1.2) {
        seg.position.z -= TOTAL_LOOP_LENGTH;
      }
    }

    for (let i = 0; i < STUD_COUNT; i++) {
      const sp = this.studPositions[i];
      while (sp.z < bikeZ - 30) sp.z += TOTAL_LOOP_LENGTH;
      while (sp.z > bikeZ + TOTAL_LOOP_LENGTH - 30) sp.z -= TOTAL_LOOP_LENGTH;
      this._dummy.position.set(sp.x, 0.011, sp.z);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.setScalar(1);
      this._dummy.updateMatrix();
      this.roadStuds.setMatrixAt(i, this._dummy.matrix);
    }
    this.roadStuds.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < TREE_COUNT; i++) {
      const tp = this.treePositions[i];
      while (tp.z < bikeZ - 35) tp.z += TOTAL_LOOP_LENGTH;
      while (tp.z > bikeZ + TOTAL_LOOP_LENGTH - 35) tp.z -= TOTAL_LOOP_LENGTH;

      this._dummy.position.set(tp.x, 0, tp.z);
      this._dummy.rotation.set(0, tp.rotY, 0);
      this._dummy.scale.setScalar(tp.scale);
      this._dummy.updateMatrix();
      this.treeTrunks.setMatrixAt(i, this._dummy.matrix);
      this.treeCanopyLow.setMatrixAt(i, this._dummy.matrix);
      this.treeCanopyMid.setMatrixAt(i, this._dummy.matrix);
      this.treeCanopyHigh.setMatrixAt(i, this._dummy.matrix);
    }
    this.treeTrunks.instanceMatrix.needsUpdate = true;
    this.treeCanopyLow.instanceMatrix.needsUpdate = true;
    this.treeCanopyMid.instanceMatrix.needsUpdate = true;
    this.treeCanopyHigh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < SHRUB_COUNT; i++) {
      const sh = this.shrubPositions[i];
      while (sh.z < bikeZ - 35) sh.z += TOTAL_LOOP_LENGTH;
      while (sh.z > bikeZ + TOTAL_LOOP_LENGTH - 35) sh.z -= TOTAL_LOOP_LENGTH;
      this._dummy.position.set(sh.x, 0, sh.z);
      this._dummy.rotation.set(0, sh.rotY, 0);
      this._dummy.scale.setScalar(sh.scale);
      this._dummy.updateMatrix();
      this.shrubsMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.shrubsMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < POLE_COUNT; i++) {
      const pp = this.polePositions[i];
      while (pp.z < bikeZ - 30) pp.z += TOTAL_LOOP_LENGTH;
      while (pp.z > bikeZ + TOTAL_LOOP_LENGTH - 30) pp.z -= TOTAL_LOOP_LENGTH;

      this._dummy.position.set(pp.x, 0, pp.z);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.setScalar(1);
      this._dummy.updateMatrix();
      this.polePosts.setMatrixAt(i, this._dummy.matrix);

      this._dummy.position.set(pp.x - pp.side * 0.72, 6.08, pp.z);
      this._dummy.updateMatrix();
      this.poleArms.setMatrixAt(i, this._dummy.matrix);

      this._dummy.position.set(pp.x - pp.side * 1.38, 6.02, pp.z);
      this._dummy.updateMatrix();
      this.poleLamps.setMatrixAt(i, this._dummy.matrix);
    }
    this.polePosts.instanceMatrix.needsUpdate = true;
    this.poleArms.instanceMatrix.needsUpdate = true;
    this.poleLamps.instanceMatrix.needsUpdate = true;

    for (const g of this.gantries) {
      while (g.position.z < bikeZ - 35) g.position.z += TOTAL_LOOP_LENGTH;
      while (g.position.z > bikeZ + TOTAL_LOOP_LENGTH - 35) g.position.z -= TOTAL_LOOP_LENGTH;
    }

    const laneXs = [-3.6, 0, 3.6];
    const boxes: TrafficBox[] = [];
    for (let i = 0; i < this.trafficEntries.length; i++) {
      const entry = this.trafficEntries[i];
      if (advanceTraffic && entry.box.speedMs > 0) {
        entry.box.z += entry.box.speedMs * dt;
        const wheelSpin = (entry.box.speedMs * dt) / 0.34;
        for (const w of entry.wheels) {
          w.rotation.x += wheelSpin;
        }
      }

      if (entry.box.z < bikeZ - 26) {
        let candidateZ = bikeZ + 180 + Math.random() * 90;
        let candidateLane = laneXs[Math.floor(Math.random() * laneXs.length)];
        for (let attempt = 0; attempt < 4; attempt++) {
          const conflict = this.trafficEntries.some(
            (other) =>
              other !== entry &&
              Math.abs(other.box.x - candidateLane) < 1.2 &&
              Math.abs(other.box.z - candidateZ) < 18,
          );
          if (!conflict) break;
          candidateZ += 16;
          candidateLane = laneXs[(laneXs.indexOf(candidateLane) + 1) % laneXs.length];
        }
        entry.box.z = candidateZ;
        entry.box.x = candidateLane;
        entry.box.passedNearMiss = false;
      }

      entry.group.position.set(-entry.box.x, 0, entry.box.z);
      boxes.push(entry.box);
    }

    let anyParticleDirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyParticleDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this._dummy.position.set(0, -50, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        this.particlesMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      if (p.isSpark) {
        p.vy -= 18 * dt;
      } else {
        p.vy += 2.2 * dt;
      }
      p.x += p.vx * dt;
      p.y = Math.max(0.04, p.y + p.vy * dt);
      p.z += p.vz * dt;
      if (p.y <= 0.05 && p.vy < 0) p.vy = -p.vy * 0.45;

      const fade = 1 - p.life / p.maxLife;
      this._dummy.position.set(-p.x, p.y, p.z);
      this._dummy.rotation.set(p.life * 8, p.life * 6, 0);
      this._dummy.scale.setScalar(Math.max(0.01, p.scale * fade));
      this._dummy.updateMatrix();
      this.particlesMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyParticleDirty) {
      this.particlesMesh.instanceMatrix.needsUpdate = true;
    }

    return boxes;
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
