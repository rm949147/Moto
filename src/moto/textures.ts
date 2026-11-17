import * as THREE from 'three';

export interface ProceduralTexturePack {
  roadColor: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  grassColor: THREE.CanvasTexture;
  tireTread: THREE.CanvasTexture;
  carbonFiber: THREE.CanvasTexture;
  brakeDisc: THREE.CanvasTexture;
  gantrySign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  garageFloor: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const aniso = Math.max(1, maxAnisotropy);

  // 1. Realistic 3-lane highway asphalt road texture (512 x 1024)
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 1024;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#20242B';
  rCtx.fillRect(0, 0, 512, 1024);

  // Polished dark tire-wear tracks in each lane
  const wearPositions = [88, 170, 256, 342, 424];
  for (const wx of wearPositions) {
    const grad = rCtx.createLinearGradient(wx - 32, 0, wx + 32, 0);
    grad.addColorStop(0, 'rgba(10,12,16,0)');
    grad.addColorStop(0.5, 'rgba(10,12,16,0.32)');
    grad.addColorStop(1, 'rgba(10,12,16,0)');
    rCtx.fillStyle = grad;
    rCtx.fillRect(wx - 32, 0, 64, 1024);
  }

  // Multi-tone aggregate grain + subtle weathered seams
  for (let i = 0; i < 28000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    const shade = 24 + Math.floor(Math.random() * 38);
    rCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    rCtx.fillRect(x, y, 2, 2);
  }

  // Rumble edge strips + crisp yellow safety lines
  rCtx.fillStyle = '#EAB308';
  rCtx.fillRect(14, 0, 9, 1024);
  rCtx.fillRect(489, 0, 9, 1024);

  // Dashed lane dividers (for 3 lanes at x = 171 and x = 341)
  rCtx.fillStyle = '#F1F5F9';
  for (let y = 24; y < 1024; y += 128) {
    rCtx.fillRect(167, y, 8, 66);
    rCtx.fillRect(337, y, 8, 66);
  }

  const roadColor = new THREE.CanvasTexture(roadCanvas);
  roadColor.colorSpace = THREE.SRGBColorSpace;
  roadColor.wrapS = THREE.RepeatWrapping;
  roadColor.wrapT = THREE.RepeatWrapping;
  roadColor.anisotropy = aniso;

