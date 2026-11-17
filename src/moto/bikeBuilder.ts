import * as THREE from 'three';
import {
  DEFAULT_BIKE_MODS,
  getChainMod,
  getLightMod,
  type BikeLivery,
  type BikeMods,
  type MotorcycleSpec,
} from './catalog';
import type { ProceduralTexturePack } from './textures';

export interface MotorcycleRig {
  root: THREE.Group;
  chassisPivot: THREE.Group;
  steeringPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  riderGroup: THREE.Group;
  riderTorsoPivot: THREE.Group;
  riderHeadPivot: THREE.Group;
  taillightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  nitroFlameMesh: THREE.Mesh;
  contactShadowMesh: THREE.Mesh;
  dispose: () => void;
}

function createTftDashTexture(accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#070B12';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(14, 14, 228, 16);
  const grad = ctx.createLinearGradient(14, 0, 242, 0);
  grad.addColorStop(0, '#38BDF8');
  grad.addColorStop(0.65, accentHex);
  grad.addColorStop(1, '#EF4444');
  ctx.fillStyle = grad;
  ctx.fillRect(16, 16, 178, 12);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 48px monospace';
  ctx.fillText('142', 18, 92);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('KM/H', 115, 92);

  ctx.fillStyle = accentHex;
  ctx.fillRect(192, 46, 46, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('5', 205, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRadiatorGrilleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14171E';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#333A48';
  ctx.lineWidth = 2;
  for (let y = 0; y < 128; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  for (let x = 0; x < 128; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a smooth sculpted 3D shell by lofting across ordered Z-stations.
 * Each station specifies `z` and an array of `[x, y]` cross-section points
 * ordered clockwise when viewed from +Z looking toward -Z (top -> right -> bottom -> left).
 */
function createLoftedShellGeometry(
  stations: { z: number; ring: [number, number][] }[],
  capEnds = true,
): THREE.BufferGeometry {
  const ringLen = stations[0].ring.length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < stations.length; i++) {
    const { z, ring } = stations[i];
    for (let j = 0; j < ringLen; j++) {
      positions.push(ring[j][0], ring[j][1], z);
    }
  }

  for (let i = 0; i < stations.length - 1; i++) {
    const rowA = i * ringLen;
    const rowB = (i + 1) * ringLen;
    for (let j = 0; j < ringLen; j++) {
      const nextJ = (j + 1) % ringLen;
      const a = rowA + j;
      const b = rowB + j;
      const c = rowB + nextJ;
      const d = rowA + nextJ;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capEnds) {
    // Back cap (station 0, facing -Z)
    const backCenterIdx = positions.length / 3;
    let bx = 0;
    let by = 0;
    for (const [x, y] of stations[0].ring) {
      bx += x;
      by += y;
    }
    positions.push(bx / ringLen, by / ringLen, stations[0].z);
    for (let j = 0; j < ringLen; j++) {
      const nextJ = (j + 1) % ringLen;
      indices.push(backCenterIdx, j, nextJ);
    }

    // Front cap (last station, facing +Z)
    const lastIdx = stations.length - 1;
    const frontRow = lastIdx * ringLen;
    const frontCenterIdx = positions.length / 3;
    let fx = 0;
    let fy = 0;
    for (const [x, y] of stations[lastIdx].ring) {
      fx += x;
      fy += y;
    }
    positions.push(fx / ringLen, fy / ringLen, stations[lastIdx].z);
    for (let j = 0; j < ringLen; j++) {
      const nextJ = (j + 1) % ringLen;
      indices.push(frontCenterIdx, frontRow + nextJ, frontRow + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Helper to mirror half-profile points (right side from top-center to bottom-center) into a full symmetric loop */
function symmetricRing(rightHalf: [number, number][]): [number, number][] {
  const full: [number, number][] = [...rightHalf];
  for (let i = rightHalf.length - 2; i >= 1; i--) {
    full.push([-rightHalf[i][0], rightHalf[i][1]]);
  }
  return full;
}

function createCurvedExtrude(
  buildShape: (shape: THREE.Shape) => void,
  depth: number,
  bevel = 0.012,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  buildShape(shape);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 18,
  });
  geo.center();
  return geo;
}

function createToothedSprocketGeometry(
  outerR: number,
  innerR: number,
  teethCount: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const rootR = outerR - 0.012;
  for (let i = 0; i < teethCount; i++) {
    const a0 = (i / teethCount) * Math.PI * 2;
    const a1 = ((i + 0.35) / teethCount) * Math.PI * 2;
    const a2 = ((i + 0.55) / teethCount) * Math.PI * 2;
    const a3 = ((i + 0.85) / teethCount) * Math.PI * 2;
    if (i === 0) {
      shape.moveTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
    } else {
      shape.lineTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
    }
    shape.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * rootR, Math.sin(a3) * rootR);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 16,
  });
  geo.center();
  geo.rotateY(Math.PI / 2);
  return geo;
}

export function buildMotorcycleRig(
  spec: MotorcycleSpec,
  livery: BikeLivery,
  textures: ProceduralTexturePack,
  enableShadows: boolean,
  mods: BikeMods = DEFAULT_BIKE_MODS,
): MotorcycleRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const localTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const lightSpec = getLightMod(mods.light);
  const chainSpec = getChainMod(mods.chain);

  // Calibrated PBR Materials
  const paintPrimary = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.primary,
      metalness: 0.48,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.35,
    }),
  );
  const paintSecondary = trackMat(
    new THREE.MeshStandardMaterial({
      color: livery.secondary,
      metalness: 0.25,
      roughness: 0.42,
    }),
  );
  const paintAccent = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.accent,
      metalness: 0.45,
      roughness: 0.18,
      clearcoat: 0.9,
    }),
  );
  const matteCarbon = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: textures.carbonFiber,
      roughness: 0.4,
      metalness: 0.2,
    }),
  );
  const rubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1E2127',
      map: textures.tireTread,
      roughness: 0.85,
      metalness: 0.04,
    }),
  );
  const seatLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#14171D',
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: livery.rimColor,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  const alloySilverMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#D1D9E4',
      metalness: 0.9,
      roughness: 0.18,
    }),
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F8FAFC',
      metalness: 0.96,
      roughness: 0.05,
    }),
  );
  const forkOuterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.forkColor,
      metalness: 0.86,
      roughness: 0.18,
    }),
  );
  const engineBronzeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#7A6144',
      metalness: 0.82,
      roughness: 0.3,
    }),
  );
  const titaniumPipeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#A69582',
      metalness: 0.86,
      roughness: 0.24,
    }),
  );
  const burntBlueTipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#2563EB',
      emissive: '#1D4ED8',
      emissiveIntensity: 0.28,
      metalness: 0.92,
      roughness: 0.15,
    }),
  );
  const engineDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1A1E26',
      metalness: 0.65,
      roughness: 0.42,
    }),
  );
  const radMeshTex = createRadiatorGrilleTexture();
  localTextures.push(radMeshTex);
  const radiatorCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: radMeshTex,
      metalness: 0.62,
      roughness: 0.48,
    }),
  );
  const discSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: textures.brakeDisc,
      metalness: 0.88,
      roughness: 0.22,
      side: THREE.DoubleSide,
    }),
  );
  const brakeCaliperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.id === 'v4r' ? '#EAB308' : '#DC2626',
      metalness: 0.68,
      roughness: 0.26,
    }),
  );
  const windscreenMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#0A101D',
      roughness: 0.04,
      metalness: 0.12,
      transparent: true,
      opacity: 0.54,
      clearcoat: 1.0,
    }),
  );
  const lensCoverMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#E2E8F0',
      roughness: 0.04,
      metalness: 0.12,
      transparent: true,
      opacity: 0.28,
      clearcoat: 1.0,
    }),
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: lightSpec.lensColor,
      emissive: lightSpec.emissiveColor,
      emissiveIntensity: 3.4,
      roughness: 0.05,
    }),
  );
  const drlMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: lightSpec.drlColor,
      emissiveIntensity: 2.8,
      roughness: 0.08,
    }),
  );
  const amberSignalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      emissive: '#D97706',
      emissiveIntensity: 1.15,
      roughness: 0.2,
    }),
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#DC2626',
      emissiveIntensity: 1.8,
      roughness: 0.18,
    }),
  );
  const chainLinkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: chainSpec.linkColor,
      metalness: 0.88,
      roughness: 0.22,
    }),
  );
  const chainPinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: chainSpec.pinColor,
      metalness: 0.85,
      roughness: 0.28,
    }),
  );
  const sprocketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: chainSpec.sprocketColor,
      metalness: 0.84,
      roughness: 0.24,
    }),
  );

  const tftTex = createTftDashTexture(livery.accent);
  localTextures.push(tftTex);
  const tftMat = trackMat(new THREE.MeshBasicMaterial({ map: tftTex }));

  const root = new THREE.Group();
  const chassisPivot = new THREE.Group();
  root.add(chassisPivot);

  // Soft radial contact shadow grounded at y = 0.015
  const contactShadowGeo = trackGeo(new THREE.PlaneGeometry(1.22, 2.45));
  contactShadowGeo.rotateX(-Math.PI / 2);
  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
  contactShadowMesh.position.set(0, 0.015, 0);
  root.add(contactShadowMesh);

  // =========================================================================
  // 0. REALISTIC WHEELS, 5-SPLIT Y-SPOKE ALLOY RIMS & FLOATING BRAKE DISCS
  // =========================================================================
  const buildWheel = (isFront: boolean): THREE.Group => {
    const wheelGroup = new THREE.Group();
    const tireWidthScale = isFront ? 0.96 : 1.44;

    const tireGeo = trackGeo(new THREE.TorusGeometry(0.224, 0.081, 22, 46));
    tireGeo.rotateY(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, rubberMat);
    tireMesh.scale.set(tireWidthScale, 1, 1);
    tireMesh.castShadow = enableShadows;
    wheelGroup.add(tireMesh);

    const rimGeo = trackGeo(new THREE.CylinderGeometry(0.184, 0.184, isFront ? 0.092 : 0.132, 32, 1, true));
    rimGeo.rotateZ(Math.PI / 2);
    wheelGroup.add(new THREE.Mesh(rimGeo, rimMat));

    const lipGeo = trackGeo(new THREE.TorusGeometry(0.181, 0.011, 8, 34));
    lipGeo.rotateY(Math.PI / 2);
    const lipL = new THREE.Mesh(lipGeo, rimMat);
    lipL.position.x = isFront ? -0.042 : -0.06;
    const lipR = new THREE.Mesh(lipGeo, rimMat);
    lipR.position.x = isFront ? 0.042 : 0.06;
    wheelGroup.add(lipL, lipR);

    const hubGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.048, isFront ? 0.125 : 0.158, 18));
    hubGeo.rotateZ(Math.PI / 2);
    wheelGroup.add(new THREE.Mesh(hubGeo, engineDarkMat));

    // 5 Y-split racing spokes
    const spokeGeo = trackGeo(new THREE.BoxGeometry(0.013, 0.165, 0.014));
    for (let i = 0; i < 5; i++) {
      const baseAngle = (i / 5) * Math.PI * 2;
      for (const split of [-0.15, 0.15]) {
        const a = baseAngle + split;
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.set(0, Math.cos(a) * 0.098, Math.sin(a) * 0.098);
        spoke.rotation.x = a;
        wheelGroup.add(spoke);
      }
    }

    // Floating brake discs + carrier + bobbins
    const discGeo = trackGeo(new THREE.RingGeometry(0.082, 0.148, 30));
    discGeo.rotateY(Math.PI / 2);
    const carrierGeo = trackGeo(new THREE.RingGeometry(0.046, 0.084, 22));
    carrierGeo.rotateY(Math.PI / 2);
    const bobbinGeo = trackGeo(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8));
    bobbinGeo.rotateZ(Math.PI / 2);

    const addDisc = (sideSign: number) => {
      const xPos = sideSign * (isFront ? 0.066 : 0.084);
      const disc = new THREE.Mesh(discGeo, discSteelMat);
      disc.position.x = xPos;
      const carrier = new THREE.Mesh(carrierGeo, forkOuterMat);
      carrier.position.x = xPos - sideSign * 0.002;
      wheelGroup.add(disc, carrier);
      for (let b = 0; b < 8; b++) {
        const ang = (b / 8) * Math.PI * 2;
        const bobbin = new THREE.Mesh(bobbinGeo, alloySilverMat);
        bobbin.position.set(xPos, Math.cos(ang) * 0.082, Math.sin(ang) * 0.082);
        wheelGroup.add(bobbin);
      }
    };

    if (isFront) {
      addDisc(-1);
      if (spec.id === 'zx25r' || spec.id === 'v4r') addDisc(1);
    } else {
      addDisc(1);
      // Detailed Toothed Rear Sprocket + Carrier matching ChainMod!
      const sprocketGeo = trackGeo(createToothedSprocketGeometry(0.098, 0.056, 20, 0.01));
      const sprocket = new THREE.Mesh(sprocketGeo, sprocketMat);
      sprocket.position.x = -0.09;
      const sprocketCarrierGeo = trackGeo(new THREE.RingGeometry(0.042, 0.062, 16));
      sprocketCarrierGeo.rotateY(Math.PI / 2);
      const sprocketCarrier = new THREE.Mesh(sprocketCarrierGeo, chainPinMat);
      sprocketCarrier.position.x = -0.088;
      wheelGroup.add(sprocket, sprocketCarrier);
    }

    return wheelGroup;
  };

  // =========================================================================
  // 1. REAR WHEEL, SCULPTED SWINGARM, MONOSHOCK & ARTICULATED 3D ROLLER CHAIN
  // =========================================================================
  const rearWheelPosZ = -0.68;
  const frontWheelPosZ = 0.68;
  const wheelRadius = 0.305;

  const rearWheelSpin = buildWheel(false);
  rearWheelSpin.position.set(0, wheelRadius, rearWheelPosZ);
  chassisPivot.add(rearWheelSpin);

  const swingArmGeo = trackGeo(
    createCurvedExtrude((s) => {
      s.moveTo(0, -0.03);
      s.lineTo(0.56, -0.055);
      s.lineTo(0.56, 0.042);
      s.quadraticCurveTo(0.28, 0.07, 0, 0.028);
      s.closePath();
    }, 0.032, 0.008),
  );
  swingArmGeo.rotateY(Math.PI / 2);
  const swingMat = spec.id === 'r15m' || spec.id === 'v4r' ? alloySilverMat : engineDarkMat;
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(swingArmGeo, swingMat);
    arm.position.set(side * 0.125, 0.33, -0.41);
    arm.rotation.x = -0.07;
    chassisPivot.add(arm);
  }

  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.038, 0.06, 0.078));
  const rearCaliper = new THREE.Mesh(caliperGeo, brakeCaliperMat);
  rearCaliper.position.set(0.085, 0.39, -0.61);
  chassisPivot.add(rearCaliper);

  // Rear tire hugger
  const huggerGeo = trackGeo(new THREE.CylinderGeometry(0.322, 0.322, 0.158, 16, 1, true, -0.45, 1.15));
  huggerGeo.rotateZ(Math.PI / 2);
  const hugger = new THREE.Mesh(huggerGeo, matteCarbon);
  hugger.position.set(0, wheelRadius, rearWheelPosZ);
  chassisPivot.add(hugger);

  // Articulated 3D Roller Chain (44 individual instanced link plates + pins around front & rear sprockets!)
  const frontSprocketZ = -0.14;
  const frontSprocketY = 0.365;
  const frontSprocketR = 0.038;
  const rearSprocketZ = rearWheelPosZ;
  const rearSprocketY = wheelRadius;
  const rearSprocketR = 0.09;

  // Front drive sprocket disc
  const frontSprocketMesh = new THREE.Mesh(
    trackGeo(createToothedSprocketGeometry(0.042, 0.018, 12, 0.01)),
    sprocketMat,
  );
  frontSprocketMesh.position.set(-0.09, frontSprocketY, frontSprocketZ);
  chassisPivot.add(frontSprocketMesh);

  // Chain Stadium Path (CatmullRom around front & rear sprockets)
  const chainPoints: THREE.Vector3[] = [];
  const topSteps = 10;
  for (let i = 0; i <= topSteps; i++) {
    const t = i / topSteps;
    chainPoints.push(
      new THREE.Vector3(
        -0.09,
        THREE.MathUtils.lerp(rearSprocketY + rearSprocketR, frontSprocketY + frontSprocketR, t),
        THREE.MathUtils.lerp(rearSprocketZ, frontSprocketZ, t),
      ),
    );
  }
  for (let i = 1; i <= 5; i++) {
    const ang = Math.PI / 2 - (i / 6) * Math.PI;
    chainPoints.push(
      new THREE.Vector3(
        -0.09,
        frontSprocketY + Math.sin(ang) * frontSprocketR,
        frontSprocketZ + Math.cos(ang) * frontSprocketR,
      ),
    );
  }
  for (let i = 0; i <= topSteps; i++) {
    const t = i / topSteps;
    chainPoints.push(
      new THREE.Vector3(
        -0.09,
        THREE.MathUtils.lerp(frontSprocketY - frontSprocketR, rearSprocketY - rearSprocketR, t),
        THREE.MathUtils.lerp(frontSprocketZ, rearSprocketZ, t),
      ),
    );
  }
  for (let i = 1; i <= 7; i++) {
    const ang = -Math.PI / 2 - (i / 8) * Math.PI;
    chainPoints.push(
      new THREE.Vector3(
        -0.09,
        rearSprocketY + Math.sin(ang) * rearSprocketR,
        rearSprocketZ + Math.cos(ang) * rearSprocketR,
      ),
    );
  }
  const chainCurve = new THREE.CatmullRomCurve3(chainPoints, true);
  const linkCount = 46;
  const linkPlateGeo = trackGeo(new THREE.BoxGeometry(0.016, 0.015, 0.024));
  const linkPinGeo = trackGeo(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 8));
  linkPinGeo.rotateZ(Math.PI / 2);

  const linkInstanced = new THREE.InstancedMesh(linkPlateGeo, chainLinkMat, linkCount);
  const pinInstanced = new THREE.InstancedMesh(linkPinGeo, chainPinMat, linkCount);
  const dummy = new THREE.Object3D();
  const chainPos = new THREE.Vector3();
  const chainTan = new THREE.Vector3();
  const chainLookTarget = new THREE.Vector3();

  for (let i = 0; i < linkCount; i++) {
    const u = i / linkCount;
    chainCurve.getPointAt(u, chainPos);
    chainCurve.getTangentAt(u, chainTan);
    dummy.position.copy(chainPos);
    chainLookTarget.copy(chainPos).add(chainTan);
    dummy.up.set(1, 0, 0);
    dummy.lookAt(chainLookTarget);
    // Keep outer plates aligned cleanly along YZ plane
    dummy.rotation.set(Math.atan2(chainTan.y, chainTan.z), 0, 0);
    dummy.updateMatrix();
    linkInstanced.setMatrixAt(i, dummy.matrix);
    pinInstanced.setMatrixAt(i, dummy.matrix);
  }
  linkInstanced.instanceMatrix.needsUpdate = true;
  pinInstanced.instanceMatrix.needsUpdate = true;
  chassisPivot.add(linkInstanced, pinInstanced);

  // Rear Monoshock with coil spring
  const shockSpringMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.id === 'v4r' || spec.id === 'r15m' ? '#EAB308' : '#DC2626',
      metalness: 0.48,
      roughness: 0.3,
    }),
  );
  const monoshock = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 12)), shockSpringMat);
  monoshock.position.set(0, 0.47, -0.25);
  monoshock.rotation.x = 0.52;
  chassisPivot.add(monoshock);

  // =========================================================================
  // 2. ENGINE BLOCK, RADIATOR, FRAME & CUSTOM MODIFIABLE EXHAUST SYSTEM
  // =========================================================================
  const engineGroup = new THREE.Group();
  chassisPivot.add(engineGroup);

  const crankcase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.21, 0.3)), engineDarkMat);
  crankcase.position.set(0, 0.36, -0.02);
  crankcase.castShadow = enableShadows;
  engineGroup.add(crankcase);

  const cylWidth = spec.cylinders === 4 ? 0.28 : 0.16;
  const cylinder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cylWidth, 0.21, 0.17)), engineDarkMat);
  cylinder.position.set(0, 0.51, 0.07);
  cylinder.rotation.x = 0.38;
  engineGroup.add(cylinder);

  const headCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cylWidth + 0.018, 0.036, 0.185)), alloySilverMat);
  headCover.position.set(0, 0.6, 0.11);
  headCover.rotation.x = 0.38;
  engineGroup.add(headCover);

  // Bronze clutch cover + inner ring + stator cover
  const clutchGeo = trackGeo(new THREE.CylinderGeometry(0.082, 0.082, 0.048, 22));
  clutchGeo.rotateZ(Math.PI / 2);
  const clutchCover = new THREE.Mesh(clutchGeo, engineBronzeMat);
  clutchCover.position.set(0.13, 0.34, -0.04);
  const clutchRingGeo = trackGeo(new THREE.TorusGeometry(0.056, 0.009, 8, 22));
  clutchRingGeo.rotateY(Math.PI / 2);
  const clutchRing = new THREE.Mesh(clutchRingGeo, spec.id === 'v4r' ? brakeCaliperMat : alloySilverMat);
  clutchRing.position.set(0.155, 0.34, -0.04);
  const statorCover = new THREE.Mesh(clutchGeo, engineBronzeMat);
  statorCover.position.set(-0.13, 0.34, -0.02);
  engineGroup.add(clutchCover, clutchRing, statorCover);

  // Coolant hose
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.11, 0.52, 0.28),
    new THREE.Vector3(0.135, 0.44, 0.2),
    new THREE.Vector3(0.11, 0.39, 0.08),
  ]);
  engineGroup.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(hoseCurve, 10, 0.011, 8, false)), seatLeatherMat));

  // Textured Radiator Core + Aluminum Side Tanks
  const radiatorCore = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.19, 0.036)), radiatorCoreMat);
  radiatorCore.position.set(0, 0.48, 0.32);
  radiatorCore.rotation.x = -0.38;
  engineGroup.add(radiatorCore);
  for (const side of [-1, 1]) {
    const radTank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.2, 0.044)), alloySilverMat);
    radTank.position.set(side * 0.128, 0.48, 0.32);
    radTank.rotation.x = -0.38;
    engineGroup.add(radTank);
  }

  // Exposed Frame Rails (Deltabox / Trellis / Diamond)
  if (spec.frameStyle === 'trellis') {
    const trellisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: livery.id === 'krt-lime' ? '#36B314' : '#475569',
        metalness: 0.58,
        roughness: 0.28,
      }),
    );
    for (const side of [-1, 1]) {
      const curve1 = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.09, 0.62, -0.19),
        new THREE.Vector3(side * 0.135, 0.72, 0.08),
        new THREE.Vector3(side * 0.085, 0.79, 0.35),
      ]);
      const curve2 = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.09, 0.54, -0.15),
        new THREE.Vector3(side * 0.12, 0.63, 0.1),
        new THREE.Vector3(side * 0.08, 0.71, 0.33),
      ]);
      engineGroup.add(
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve1, 12, 0.015, 8, false)), trellisMat),
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve2, 12, 0.013, 8, false)), trellisMat),
      );
    }
  } else {
    const frameMat = spec.frameStyle === 'deltabox' ? alloySilverMat : engineDarkMat;
    const sparGeo = trackGeo(
      createCurvedExtrude((s) => {
        s.moveTo(-0.22, -0.09);
        s.quadraticCurveTo(0.0, 0.01, 0.23, 0.09);
        s.lineTo(0.23, 0.15);
        s.quadraticCurveTo(0.0, 0.07, -0.22, -0.02);
        s.closePath();
      }, 0.022, 0.006),
    );
    sparGeo.rotateY(Math.PI / 2);
    for (const side of [-1, 1]) {
      const spar = new THREE.Mesh(sparGeo, frameMat);
      spar.position.set(side * 0.132, 0.65, 0.09);
      engineGroup.add(spar);
    }
  }

  // CNC Rearset Footpeg Brackets & Pegs
  const pegGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8));
  pegGeo.rotateZ(Math.PI / 2);
  const rearsetBracketGeo = trackGeo(new THREE.BoxGeometry(0.014, 0.09, 0.12));
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(rearsetBracketGeo, alloySilverMat);
    bracket.position.set(side * 0.145, 0.4, -0.21);
    bracket.rotation.x = 0.28;
    const peg = new THREE.Mesh(pegGeo, alloySilverMat);
    peg.position.set(side * 0.195, 0.37, -0.23);
    engineGroup.add(bracket, peg);
  }

  // Exhaust Headers
  const headerCount = spec.cylinders === 4 ? 4 : spec.cylinders === 2 ? 2 : 1;
  for (let h = 0; h < headerCount; h++) {
    const offsetX =
      headerCount === 4 ? -0.105 + h * 0.07 : headerCount === 2 ? (h === 0 ? -0.045 : 0.055) : 0.055;
    const headerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(offsetX, 0.48, 0.18),
      new THREE.Vector3(offsetX * 0.8, 0.23, 0.23),
      new THREE.Vector3(0.09, 0.185, 0.0),
      new THREE.Vector3(0.13, 0.205, -0.26),
    ]);
    engineGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(headerCurve, 14, headerCount === 4 ? 0.015 : 0.02, 8, false)),
        titaniumPipeMat,
      ),
    );
  }

  // Custom Exhaust Muffler Assembly (Driven by mods.exhaust & spec.exhaustStyle!)
  const flamePos = new THREE.Vector3(0.19, 0.41, -0.78);
  const useTwinBelly =
    mods.exhaust === 'dual-underbelly' ||
    (mods.exhaust === 'oem' && (spec.exhaustStyle === 'underbelly' || spec.exhaustStyle === 'twin-belly'));

  if (mods.exhaust === 'akrapovic-carbon') {
    // Hexagonal Woven Carbon GP Canister + Titanium Endcap + Badge Band
    const akraCanGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.056, 0.44, 6));
    akraCanGeo.rotateX(Math.PI / 2 - 0.42);
    akraCanGeo.rotateZ(-0.07);
    const akraCan = new THREE.Mesh(akraCanGeo, matteCarbon);
    akraCan.position.set(0.19, 0.37, -0.45);
    const akraShield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.045, 0.12)), matteCarbon);
    akraShield.position.set(0.17, 0.24, -0.28);
    akraShield.rotation.x = -0.35;
    const akraBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.036, 6)), brakeCaliperMat);
    akraBand.rotation.x = Math.PI / 2 - 0.42;
    akraBand.rotation.z = -0.07;
    akraBand.position.set(0.184, 0.34, -0.4);
    const akraTipGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.048, 0.08, 6));
    akraTipGeo.rotateX(Math.PI / 2 - 0.42);
    akraTipGeo.rotateZ(-0.07);
    const akraTip = new THREE.Mesh(akraTipGeo, titaniumPipeMat);
    akraTip.position.set(0.202, 0.46, -0.63);
    engineGroup.add(akraCan, akraShield, akraBand, akraTip);
    flamePos.set(0.205, 0.47, -0.78);
  } else if (mods.exhaust === 'sc-titanium') {
    // Conical MotoGP Shorty Titanium + Iridescent Burnt-Blue Tip
    const scBodyGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.034, 0.28, 18));
    scBodyGeo.rotateX(Math.PI / 2 - 0.45);
    scBodyGeo.rotateZ(-0.08);
    const scBody = new THREE.Mesh(scBodyGeo, titaniumPipeMat);
    scBody.position.set(0.18, 0.32, -0.38);
    const scTipGeo = trackGeo(new THREE.CylinderGeometry(0.046, 0.05, 0.055, 18));
    scTipGeo.rotateX(Math.PI / 2 - 0.45);
    scTipGeo.rotateZ(-0.08);
    const scTip = new THREE.Mesh(scTipGeo, burntBlueTipMat);
    scTip.position.set(0.19, 0.38, -0.5);
    const scMeshGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 16));
    scMeshGeo.rotateX(Math.PI / 2 - 0.45);
    scMeshGeo.rotateZ(-0.08);
    const scMesh = new THREE.Mesh(scMeshGeo, engineDarkMat);
    scMesh.position.set(0.193, 0.39, -0.52);
    engineGroup.add(scBody, scTip, scMesh);
    flamePos.set(0.198, 0.41, -0.68);
  } else if (useTwinBelly) {
    const bellyCanGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.048, 0.32, 14));
    bellyCanGeo.rotateX(Math.PI / 2 - 0.12);
    const bellyCan = new THREE.Mesh(bellyCanGeo, titaniumPipeMat);
    bellyCan.position.set(0.155, 0.225, -0.34);
    const tipGeo = trackGeo(new THREE.CylinderGeometry(0.034, 0.042, 0.065, 14));
    tipGeo.rotateX(Math.PI / 2 - 0.12);
    const tip = new THREE.Mesh(tipGeo, matteCarbon);
    tip.position.set(0.155, 0.245, -0.51);
    engineGroup.add(bellyCan, tip);

    if (mods.exhaust === 'dual-underbelly' || spec.exhaustStyle === 'twin-belly') {
      const bellyL = bellyCan.clone();
      bellyL.position.x = -0.155;
      const tipL = tip.clone();
      tipL.position.x = -0.155;
      engineGroup.add(bellyL, tipL);
    }
    flamePos.set(0.155, 0.25, -0.66);
  } else if (spec.exhaustStyle === 'dual-stacked') {
    // CBR250RR Twin-Stacked Shotgun Right-Side Mufflers
    const pipeGeo = trackGeo(new THREE.CylinderGeometry(0.028, 0.034, 0.4, 14));
    pipeGeo.rotateX(Math.PI / 2 - 0.35);
    pipeGeo.rotateZ(-0.06);
    const tipGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.029, 0.05, 14));
    tipGeo.rotateX(Math.PI / 2 - 0.35);
    tipGeo.rotateZ(-0.06);
    for (let s = 0; s < 2; s++) {
      const pipe = new THREE.Mesh(pipeGeo, engineDarkMat);
      pipe.position.set(0.185, 0.31 + s * 0.068, -0.43 - s * 0.015);
      const tip = new THREE.Mesh(tipGeo, alloySilverMat);
      tip.position.set(0.197, 0.382 + s * 0.068, -0.61 - s * 0.015);
      engineGroup.add(pipe, tip);
    }
    const shield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.018, 0.08, 0.18)), matteCarbon);
    shield.position.set(0.205, 0.32, -0.37);
    shield.rotation.x = -0.35;
    engineGroup.add(shield);
    flamePos.set(0.198, 0.42, -0.76);
  } else if (spec.exhaustStyle === 'titanium-under-mid') {
    // YZF-R1M Compact Titanium Mid-Shorty Muffler + Carbon Heat Guard
    const r1CanGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.042, 0.3, 12));
    r1CanGeo.rotateX(Math.PI / 2 - 0.36);
    r1CanGeo.rotateZ(-0.06);
    const r1Can = new THREE.Mesh(r1CanGeo, titaniumPipeMat);
    r1Can.position.set(0.185, 0.33, -0.39);
    const r1Guard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.07, 0.16)), matteCarbon);
    r1Guard.position.set(0.195, 0.28, -0.29);
    r1Guard.rotation.x = -0.36;
    const r1TipGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.05, 0.06, 12));
    r1TipGeo.rotateX(Math.PI / 2 - 0.36);
    r1TipGeo.rotateZ(-0.06);
    const r1Tip = new THREE.Mesh(r1TipGeo, engineDarkMat);
    r1Tip.position.set(0.195, 0.39, -0.53);
    engineGroup.add(r1Can, r1Guard, r1Tip);
    flamePos.set(0.198, 0.41, -0.7);
  } else {
    // Stock OEM Side Muffler + Brushed Heat Shield
    const mufflerGeo = trackGeo(new THREE.CylinderGeometry(0.044, 0.054, 0.42, 14));
    mufflerGeo.rotateX(Math.PI / 2 - 0.38);
    mufflerGeo.rotateZ(-0.07);
    const muffler = new THREE.Mesh(mufflerGeo, spec.exhaustStyle === 'dual-port' ? alloySilverMat : engineDarkMat);
    muffler.position.set(0.185, 0.35, -0.44);
    const shield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.024, 0.065, 0.24)), alloySilverMat);
    shield.position.set(0.21, 0.34, -0.42);
    shield.rotation.x = -0.38;
    const tipCapGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.045, 0.075, 14));
    tipCapGeo.rotateX(Math.PI / 2 - 0.38);
    tipCapGeo.rotateZ(-0.07);
    const tipCap = new THREE.Mesh(tipCapGeo, alloySilverMat);
    tipCap.position.set(0.198, 0.43, -0.62);
    engineGroup.add(muffler, shield, tipCap);
  }

  // Nitro Flame Cone
  const flameGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.42, 12));
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = trackMat(new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.85 }));
  const nitroFlameMesh = new THREE.Mesh(flameGeo, flameMat);
  nitroFlameMesh.position.copy(flamePos);
  nitroFlameMesh.visible = false;
  chassisPivot.add(nitroFlameMesh);

  // =========================================================================
  // 3. REALISTIC SCULPTED SPORTBIKE BODYWORK (LOFTED SHELLS + MODEL SIGNATURES)
  // =========================================================================
  const bodyGroup = new THREE.Group();
  chassisPivot.add(bodyGroup);

  const fw = spec.fairingWidthScale;
  const th = spec.tankHeightScale;

  // Per-Model Distinct Fairing Silhouettes (no two bikes share the same body shell!)
  const isNarrowBullet = spec.id === 'gsxr150';
  const isRSeries = spec.id === 'r15m' || spec.id === 'r1m';
  const isCbrSharp = spec.id === 'cbr150r' || spec.id === 'cbr250rr';
  const isWideNinja = spec.id === 'zx25r';
  const isBmwM = spec.id === 's1000rr';
  const isDucatiV4 = spec.id === 'v4r';

  // 3A. Model-Specific Sculpted Fuel Tank
  const tankShoulderW = isNarrowBullet ? 0.12 : isWideNinja ? 0.168 : isDucatiV4 || isBmwM || spec.id === 'r1m' ? 0.164 : 0.145 * fw;
  const tankPeakY = (isDucatiV4 ? 0.95 : isWideNinja ? 0.94 : isCbrSharp ? 0.91 : 0.925) * th;
  const tankShellGeo = trackGeo(
    createLoftedShellGeometry([
      {
        z: -0.17,
        ring: symmetricRing([
          [0.0, 0.775],
          [0.082, 0.755],
          [0.088, 0.695],
          [0.0, 0.688],
        ]),
      },
      {
        z: -0.05,
        ring: symmetricRing([
          [0.0, (isCbrSharp ? 0.84 : 0.865) * th],
          [0.095, 0.815 * th],
          [0.105, 0.72],
          [0.0, 0.69],
        ]),
      },
      {
        z: 0.08,
        ring: symmetricRing([
          [0.0, tankPeakY],
          [tankShoulderW, 0.88 * th],
          [tankShoulderW + 0.012, 0.745],
          [0.0, 0.7],
        ]),
      },
      {
        z: 0.21,
        ring: symmetricRing([
          [0.0, tankPeakY - 0.025],
          [tankShoulderW * 0.88, 0.845 * th],
          [tankShoulderW * 0.92, 0.745],
          [0.0, 0.72],
        ]),
      },
      {
        z: 0.31,
        ring: symmetricRing([
          [0.0, 0.855 * th],
          [0.084, 0.815],
          [0.09, 0.745],
          [0.0, 0.735],
        ]),
      },
    ]),
  );
  const tankMesh = new THREE.Mesh(tankShellGeo, spec.id === 'r1m' ? alloySilverMat : paintPrimary);
  tankMesh.castShadow = enableShadows;
  bodyGroup.add(tankMesh);

  // Tank center carbon pad + aircraft-style alloy fuel cap
  const tankPad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.016, 0.16)), matteCarbon);
  tankPad.position.set(0, 0.845 * th, -0.06);
  tankPad.rotation.x = 0.42;
  const fuelCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.04, 0.014, 18)), alloySilverMat);
  fuelCap.position.set(0, tankPeakY - 0.008, 0.11);
  fuelCap.rotation.x = 0.06;
  const fuelCapInner = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 12)), engineDarkMat);
  fuelCapInner.position.copy(fuelCap.position);
  fuelCapInner.rotation.x = 0.06;
  bodyGroup.add(tankPad, fuelCap, fuelCapInner);

  // 3B. Model-Specific Lofted Front Upper Cowl (authentic steep downward-sloped sportbike nose, zero duck-bill overhang)
  const noseLengthZ =
    spec.id === 'cbr250rr'
      ? 0.695
      : isDucatiV4 || isWideNinja
        ? 0.682
        : isBmwM
          ? 0.675
          : spec.id === 'r1m'
            ? 0.665
            : isNarrowBullet
              ? 0.688
              : 0.674;
  const noseTipWidth =
    isBmwM || spec.id === 'r1m'
      ? 0.126 * fw
      : isWideNinja || isDucatiV4
        ? 0.118 * fw
        : isNarrowBullet
          ? 0.08 * fw
          : spec.id === 'cbr250rr'
            ? 0.098 * fw
            : 0.102 * fw;
  const noseTopY = isBmwM ? 0.695 : spec.id === 'r1m' ? 0.69 : spec.id === 'cbr250rr' ? 0.668 : 0.68;
  const noseBotY = isBmwM || spec.id === 'r1m' ? 0.598 : spec.id === 'cbr250rr' ? 0.588 : 0.596;
  const cheekShoulderW = isWideNinja ? 0.198 : isDucatiV4 || isBmwM ? 0.192 : isNarrowBullet ? 0.152 : 0.182;

  const upperNoseGeo = trackGeo(
    createLoftedShellGeometry([
      {
        z: 0.22,
        ring: symmetricRing([
          [0.0, isRSeries ? 0.85 : 0.842],
          [0.126 * fw, 0.81],
          [cheekShoulderW * fw, 0.695],
          [0.16 * fw, 0.54],
          [0.0, 0.56],
        ]),
      },
      {
        z: 0.38,
        ring: symmetricRing([
          [0.0, isBmwM ? 0.84 : 0.826],
          [0.128 * fw, 0.794],
          [(cheekShoulderW + 0.004) * fw, 0.685],
          [0.158 * fw, 0.545],
          [0.0, 0.565],
        ]),
      },
      {
        z: 0.51,
        ring: symmetricRing([
          [0.0, isBmwM ? 0.785 : 0.77],
          [0.118 * fw, 0.745],
          [(cheekShoulderW - 0.015) * fw, 0.668],
          [0.136 * fw, 0.565],
          [0.0, 0.578],
        ]),
      },
      {
        z: 0.6,
        ring: symmetricRing([
          [0.0, isCbrSharp ? 0.722 : 0.732],
          [0.102 * fw, 0.708],
          [noseTipWidth + 0.028, 0.645],
          [0.106 * fw, 0.582],
          [0.0, 0.59],
        ]),
      },
      {
        z: noseLengthZ,
        ring: symmetricRing([
          [0.0, noseTopY],
          [noseTipWidth * 0.82, noseTopY - 0.012],
          [noseTipWidth, (noseTopY + noseBotY) * 0.5],
          [noseTipWidth * 0.68, noseBotY],
          [0.0, noseBotY + 0.008],
        ]),
      },
    ]),
  );
  const upperNose = new THREE.Mesh(upperNoseGeo, paintPrimary);
  upperNose.castShadow = enableShadows;
  bodyGroup.add(upperNose);

  // Lower Nose Chin Spoiler / Ram-Air Lip (bridges nose bottom cleanly over front wheel fender)
  const chinLip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(noseTipWidth * 1.45, 0.022, 0.085)),
    matteCarbon,
  );
  chinLip.position.set(0, noseBotY + 0.002, noseLengthZ - 0.032);
  chinLip.rotation.x = 0.22;
  bodyGroup.add(chinLip);

  // 3C. Model-Specific Seamless 3D Lofted Side Fairing + Tank Knee Shrouds + Belly Pan
  const sideTopY = isWideNinja || isDucatiV4 ? 0.705 : isBmwM ? 0.685 : isNarrowBullet ? 0.66 : 0.692;
  const sideMidX = isWideNinja ? 0.198 : isNarrowBullet ? 0.155 : isDucatiV4 ? 0.194 : 0.185;
  const sideFrontZ = isWideNinja || spec.id === 'r1m' ? 0.615 : isBmwM ? 0.59 : 0.605;

  const sideFairingShellGeo = trackGeo(
    createLoftedShellGeometry([
      {
        z: isWideNinja ? -0.17 : -0.13,
        ring: symmetricRing([
          [0.095 * fw, isBmwM ? 0.34 : 0.36],
          [0.132 * fw, 0.285],
          [0.118 * fw, 0.205],
          [0.0, 0.195],
        ]),
      },
      {
        z: 0.06,
        ring: symmetricRing([
          [0.132 * fw, isBmwM ? 0.575 : 0.61],
          [0.172 * fw, 0.45],
          [0.142 * fw, 0.24],
          [0.0, 0.205],
        ]),
      },
      {
        z: 0.25,
        ring: symmetricRing([
          [0.145 * fw, sideTopY],
          [sideMidX * fw, 0.56],
          [0.158 * fw, 0.31],
          [0.0, 0.235],
        ]),
      },
      {
        z: 0.43,
        ring: symmetricRing([
          [0.145 * fw, sideTopY + 0.008],
          [(sideMidX - 0.005) * fw, 0.575],
          [0.148 * fw, 0.385],
          [0.0, 0.33],
        ]),
      },
      {
        z: sideFrontZ,
        ring: symmetricRing([
          [0.116 * fw, sideTopY - 0.012],
          [0.134 * fw, 0.585],
          [0.104 * fw, 0.485],
          [0.0, 0.46],
        ]),
      },
    ]),
  );
  const sideFairingShell = new THREE.Mesh(sideFairingShellGeo, paintPrimary);
  sideFairingShell.castShadow = enableShadows;
  bodyGroup.add(sideFairingShell);

  // Sculpted Tank-to-Fairing Knee Shrouds (closes tank-frame transition cleanly)
  for (const side of [-1, 1]) {
    const kneeShroud = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.11, 0.24)),
      isBmwM || isRSeries || isDucatiV4 ? paintSecondary : paintPrimary,
    );
    kneeShroud.position.set(side * (tankShoulderW * 0.88), 0.725, 0.09);
    kneeShroud.rotation.x = 0.24;
    kneeShroud.rotation.y = side * 0.12;
    kneeShroud.rotation.z = side * -0.18;
    bodyGroup.add(kneeShroud);
  }

  // Lower sculpted aerodynamic chin & belly pan
  const bellyPanGeo = trackGeo(
    createLoftedShellGeometry([
      {
        z: -0.22,
        ring: symmetricRing([
          [0.095 * fw, 0.28],
          [0.115 * fw, 0.22],
          [0.085 * fw, 0.18],
          [0.0, 0.175],
        ]),
      },
      {
        z: 0.05,
        ring: symmetricRing([
          [0.132 * fw, 0.31],
          [0.145 * fw, 0.235],
          [0.11 * fw, 0.19],
          [0.0, 0.185],
        ]),
      },
      {
        z: 0.3,
        ring: symmetricRing([
          [0.132 * fw, 0.36],
          [0.145 * fw, 0.28],
          [0.105 * fw, 0.225],
          [0.0, 0.22],
        ]),
      },
    ]),
  );
  bodyGroup.add(new THREE.Mesh(bellyPanGeo, isDucatiV4 ? paintPrimary : paintSecondary));

  // Model-specific Side Fairing Aero Vents, Louvers, Tri-Color Accents & Carbon Winglets
  for (const side of [-1, 1]) {
    if (isBmwM) {
      // BMW M 1000 RR: Asymmetrical carbon air-outlet + 3 diagonal shark-gill louvers + M Motorsport stripes
      const gillPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.01, 0.125, 0.115)), matteCarbon);
      gillPanel.position.set(side * (sideMidX + 0.004) * fw, 0.475, 0.19);
      gillPanel.rotation.y = side * 0.08;
      gillPanel.rotation.z = side * -0.14;
      bodyGroup.add(gillPanel);

      for (let g = 0; g < 3; g++) {
        const louver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.014, 0.095)), paintPrimary);
        louver.position.set(side * (sideMidX + 0.01) * fw, 0.538 - g * 0.032, 0.21 - g * 0.016);
        louver.rotation.x = 0.36;
        louver.rotation.y = side * 0.06;
        bodyGroup.add(louver);
      }

      const mBlue = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.008, 0.018, 0.32)),
        trackMat(new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.2 })),
      );
      mBlue.position.set(side * (sideMidX + 0.007) * fw, 0.585, 0.29);
      mBlue.rotation.x = -0.06;
      mBlue.rotation.y = side * 0.05;
      const mNavy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.008, 0.015, 0.29)),
        trackMat(new THREE.MeshStandardMaterial({ color: '#1E3A8A', roughness: 0.2 })),
      );
      mNavy.position.set(side * (sideMidX + 0.006) * fw, 0.567, 0.28);
      mNavy.rotation.x = -0.06;
      mNavy.rotation.y = side * 0.05;
      const mRed = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.008, 0.015, 0.26)),
        trackMat(new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.2 })),
      );
      mRed.position.set(side * (sideMidX + 0.005) * fw, 0.55, 0.27);
      mRed.rotation.x = -0.06;
      mRed.rotation.y = side * 0.05;
      bodyGroup.add(mBlue, mNavy, mRed);
    } else if (isDucatiV4) {
      // Ducati Panigale V4R: Twin deep sculpted horizontal/angled side extractor gills
      for (let g = 0; g < 2; g++) {
        const extractor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.032, 0.14)), matteCarbon);
        extractor.position.set(side * (sideMidX + 0.006) * fw, 0.54 - g * 0.06, 0.24 - g * 0.02);
        extractor.rotation.x = 0.28;
        extractor.rotation.y = side * 0.07;
        bodyGroup.add(extractor);
      }
      const ducatiStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.016, 0.28)), paintAccent);
      ducatiStrip.position.set(side * (sideMidX + 0.007) * fw, 0.59, 0.31);
      ducatiStrip.rotation.y = side * 0.06;
      bodyGroup.add(ducatiStrip);
    } else if (spec.id === 'cbr250rr') {
      // Honda CBR250RR: Layered tri-wing stealth fairing creases + sharp cheek vent
      for (let layer = 0; layer < 2; layer++) {
        const blade = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.012, 0.022, 0.22)),
          layer === 0 ? paintSecondary : paintAccent,
        );
        blade.position.set(side * (sideMidX + 0.007) * fw, 0.595 - layer * 0.042, 0.34 - layer * 0.04);
        blade.rotation.x = -0.24;
        blade.rotation.y = side * 0.07;
        bodyGroup.add(blade);
      }
      const vent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.01, 0.1, 0.09)), engineDarkMat);
      vent.position.set(side * (sideMidX + 0.003) * fw, 0.47, 0.18);
      vent.rotation.z = side * -0.14;
      bodyGroup.add(vent);
    } else if (spec.id === 'r1m') {
      // Yamaha YZF-R1M: Carbon M1 flank scoop + deep racing blue accent bar
      const carbonFlank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.01, 0.14, 0.15)), matteCarbon);
      carbonFlank.position.set(side * (sideMidX + 0.004) * fw, 0.49, 0.2);
      carbonFlank.rotation.y = side * 0.07;
      carbonFlank.rotation.z = side * -0.14;
      const r1mStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.009, 0.022, 0.34)), paintAccent);
      r1mStripe.position.set(side * (sideMidX + 0.007) * fw, 0.58, 0.29);
      r1mStripe.rotation.x = -0.06;
      r1mStripe.rotation.y = side * 0.05;
      bodyGroup.add(carbonFlank, r1mStripe);
    } else {
      // R15M / CBR150R / ZX-25R / GSX-R150 clean sculpted side vent & racing stripe
      const gillPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.009, 0.105, 0.1)), paintSecondary);
      gillPanel.position.set(side * (sideMidX + 0.003) * fw, 0.475, 0.19);
      gillPanel.rotation.y = side * 0.08;
      gillPanel.rotation.z = side * -0.14;
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.018, 0.3)), paintAccent);
      stripe.position.set(side * (sideMidX + 0.006) * fw, 0.575, 0.28);
      stripe.rotation.x = -0.06;
      stripe.rotation.y = side * 0.05;
      bodyGroup.add(gillPanel, stripe);
    }

    // MotoGP Bi-Plane Carbon Winglets (ZX-25RR / BMW M1000RR / Panigale V4R)
    if (spec.hasWinglets) {
      const wingUpperGeo = trackGeo(
        createCurvedExtrude((s) => {
          s.moveTo(0, 0);
          s.lineTo(isBmwM ? 0.17 : isDucatiV4 ? 0.15 : 0.115, 0.014);
          s.lineTo(isBmwM ? 0.12 : isDucatiV4 ? 0.105 : 0.08, 0.078);
          s.lineTo(0, 0.045);
          s.closePath();
        }, 0.009, 0.003),
      );
      wingUpperGeo.rotateX(Math.PI / 2);
      const wingUpper = new THREE.Mesh(wingUpperGeo, matteCarbon);
      wingUpper.scale.x = side;
      wingUpper.position.set(side * 0.172 * fw, 0.648, 0.45);
      wingUpper.rotation.z = side * -0.12;
      bodyGroup.add(wingUpper);

      if (isDucatiV4 || isBmwM) {
        const wingLower = new THREE.Mesh(wingUpperGeo, matteCarbon);
        wingLower.scale.set(side * 0.85, 0.85, 1);
        wingLower.position.set(side * 0.168 * fw, 0.592, 0.43);
        wingLower.rotation.z = side * -0.16;
        bodyGroup.add(wingLower);
      }
    }
  }

  // 3D. Per-Model Authentic Headlight Optics recessed inside sloped front fascia (mods.light!)
  const hlZ = noseLengthZ - 0.008;
  const hlY = (noseTopY + noseBotY) * 0.5 + 0.006;

  const noseMask = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(noseTipWidth * 1.75, 0.058, 0.03)),
    engineDarkMat,
  );
  noseMask.position.set(0, hlY, hlZ);
  noseMask.rotation.x = 0.34;
  bodyGroup.add(noseMask);

  const lensCover = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(noseTipWidth * 1.78, 0.06, 0.006)),
    lensCoverMat,
  );
  lensCover.position.set(0, hlY - 0.003, hlZ + 0.018);
  lensCover.rotation.x = 0.34;
  bodyGroup.add(lensCover);

  if (spec.headlightStyle === 'mono-projector') {
    // R15M M-Duct Center Projector + Twin Razor Eyebrow DRLs
    const ductRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.022, 0.005, 8, 18)), drlMat);
    ductRing.position.set(0, hlY, hlZ + 0.014);
    ductRing.rotation.x = 0.25;
    const lens = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.017, 14, 14)), headlightMat);
    lens.position.set(0, hlY, hlZ + 0.011);
    bodyGroup.add(ductRing, lens);
    for (const side of [-1, 1]) {
      const drl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.008, 0.012)), drlMat);
      drl.position.set(side * 0.056, hlY + 0.018, hlZ + 0.004);
      drl.rotation.z = side * 0.16;
      drl.rotation.y = side * -0.28;
      bodyGroup.add(drl);
    }
  } else if (spec.headlightStyle === 'r1m-m-duct') {
    // Yamaha YZF-R1M: Wide Carbon M1 Ram-Air Intake + Wide DRL Brows + Recessed Twin Round Projector Pods
    const mDuctOuter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.038, 0.026)), matteCarbon);
    mDuctOuter.position.set(0, hlY + 0.002, hlZ + 0.01);
    const mDuctInner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.024, 0.03)), engineDarkMat);
    mDuctInner.position.set(0, hlY + 0.002, hlZ + 0.014);
    bodyGroup.add(mDuctOuter, mDuctInner);
    for (const side of [-1, 1]) {
      const drl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.078, 0.009, 0.012)), drlMat);
      drl.position.set(side * 0.072, hlY + 0.018, hlZ + 0.004);
      drl.rotation.z = side * 0.18;
      drl.rotation.y = side * -0.26;
      const podHousing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.019, 0.021, 0.024, 12)), engineDarkMat);
      podHousing.rotation.x = Math.PI / 2;
      podHousing.position.set(side * 0.088, hlY - 0.028, hlZ - 0.026);
      const podLens = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.016, 12, 12)), headlightMat);
      podLens.position.set(side * 0.088, hlY - 0.028, hlZ - 0.014);
      bodyGroup.add(drl, podHousing, podLens);
    }
  } else if (spec.headlightStyle === 'bmw-split-kidney') {
    // BMW M 1000 RR: Central Air-Splitter Bridge + Wide Split Symmetrical LED Eyes
    const centerBridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.032, 0.056, 0.032)), paintPrimary);
    centerBridge.position.set(0, hlY, hlZ + 0.01);
    centerBridge.rotation.x = 0.32;
    const intakeHole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.024, 0.034)), engineDarkMat);
    intakeHole.position.set(0, hlY - 0.012, hlZ + 0.012);
    intakeHole.rotation.x = 0.32;
    bodyGroup.add(centerBridge, intakeHole);
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.076, 0.019, 0.014)), headlightMat);
      lamp.position.set(side * 0.068, hlY + 0.006, hlZ + 0.009);
      lamp.rotation.z = side * 0.14;
      lamp.rotation.y = side * -0.24;
      const uDrl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.008, 0.012)), drlMat);
      uDrl.position.set(side * 0.068, hlY - 0.01, hlZ + 0.012);
      uDrl.rotation.z = side * 0.14;
      uDrl.rotation.y = side * -0.24;
      bodyGroup.add(lamp, uDrl);
    }
  } else if (spec.headlightStyle === 'cbr-layered-twin') {
    // Honda CBR250RR: Sharp Dual-Layer Stacked Aggressive LED + Razor Brows
    for (const side of [-1, 1]) {
      const upperBrow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.008, 0.012)), drlMat);
      upperBrow.position.set(side * 0.056, hlY + 0.02, hlZ + 0.004);
      upperBrow.rotation.z = side * 0.24;
      upperBrow.rotation.y = side * -0.28;
      const mainBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.064, 0.015, 0.013)), headlightMat);
      mainBeam.position.set(side * 0.056, hlY + 0.002, hlZ + 0.009);
      mainBeam.rotation.z = side * 0.22;
      mainBeam.rotation.y = side * -0.28;
      const lowerBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.01, 0.013)), headlightMat);
      lowerBeam.position.set(side * 0.052, hlY - 0.015, hlZ + 0.007);
      lowerBeam.rotation.z = side * 0.18;
      lowerBeam.rotation.y = side * -0.28;
      bodyGroup.add(upperBrow, mainBeam, lowerBeam);
    }
  } else if (spec.headlightStyle === 'stacked-vertical') {
    // GSX-R150 Vertical Stacked Twin LED + Flanking Triangle Intakes
    const stack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.056, 0.016)), headlightMat);
    stack.position.set(0, hlY, hlZ + 0.012);
    stack.rotation.x = 0.34;
    bodyGroup.add(stack);
    for (const side of [-1, 1]) {
      const scoop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.026, 0.018, 0.014)), drlMat);
      scoop.position.set(side * 0.046, hlY, hlZ + 0.008);
      scoop.rotation.y = side * -0.3;
      bodyGroup.add(scoop);
    }
  } else {
    // CBR150R / ZX-25R / Panigale V4R Slanted Twin-Eye LED + Center Ram-Air Scoop
    if (spec.headlightStyle === 'ram-air-twin') {
      const scoop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.058, 0.032, 0.028)), engineDarkMat);
      scoop.position.set(0, hlY - 0.008, hlZ + 0.01);
      scoop.rotation.x = 0.28;
      bodyGroup.add(scoop);
    }
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.016, 0.013)), headlightMat);
      lamp.position.set(side * 0.056, hlY, hlZ + 0.009);
      lamp.rotation.z = side * 0.18;
      lamp.rotation.y = side * -0.28;
      const brow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.007, 0.012)), drlMat);
      brow.position.set(side * 0.057, hlY + 0.014, hlZ + 0.006);
      brow.rotation.z = side * 0.2;
      brow.rotation.y = side * -0.28;
      bodyGroup.add(lamp, brow);
    }
  }

  // Double-Bubble Tinted Windscreen (seated cleanly into the upper nose cowl brow)
  const visorHeight = isBmwM || isDucatiV4 ? 0.26 : 0.22;
  const visorGeo = trackGeo(new THREE.CylinderGeometry(0.114, 0.146, visorHeight, 20, 1, true, -0.88, 1.76));
  const visor = new THREE.Mesh(visorGeo, windscreenMat);
  visor.position.set(0, isBmwM ? 0.85 : 0.835, 0.45);
  visor.rotation.x = isBmwM ? -0.94 : -1.0;
  bodyGroup.add(visor);

  // Aerodynamic Wing Mirrors with Amber LED Signal Strips
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.105, 0.01, 0.014)), engineDarkMat);
    stalk.position.set(side * 0.15, 0.915, 0.45);
    stalk.rotation.z = side * 0.36;
    const mirrorHead = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.034, 0.02)), matteCarbon);
    mirrorHead.position.set(side * 0.21, 0.945, 0.44);
    mirrorHead.rotation.y = side * 0.26;
    const mirrorSignal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.008, 0.008)), amberSignalMat);
    mirrorSignal.position.set(side * 0.213, 0.945, 0.452);
    mirrorSignal.rotation.y = side * 0.26;
    bodyGroup.add(stalk, mirrorHead, mirrorSignal);
  }

  // Split Rider & Pillion Seat
  const riderSeat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.205, 0.042, 0.3)), seatLeatherMat);
  riderSeat.position.set(0, 0.715, -0.22);
  riderSeat.rotation.x = 0.08;
  const pillionSeat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.145, 0.04, 0.21)), seatLeatherMat);
  pillionSeat.position.set(0, 0.805, -0.52);
  pillionSeat.rotation.x = -0.22;
  bodyGroup.add(riderSeat, pillionSeat);

  // 3E. Model-Specific Sculpted Tail Cowl + Aero Ducts
  const tailTipY = isRSeries || isBmwM || isDucatiV4 ? 0.915 : isNarrowBullet ? 0.88 : 0.895;
  const tailTipW = isDucatiV4 ? 0.052 : isBmwM ? 0.036 : 0.044;
  const tailShellGeo = trackGeo(
    createLoftedShellGeometry([
      {
        z: -0.84,
        ring: symmetricRing([
          [0.0, tailTipY],
          [tailTipW, tailTipY - 0.008],
          [tailTipW + 0.004, tailTipY - 0.045],
          [0.0, tailTipY - 0.05],
        ]),
      },
      {
        z: -0.68,
        ring: symmetricRing([
          [0.0, 0.882],
          [isWideNinja ? 0.095 : 0.084, 0.862],
          [0.08, 0.79],
          [0.0, 0.78],
        ]),
      },
      {
        z: -0.5,
        ring: symmetricRing([
          [0.0, 0.825],
          [0.105, 0.81],
          [0.095, 0.74],
          [0.0, 0.73],
        ]),
      },
      {
        z: -0.34,
        ring: symmetricRing([
          [0.0, 0.76],
          [0.105, 0.75],
          [0.095, 0.7],
          [0.0, 0.69],
        ]),
      },
    ]),
  );
  const tailCowl = new THREE.Mesh(tailShellGeo, paintPrimary);
  tailCowl.castShadow = enableShadows;
  bodyGroup.add(tailCowl);

  // Side tail air-duct accent wings (R15M / R1M / V4R aero tail buttress vs compact side plates)
  for (const side of [-1, 1]) {
    const tailWing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.015, isRSeries || isDucatiV4 ? 0.048 : 0.032, 0.24)),
      isRSeries || isDucatiV4 ? paintSecondary : paintPrimary,
    );
    tailWing.position.set(side * (isRSeries || isDucatiV4 ? 0.098 : 0.084), 0.845, -0.64);
    tailWing.rotation.x = -0.24;
    tailWing.rotation.y = side * (isRSeries || isDucatiV4 ? 0.22 : 0.12);
    bodyGroup.add(tailWing);
  }

  const taillight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.095, 0.024, 0.024)), taillightMat);
  taillight.position.set(0, tailTipY - 0.025, -0.835);
  const tailFender = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.042, 0.17, 0.022)), engineDarkMat);
  tailFender.position.set(0, 0.74, -0.84);
  tailFender.rotation.x = 0.55;
  const plate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.125, 0.072, 0.01)), paintSecondary);
  plate.position.set(0, 0.67, -0.9);
  plate.rotation.x = 0.45;
  bodyGroup.add(taillight, tailFender, plate);

  for (const side of [-1, 1]) {
    const rearBlinker = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.034, 0.015, 0.018)), amberSignalMat);
    rearBlinker.position.set(side * 0.082, 0.74, -0.86);
    bodyGroup.add(rearBlinker);
  }

  // =========================================================================
  // 4. STEERING ASSEMBLY: USD FORKS, STANG JEPIT, TFT DASH & FRONT WHEEL
  // =========================================================================
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0, 0.85, 0.4);
  chassisPivot.add(steeringPivot);

  const forkAssembly = new THREE.Group();
  forkAssembly.rotation.x = -0.41;
  steeringPivot.add(forkAssembly);

  const clampGeo = trackGeo(new THREE.BoxGeometry(0.21, 0.024, 0.075));
  const upperClamp = new THREE.Mesh(clampGeo, engineDarkMat);
  const lowerClamp = new THREE.Mesh(clampGeo, engineDarkMat);
  lowerClamp.position.y = -0.18;
  forkAssembly.add(upperClamp, lowerClamp);

  const forkOuterGeo = trackGeo(new THREE.CylinderGeometry(0.023, 0.023, 0.4, 14));
  const forkInnerGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 14));
  for (const side of [-1, 1]) {
    const outer = new THREE.Mesh(forkOuterGeo, forkOuterMat);
    outer.position.set(side * 0.092, -0.19, 0);
    const inner = new THREE.Mesh(forkInnerGeo, chromeMat);
    inner.position.set(side * 0.092, -0.45, 0);
    forkAssembly.add(outer, inner);
  }

  const frontCaliperLeft = new THREE.Mesh(caliperGeo, brakeCaliperMat);
  frontCaliperLeft.position.set(-0.08, -0.53, -0.062);
  forkAssembly.add(frontCaliperLeft);
  if (spec.id === 'zx25r' || spec.id === 'v4r') {
    const frontCaliperRight = new THREE.Mesh(caliperGeo, brakeCaliperMat);
    frontCaliperRight.position.set(0.08, -0.53, -0.062);
    forkAssembly.add(frontCaliperRight);
  }

  const frontWheelSpin = buildWheel(true);
  const dxZ = frontWheelPosZ - steeringPivot.position.z;
  const dy = wheelRadius - steeringPivot.position.y;
  const cosA = Math.cos(0.41);
  const sinA = Math.sin(0.41);
  const localY = dy * cosA - dxZ * sinA;
  const localZ = dy * sinA + dxZ * cosA;
  frontWheelSpin.position.set(0, localY, localZ);
  forkAssembly.add(frontWheelSpin);

  const frontFenderGeo = trackGeo(new THREE.CylinderGeometry(0.322, 0.322, 0.138, 18, 1, true, 0.85, 1.45));
  frontFenderGeo.rotateZ(Math.PI / 2);
  const frontFenderMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.primary,
      metalness: 0.42,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  const frontFender = new THREE.Mesh(frontFenderGeo, frontFenderMat);
  frontFender.position.set(0, localY, localZ);
  forkAssembly.add(frontFender);

  // CLIP-ON HANDLEBARS (STANG JEPIT), GRIPS, LEVERS & TFT CLUSTER
  const stangGroup = new THREE.Group();
  stangGroup.position.set(0, 0.02, -0.02);
  steeringPivot.add(stangGroup);

  for (const side of [-1, 1]) {
    const barGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.185, 10));
    barGeo.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, alloySilverMat);
    bar.position.set(side * 0.17, -0.01, -0.025);
    bar.rotation.y = side * -0.32;
    bar.rotation.z = side * -0.14;
    stangGroup.add(bar);

    const gripGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.115, 12));
    gripGeo.rotateZ(Math.PI / 2);
    const grip = new THREE.Mesh(gripGeo, rubberMat);
    grip.position.set(side * 0.22, -0.02, -0.044);
    grip.rotation.y = side * -0.32;
    grip.rotation.z = side * -0.14;
    stangGroup.add(grip);

    const endGeo = trackGeo(new THREE.CylinderGeometry(0.017, 0.017, 0.022, 10));
    endGeo.rotateZ(Math.PI / 2);
    const barEnd = new THREE.Mesh(endGeo, paintAccent);
    barEnd.position.set(side * 0.28, -0.028, -0.064);
    barEnd.rotation.y = side * -0.32;
    stangGroup.add(barEnd);

    const lever = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.009, 0.014)), alloySilverMat);
    lever.position.set(side * 0.21, -0.018, 0.012);
    lever.rotation.y = side * -0.18;
    stangGroup.add(lever);
  }

  const reservoir = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10)), windscreenMat);
  reservoir.position.set(0.135, 0.032, 0.012);
  stangGroup.add(reservoir);

  const dashHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.078, 0.022)), engineDarkMat);
  dashHousing.position.set(0, 0.045, 0.068);
  dashHousing.rotation.x = -0.58;
  const dashScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.124, 0.062)), tftMat);
  dashScreen.position.set(0, 0.045, 0.055);
  dashScreen.rotation.y = Math.PI;
  dashScreen.rotation.x = 0.58;
  stangGroup.add(dashHousing, dashScreen);

  // =========================================================================
  // 5. ARTICULATED 3D RACING RIDER (FULL-FACE HELMET + RACING SUIT)
  // =========================================================================
  const riderSuitPrimary = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#151821',
      roughness: 0.68,
      metalness: 0.08,
    }),
  );
  const riderSuitAccent = trackMat(
    new THREE.MeshStandardMaterial({
      color: livery.accent,
      roughness: 0.52,
      metalness: 0.14,
    }),
  );
  const helmetShellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.primary,
      metalness: 0.35,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
  );
  const helmetVisorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#090D16',
      metalness: 0.45,
      roughness: 0.06,
      clearcoat: 1.0,
    }),
  );
  const sliderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F8FAFC',
      roughness: 0.4,
      metalness: 0.1,
    }),
  );

  const upVec = new THREE.Vector3(0, 1, 0);
  const addLimbSegment = (
    parent: THREE.Object3D,
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    mat: THREE.Material,
  ) => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const dist = dir.length();
    const cylLen = Math.max(0.01, dist - radius * 1.1);
    const geo = trackGeo(new THREE.CapsuleGeometry(radius, cylLen, 6, 12));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.addVectors(start, end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(upVec, dir.normalize());
    mesh.castShadow = enableShadows;
    parent.add(mesh);
    return mesh;
  };

  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.75, -0.23);
  chassisPivot.add(riderGroup);

  const pelvis = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.1, 0.08, 6, 12)), riderSuitPrimary);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(0.85, 1.0, 0.92);
  pelvis.castShadow = enableShadows;
  riderGroup.add(pelvis);

  const bootGeo = trackGeo(new THREE.BoxGeometry(0.078, 0.062, 0.16));
  const kneeSliderGeo = trackGeo(new THREE.CapsuleGeometry(0.028, 0.04, 4, 8));

  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(side * 0.105, 0.0, 0.01);
    const knee = new THREE.Vector3(side * 0.165, -0.09, 0.245);
    const ankle = new THREE.Vector3(side * 0.185, -0.355, 0.01);

    addLimbSegment(riderGroup, hip, knee, 0.056, riderSuitPrimary);
    addLimbSegment(riderGroup, knee, ankle, 0.042, riderSuitPrimary);

    const slider = new THREE.Mesh(kneeSliderGeo, sliderMat);
    slider.position.set(side * 0.188, -0.095, 0.255);
    slider.rotation.x = 0.9;
    slider.rotation.z = side * -0.2;
    riderGroup.add(slider);

    const boot = new THREE.Mesh(bootGeo, riderSuitAccent);
    boot.position.set(side * 0.188, -0.37, 0.03);
    boot.rotation.x = 0.18;
    boot.castShadow = enableShadows;
    riderGroup.add(boot);
  }

  const riderTorsoPivot = new THREE.Group();
  riderTorsoPivot.position.set(0, 0.05, 0.02);
  riderTorsoPivot.rotation.x = 0.54;
  riderGroup.add(riderTorsoPivot);

  const torsoMesh = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.128, 0.25, 8, 14)), riderSuitPrimary);
  torsoMesh.position.set(0, 0.19, 0);
  torsoMesh.scale.set(1.1, 1.0, 0.76);
  torsoMesh.castShadow = enableShadows;
  riderTorsoPivot.add(torsoMesh);

  const chestStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.065, 0.2)), riderSuitAccent);
  chestStripe.position.set(0, 0.27, 0);
  riderTorsoPivot.add(chestStripe);

  const humpGeo = trackGeo(new THREE.CapsuleGeometry(0.062, 0.14, 6, 12));
  const hump = new THREE.Mesh(humpGeo, riderSuitAccent);
  hump.position.set(0, 0.28, -0.088);
  hump.scale.set(0.9, 1.0, 0.7);
  hump.rotation.x = -0.12;
  hump.castShadow = enableShadows;
  riderTorsoPivot.add(hump);

  const gloveGeo = trackGeo(new THREE.SphereGeometry(0.036, 10, 10));
  for (const side of [-1, 1]) {
    const shoulderPos = new THREE.Vector3(side * 0.165, 0.325, 0.02);
    const elbowPos = new THREE.Vector3(side * 0.215, 0.23, 0.22);
    const gripPos = new THREE.Vector3(side * 0.22, 0.32, 0.44);

    const shoulderArmor = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 10, 10)), riderSuitAccent);
    shoulderArmor.position.copy(shoulderPos);
    riderTorsoPivot.add(shoulderArmor);

    addLimbSegment(riderTorsoPivot, shoulderPos, elbowPos, 0.042, riderSuitPrimary);
    addLimbSegment(riderTorsoPivot, elbowPos, gripPos, 0.034, riderSuitPrimary);

    const glove = new THREE.Mesh(gloveGeo, riderSuitAccent);
    glove.position.copy(gripPos);
    glove.scale.set(0.9, 0.85, 1.2);
    riderTorsoPivot.add(glove);
  }

  const riderHeadPivot = new THREE.Group();
  riderHeadPivot.position.set(0, 0.43, 0.035);
  riderHeadPivot.rotation.x = -0.42;
  riderTorsoPivot.add(riderHeadPivot);

  const helmetDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.122, 20, 18)), helmetShellMat);
  helmetDome.scale.set(0.92, 1.02, 1.15);
  helmetDome.castShadow = enableShadows;
  riderHeadPivot.add(helmetDome);

  const chinGuardGeo = trackGeo(
    new THREE.CylinderGeometry(0.112, 0.105, 0.068, 18, 1, false, -0.95, 1.9),
  );
  const chinGuard = new THREE.Mesh(chinGuardGeo, helmetShellMat);
  chinGuard.position.set(0, -0.045, 0.035);
  chinGuard.rotation.x = 0.14;
  riderHeadPivot.add(chinGuard);

  const helmetVisorGeo = trackGeo(
    new THREE.CylinderGeometry(0.121, 0.118, 0.072, 18, 1, true, -0.98, 1.96),
  );
  const helmetVisor = new THREE.Mesh(helmetVisorGeo, helmetVisorMat);
  helmetVisor.position.set(0, 0.008, 0.036);
  riderHeadPivot.add(helmetVisor);

  const helmetSpoiler = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.028, 0.075)), riderSuitAccent);
  helmetSpoiler.position.set(0, 0.055, -0.125);
  helmetSpoiler.rotation.x = 0.38;
  riderHeadPivot.add(helmetSpoiler);

  return {
    root,
    chassisPivot,
    steeringPivot,
    frontWheelSpin,
    rearWheelSpin,
    riderGroup,
    riderTorsoPivot,
    riderHeadPivot,
    taillightMat,
    headlightMat,
    nitroFlameMesh,
    contactShadowMesh,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      localTextures.forEach((t) => t.dispose());
    },
  };
}