  // 2. Road micro-relief bump + roughness map (linear) for natural asphalt specular sheen
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16000; i++) {
    const v = 72 + Math.floor(Math.random() * 116);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const roadBump = new THREE.CanvasTexture(bumpCanvas);
  roadBump.wrapS = THREE.RepeatWrapping;
  roadBump.wrapT = THREE.RepeatWrapping;
  roadBump.repeat.set(4, 16);
  roadBump.anisotropy = aniso;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rgCtx = roughCanvas.getContext('2d')!;
  rgCtx.fillStyle = '#D8D8D8';
  rgCtx.fillRect(0, 0, 256, 256);
  for (const wx of [44, 85, 128, 171, 212]) {
    const g = rgCtx.createLinearGradient(wx - 16, 0, wx + 16, 0);
    g.addColorStop(0, 'rgba(130,130,130,0)');
    g.addColorStop(0.5, 'rgba(130,130,130,0.45)');
    g.addColorStop(1, 'rgba(130,130,130,0)');
    rgCtx.fillStyle = g;
    rgCtx.fillRect(wx - 16, 0, 32, 256);
  }
  const roadRoughness = new THREE.CanvasTexture(roughCanvas);
  roadRoughness.wrapS = THREE.RepeatWrapping;
  roadRoughness.wrapT = THREE.RepeatWrapping;
  roadRoughness.repeat.set(1, 5);
  roadRoughness.anisotropy = aniso;

  // 3. Roadside lush grass & earth texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#2B4E26';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9500; i++) {
    const g = 58 + Math.floor(Math.random() * 54);
    const r = Math.floor(g * 0.56);
    const b = Math.floor(g * 0.39);
    gCtx.fillStyle = `rgb(${r},${g},${b})`;
    gCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  const grassColor = new THREE.CanvasTexture(grassCanvas);
  grassColor.colorSpace = THREE.SRGBColorSpace;
  grassColor.wrapS = THREE.RepeatWrapping;
  grassColor.wrapT = THREE.RepeatWrapping;
  grassColor.repeat.set(16, 16);
  grassColor.anisotropy = aniso;

  // 4. Tire radial sport tread texture
  const tireCanvas = document.createElement('canvas');
  tireCanvas.width = 256;
  tireCanvas.height = 256;
  const tCtx = tireCanvas.getContext('2d')!;
  tCtx.fillStyle = '#16181D';
  tCtx.fillRect(0, 0, 256, 256);
  tCtx.strokeStyle = '#0A0B0E';
  tCtx.lineWidth = 6;
  for (let y = -32; y < 288; y += 32) {
    tCtx.beginPath();
    tCtx.moveTo(128, y);
    tCtx.lineTo(24, y + 22);
    tCtx.moveTo(128, y);
    tCtx.lineTo(232, y + 22);
    tCtx.stroke();
  }
  const tireTread = new THREE.CanvasTexture(tireCanvas);
  tireTread.colorSpace = THREE.SRGBColorSpace;
  tireTread.wrapS = THREE.RepeatWrapping;
  tireTread.wrapT = THREE.RepeatWrapping;
  tireTread.repeat.set(1, 6);
  tireTread.anisotropy = aniso;

  // 5. High-contrast carbon fiber twill weave texture
  const carbonCanvas = document.createElement('canvas');
  carbonCanvas.width = 64;
  carbonCanvas.height = 64;
  const cCtx = carbonCanvas.getContext('2d')!;
  cCtx.fillStyle = '#12141A';
  cCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      cCtx.fillStyle = (x + y) % 16 === 0 ? '#282E3A' : '#161920';
      cCtx.fillRect(x, y, 4, 4);
      cCtx.fillStyle = (x + y) % 16 === 0 ? '#0F1116' : '#313847';
      cCtx.fillRect(x + 4, y + 4, 4, 4);
    }
  }
  const carbonFiber = new THREE.CanvasTexture(carbonCanvas);
  carbonFiber.colorSpace = THREE.SRGBColorSpace;
  carbonFiber.wrapS = THREE.RepeatWrapping;
  carbonFiber.wrapT = THREE.RepeatWrapping;
  carbonFiber.repeat.set(5, 5);
  carbonFiber.anisotropy = aniso;

  // 6. Cross-drilled racing stainless brake rotor texture
  const discCanvas = document.createElement('canvas');
  discCanvas.width = 256;
  discCanvas.height = 256;
  const dCtx = discCanvas.getContext('2d')!;
  dCtx.fillStyle = '#CBD5E1';
  dCtx.fillRect(0, 0, 256, 256);
  dCtx.strokeStyle = '#94A3B8';
  dCtx.lineWidth = 2;
  for (let r = 64; r < 126; r += 5) {
    dCtx.beginPath();
    dCtx.arc(128, 128, r, 0, Math.PI * 2);
    dCtx.stroke();
  }
  dCtx.fillStyle = '#1E293B';
  for (let spoke = 0; spoke < 12; spoke++) {
    const baseA = (spoke / 12) * Math.PI * 2;
    for (let d = 0; d < 3; d++) {
      const r = 78 + d * 17;
      const a = baseA + d * 0.14;
      dCtx.beginPath();
      dCtx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.2, 0, Math.PI * 2);
      dCtx.fill();
    }
  }
  const brakeDisc = new THREE.CanvasTexture(discCanvas);
  brakeDisc.colorSpace = THREE.SRGBColorSpace;
  brakeDisc.anisotropy = aniso;

  // 7. Overhead Highway Gantry Directional Sign Graphic
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 160;
  const sgCtx = signCanvas.getContext('2d')!;
  sgCtx.fillStyle = '#0B5332';
  sgCtx.fillRect(0, 0, 512, 160);
  sgCtx.strokeStyle = '#F8FAFC';
  sgCtx.lineWidth = 6;
  sgCtx.strokeRect(8, 8, 496, 144);
  sgCtx.fillStyle = '#FACC15';
  sgCtx.fillRect(24, 24, 96, 36);
  sgCtx.fillStyle = '#0F172A';
  sgCtx.font = 'bold 22px sans-serif';
  sgCtx.fillText('TOL APEX', 32, 49);
  sgCtx.fillStyle = '#FFFFFF';
  sgCtx.font = 'bold 34px sans-serif';
  sgCtx.fillText('SENTUL CIRCUIT   2 KM', 136, 54);
  sgCtx.font = 'bold 26px sans-serif';
  sgCtx.fillStyle = '#E2E8F0';
  sgCtx.fillText('BANDUNG  ↑    |    PUNCAK  ↗', 62, 118);
  const gantrySign = new THREE.CanvasTexture(signCanvas);
  gantrySign.colorSpace = THREE.SRGBColorSpace;
  gantrySign.anisotropy = aniso;

  // 8. Soft radial contact shadow texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const rad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  rad.addColorStop(0, 'rgba(5, 7, 10, 0.88)');
  rad.addColorStop(0.55, 'rgba(5, 7, 10, 0.45)');
  rad.addColorStop(1, 'rgba(5, 7, 10, 0)');
  sCtx.fillStyle = rad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  // 9. Motorsport Pit-Box Studio Floor Tile Texture
  const garageCanvas = document.createElement('canvas');
  garageCanvas.width = 512;
  garageCanvas.height = 512;
  const gfCtx = garageCanvas.getContext('2d')!;
  gfCtx.fillStyle = '#151922';
  gfCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const shade = 20 + Math.floor(Math.random() * 14);
    gfCtx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
    gfCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  gfCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  gfCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    gfCtx.beginPath();
    gfCtx.moveTo(i, 0);
    gfCtx.lineTo(i, 512);
    gfCtx.stroke();
    gfCtx.beginPath();
    gfCtx.moveTo(0, i);
    gfCtx.lineTo(512, i);
    gfCtx.stroke();
  }
  // Subtle pit-bay warning corner accents
  gfCtx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
  gfCtx.lineWidth = 3;
  gfCtx.strokeRect(4, 4, 504, 504);

  const garageFloor = new THREE.CanvasTexture(garageCanvas);
  garageFloor.colorSpace = THREE.SRGBColorSpace;
  garageFloor.wrapS = THREE.RepeatWrapping;
  garageFloor.wrapT = THREE.RepeatWrapping;
  garageFloor.repeat.set(8, 8);
  garageFloor.anisotropy = aniso;

  return {
    roadColor,
    roadBump,
    roadRoughness,
    grassColor,
    tireTread,
    carbonFiber,
    brakeDisc,
    gantrySign,
    contactShadow,
    garageFloor,
    dispose: () => {
      roadColor.dispose();
      roadBump.dispose();
      roadRoughness.dispose();
      grassColor.dispose();
      tireTread.dispose();
      carbonFiber.dispose();
      brakeDisc.dispose();
      gantrySign.dispose();
      contactShadow.dispose();
      garageFloor.dispose();
    },
  };
}
