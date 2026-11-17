import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AvatarState, ThemeMode } from '../types/chat';

interface NutcrackerStageProps {
  avatarState: AvatarState;
  mouthLevelRef: React.MutableRefObject<number>;
  theme: ThemeMode;
  onQuickPrompt?: (prompt: string) => void;
}

const _vec3 = new THREE.Vector3();

function createNeonSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Subtle dark frosted studio plaque
  ctx.fillStyle = 'rgba(14, 14, 22, 0.72)';
  ctx.beginPath();
  ctx.roundRect(64, 96, 896, 320, 36);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.stroke();

  // Crown mark above text
  ctx.save();
  ctx.translate(512, 165);
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(-64, 24);
  ctx.lineTo(-76, -18);
  ctx.lineTo(-32, 4);
  ctx.lineTo(0, -30);
  ctx.lineTo(32, 4);
  ctx.lineTo(76, -18);
  ctx.lineTo(64, 24);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Main "Qarsildoq AI" neon wordmark
  ctx.save();
  ctx.font = '800 92px Outfit, "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 38;
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('Qarsildoq AI', 512, 282);

  ctx.shadowColor = '#fca5a5';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff5f5';
  ctx.fillText('Qarsildoq AI', 512, 282);
  ctx.restore();

  // Subtle domain subtitle
  ctx.save();
  ctx.font = '600 26px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(252, 165, 165, 0.85)';
  ctx.fillText('qarsildoq.ai', 512, 355);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createWoodRoughnessTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 256;
    const alpha = 0.04 + Math.random() * 0.07;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y + (Math.random() - 0.5) * 6, 170, y + (Math.random() - 0.5) * 6, 256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export const NutcrackerStage: React.FC<NutcrackerStageProps> = ({
  avatarState,
  mouthLevelRef,
  theme,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarStateRef = useRef<AvatarState>(avatarState);
  const themeRef = useRef<ThemeMode>(theme);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initWidth = Math.max(container.clientWidth, 320);
    const initHeight = Math.max(container.clientHeight, 260);
    renderer.setSize(initWidth, initHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const handleContextRestored = () => {
      setWebglUnavailable(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const darkBg = new THREE.Color('#0c0b10');
    const lightBg = new THREE.Color('#e8ecf2');
    const activeBg = themeRef.current === 'dark' ? darkBg.clone() : lightBg.clone();
    scene.background = activeBg;
    const sceneFog = new THREE.FogExp2(activeBg.getHex(), 0.065);
    scene.fog = sceneFog;

    const camera = new THREE.PerspectiveCamera(36, initWidth / initHeight, 0.1, 40);
    camera.position.set(0.15, 1.48, 4.35);
    camera.lookAt(0, 1.25, 0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Studio 3-point lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x2a1814, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    keyLight.position.set(2.8, 4.2, 3.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const crimsonRimLight = new THREE.PointLight(0xef4444, 5.5, 9, 1.6);
    crimsonRimLight.position.set(-2.2, 1.85, -0.9);
    scene.add(crimsonRimLight);

    const coolFillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    coolFillLight.position.set(-3.0, 2.0, 2.2);
    scene.add(coolFillLight);

    // Procedural materials
    const woodTex = createWoodRoughnessTexture();
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf4c3a1,
      roughness: 0.42,
      metalness: 0.04,
      roughnessMap: woodTex,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xe67e22,
      roughness: 0.35,
      metalness: 0.05,
    });
    const cheekMat = new THREE.MeshStandardMaterial({
      color: 0xf47c7c,
      roughness: 0.6,
      metalness: 0.0,
    });
    const blackSatinMat = new THREE.MeshStandardMaterial({
      color: 0x16161d,
      roughness: 0.38,
      metalness: 0.22,
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xeab308,
      roughness: 0.2,
      metalness: 0.92,
      clearcoat: 0.5,
    });
    const rubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const coatMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.48,
      metalness: 0.08,
    });
    const whiteGloveMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.55,
      metalness: 0.02,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.5,
      metalness: 0.05,
    });
    const darkMouthMat = new THREE.MeshStandardMaterial({
      color: 0x11090c,
      roughness: 0.9,
      metalness: 0.0,
    });
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.45,
      metalness: 0.0,
    });
    const teethMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.04,
    });
    const eyeDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.1,
    });

    // Studio Environment (Desk + Wall + Neon "Qarsildoq AI" Sign + Plant)
    const studioGroup = new THREE.Group();
    scene.add(studioGroup);

    const wallMat = new THREE.MeshStandardMaterial({
      color: themeRef.current === 'dark' ? 0x12111a : 0xdbe2ec,
      roughness: 0.85,
      metalness: 0.05,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat);
    backWall.position.set(0, 2.0, -2.1);
    backWall.receiveShadow = true;
    studioGroup.add(backWall);

    // Neon Sign "Qarsildoq AI" on left studio wall
    const signTexture = createNeonSignTexture();
    signTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const signMat = new THREE.MeshBasicMaterial({
      map: signTexture,
      transparent: true,
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), signMat);
    signMesh.position.set(-1.38, 1.72, -1.75);
    signMesh.rotation.y = 0.22;
    studioGroup.add(signMesh);

    // Subtle LED desk accent bar on back wall
    const ledStripMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.025, 0.02), ledStripMat);
    ledStrip.position.set(0.5, 0.85, -1.98);
    studioGroup.add(ledStrip);

    // Studio desk
    const deskMat = new THREE.MeshPhysicalMaterial({
      color: themeRef.current === 'dark' ? 0x17151f : 0x334155,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 2.2), deskMat);
    desk.position.set(0, 0.09, 0.45);
    desk.receiveShadow = true;
    studioGroup.add(desk);

    // Minimalist studio plant on right background
    const potMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 16), potMat);
    pot.position.set(1.65, 0.35, -1.2);
    studioGroup.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.65 });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 6), leafMat);
      const angle = (i / 5) * Math.PI * 2;
      leaf.position.set(1.65 + Math.cos(angle) * 0.12, 0.72 + (i % 2) * 0.08, -1.2 + Math.sin(angle) * 0.12);
      leaf.rotation.z = Math.cos(angle) * 0.4;
      leaf.rotation.x = Math.sin(angle) * 0.4;
      studioGroup.add(leaf);
    }

    // ==================== NUTCRACKER CHARACTER ====================
    const characterRoot = new THREE.Group();
    characterRoot.position.set(0.08, 0.18, 0);
    scene.add(characterRoot);

    // 1. Torso (LatheGeometry tailored military coat)
    const torsoGroup = new THREE.Group();
    characterRoot.add(torsoGroup);

    const torsoProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.46, 0.0),
      new THREE.Vector2(0.43, 0.22),
      new THREE.Vector2(0.39, 0.48),
      new THREE.Vector2(0.45, 0.78),
      new THREE.Vector2(0.34, 0.92),
      new THREE.Vector2(0.18, 0.95),
      new THREE.Vector2(0.0, 0.95),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 32);
    const torsoMesh = new THREE.Mesh(torsoGeo, coatMat);
    torsoMesh.castShadow = !isSoftwareGl;
    torsoMesh.receiveShadow = true;
    torsoGroup.add(torsoMesh);

    // Gold collar band & center placket trim
    const collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 12, 28), goldMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.set(0, 0.94, 0.02);
    torsoGroup.add(collarMesh);

    const centerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.04), goldMat);
    centerTrim.position.set(0, 0.48, 0.42);
    torsoGroup.add(centerTrim);

    // 6 Brass Buttons
    for (let row = 0; row < 3; row++) {
      for (const side of [-1, 1]) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 14), goldMat);
        btn.scale.z = 0.65;
        btn.position.set(side * 0.15, 0.72 - row * 0.21, 0.41 - row * 0.01);
        torsoGroup.add(btn);
      }
    }

    // Gold Shoulder Epaulets + fringe
    for (const side of [-1, 1]) {
      const epGroup = new THREE.Group();
      epGroup.position.set(side * 0.45, 0.87, 0.02);
      epGroup.rotation.z = side * -0.22;
      const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.16, 6, 12), goldMat);
      pad.rotation.z = Math.PI / 2;
      epGroup.add(pad);
      for (let f = -2; f <= 2; f++) {
        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.12, 8), goldMat);
        tassel.position.set(side * 0.12, -0.07, f * 0.032);
        epGroup.add(tassel);
      }
      torsoGroup.add(epGroup);
    }

    // 2. Head Group (Neck, Face, Hat, Eyes, Mustache, Hinged Jaw)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.96, 0.02);
    torsoGroup.add(headPivot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.14, 20), skinMat);
    neck.position.set(0, 0.06, 0);
    headPivot.add(neck);

    // Cranium & upper face
    const headBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.30, 0.52, 28), skinMat);
    headBase.position.set(0, 0.36, 0);
    headBase.castShadow = !isSoftwareGl;
    headPivot.add(headBase);

    const headDome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), skinMat);
    headDome.position.set(0, 0.58, 0);
    headPivot.add(headDome);

    // Rosy cheeks
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), cheekMat);
      cheek.scale.set(1, 0.85, 0.4);
      cheek.position.set(side * 0.21, 0.36, 0.25);
      headPivot.add(cheek);
    }

    // Sculpted orange-wood nose (ExtrudeGeometry wedge)
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, 0.11);
    noseShape.lineTo(-0.045, -0.04);
    noseShape.lineTo(0.045, -0.04);
    noseShape.closePath();
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 3,
    });
    noseGeo.center();
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.position.set(0, 0.42, 0.33);
    noseMesh.rotation.x = -0.18;
    headPivot.add(noseMesh);

    // Eyes & blinking eyelids & eyebrows
    const eyelids: THREE.Mesh[] = [];
    const eyebrows: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 16), teethMat);
      sclera.scale.set(1, 1.08, 0.6);
      sclera.position.set(side * 0.125, 0.48, 0.285);
      headPivot.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 14), eyeDarkMat);
      pupil.scale.set(1, 1, 0.6);
      pupil.position.set(side * 0.125, 0.48, 0.312);
      headPivot.add(pupil);

      const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), teethMat);
      catchlight.position.set(side * 0.125 + 0.012, 0.495, 0.326);
      headPivot.add(catchlight);

      const eyelid = new THREE.Mesh(
        new THREE.SphereGeometry(0.059, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        skinMat
      );
      eyelid.position.set(side * 0.125, 0.485, 0.285);
      eyelid.rotation.x = -Math.PI * 0.42;
      headPivot.add(eyelid);
      eyelids.push(eyelid);

      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.085, 4, 8), eyeDarkMat);
      brow.rotation.z = Math.PI / 2 + side * -0.12;
      brow.position.set(side * 0.125, 0.565, 0.30);
      headPivot.add(brow);
      eyebrows.push(brow);
    }

    // White curly side hair rolls
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const curl = new THREE.Mesh(
          new THREE.SphereGeometry(0.092 - i * 0.008, 14, 14),
          hairMat
        );
        curl.position.set(side * (0.33 + Math.sin(i * 0.7) * 0.025), 0.54 - i * 0.11, -0.02 + i * 0.015);
        headPivot.add(curl);
      }
    }

    // Sculpted white handlebar mustache
    for (const side of [-1, 1]) {
      const mCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.34, 0.33),
        new THREE.Vector3(side * 0.11, 0.355, 0.345),
        new THREE.Vector3(side * 0.22, 0.325, 0.31),
        new THREE.Vector3(side * 0.27, 0.355, 0.26),
      ]);
      const mGeo = new THREE.TubeGeometry(mCurve, 16, 0.032, 10, false);
      const mustache = new THREE.Mesh(mGeo, hairMat);
      headPivot.add(mustache);
    }

    // Mouth Cavity & Upper Teeth (fixed to headPivot)
    const mouthBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.14), darkMouthMat);
    mouthBack.position.set(0, 0.23, 0.22);
    headPivot.add(mouthBack);

    const upperTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.042, 0.045), teethMat);
    upperTeeth.position.set(0, 0.292, 0.295);
    headPivot.add(upperTeeth);

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), tongueMat);
    tongue.scale.set(1.2, 0.45, 1.1);
    tongue.position.set(0, 0.21, 0.25);
    headPivot.add(tongue);

    // Hinged Lower Jaw Group (Moves dynamically with audio!)
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, 0.22, 0.16);
    headPivot.add(jawGroup);

    const lowerTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.042), teethMat);
    lowerTeeth.position.set(0, 0.015, 0.13);
    jawGroup.add(lowerTeeth);

    const chinBlock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.095, 0.17), skinMat);
    chinBlock.position.set(0, -0.045, 0.085);
    jawGroup.add(chinBlock);

    const chinBeard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.05), hairMat);
    chinBeard.position.set(0, -0.085, 0.165);
    jawGroup.add(chinBeard);

    // Tall Ceremonial Shako Hat
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.62, 0);
    headPivot.add(hatGroup);

    const hatProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.35, 0.0),
      new THREE.Vector2(0.34, 0.12),
      new THREE.Vector2(0.39, 0.42),
      new THREE.Vector2(0.36, 0.46),
      new THREE.Vector2(0.0, 0.46),
    ];
    const hatBody = new THREE.Mesh(new THREE.LatheGeometry(hatProfile, 32), blackSatinMat);
    hatBody.castShadow = !isSoftwareGl;
    hatGroup.add(hatBody);

    const hatBottomRim = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.032, 12, 32), goldMat);
    hatBottomRim.rotation.x = Math.PI / 2;
    hatBottomRim.position.y = 0.02;
    hatGroup.add(hatBottomRim);

    const hatTopRim = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.024, 12, 32), goldMat);
    hatTopRim.rotation.x = Math.PI / 2;
    hatTopRim.position.y = 0.43;
    hatGroup.add(hatTopRim);

    // Hat visor
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.37, 0.025, 24, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
      blackSatinMat
    );
    visor.position.set(0, -0.01, 0.04);
    visor.rotation.x = 0.25;
    hatGroup.add(visor);

    // Gold medallion & ruby gem on front of hat
    const crestRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 12, 24), goldMat);
    crestRing.position.set(0, 0.23, 0.365);
    hatGroup.add(crestRing);

    const rubyGem = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 18), rubyMat);
    rubyGem.scale.z = 0.5;
    rubyGem.position.set(0, 0.23, 0.365);
    hatGroup.add(rubyGem);

    // 3. Arms & White-Gloved Hands
    // Right Arm (Raised presenting gesture like reference image)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(-0.48, 0.78, 0.05);
    torsoGroup.add(rightArmGroup);

    const rUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.30, 8, 14), coatMat);
    rUpperArm.position.set(-0.08, -0.18, 0.06);
    rUpperArm.rotation.z = -0.35;
    rUpperArm.rotation.x = -0.35;
    rightArmGroup.add(rUpperArm);

    const rForearmGroup = new THREE.Group();
    rForearmGroup.position.set(-0.18, -0.34, 0.16);
    rightArmGroup.add(rForearmGroup);

    const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.28, 8, 14), coatMat);
    rForearm.position.set(-0.02, 0.02, 0.20);
    rForearm.rotation.x = Math.PI / 2 - 0.32;
    rForearmGroup.add(rForearm);

    const rCuff = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 10, 20), goldMat);
    rCuff.position.set(-0.02, 0.08, 0.34);
    rCuff.rotation.x = -0.32;
    rForearmGroup.add(rCuff);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 16), whiteGloveMat);
    rHand.scale.set(1.05, 0.85, 1.3);
    rHand.position.set(-0.01, 0.11, 0.45);
    rForearmGroup.add(rHand);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.075, 4, 8), whiteGloveMat);
      finger.position.set(-0.055 + f * 0.036, 0.17, 0.53);
      finger.rotation.x = 0.55;
      rForearmGroup.add(finger);
    }

    // Left Arm (Resting gracefully on studio desk)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(0.48, 0.78, 0.05);
    torsoGroup.add(leftArmGroup);

    const lUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 8, 14), coatMat);
    lUpperArm.position.set(0.08, -0.22, 0.06);
    lUpperArm.rotation.z = 0.32;
    lUpperArm.rotation.x = -0.25;
    leftArmGroup.add(lUpperArm);

    const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.30, 8, 14), coatMat);
    lForearm.position.set(0.02, -0.46, 0.25);
    lForearm.rotation.x = Math.PI / 2 - 0.18;
    lForearm.rotation.z = -0.25;
    leftArmGroup.add(lForearm);

    const lCuff = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 10, 20), goldMat);
    lCuff.position.set(-0.04, -0.49, 0.40);
    lCuff.rotation.x = -0.18;
    leftArmGroup.add(lCuff);

    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 16), whiteGloveMat);
    lHand.scale.set(1.15, 0.7, 1.3);
    lHand.position.set(-0.07, -0.51, 0.52);
    leftArmGroup.add(lHand);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer tracking
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      pointerRef.current.x = THREE.MathUtils.clamp(nx, -1, 1);
      pointerRef.current.y = THREE.MathUtils.clamp(ny, -1, 1);
    };
    container.addEventListener('pointermove', handlePointerMove);

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 100);
        const h = Math.max(entry.contentRect.height, 100);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation State
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let blinkTimer = 2.5;
    let blinkAmount = 0;
    let smoothMouth = 0;
    let smoothHeadX = 0;
    let smoothHeadY = 0;
    let smoothHeadZ = 0;
    let smoothArmLift = 0;
    let smoothBodyZ = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
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

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const mode = avatarStateRef.current;
      const isDark = themeRef.current === 'dark';

      // Theme interpolation
      const targetBg = isDark ? darkBg : lightBg;
      activeBg.lerp(targetBg, 1 - Math.exp(-5 * dt));
      scene.background = activeBg;
      sceneFog.color.copy(activeBg);

      wallMat.color.lerp(
        _vec3.set(isDark ? 0.07 : 0.85, isDark ? 0.068 : 0.88, isDark ? 0.1 : 0.92) as unknown as THREE.Color,
        0
      );
      wallMat.color.setHex(isDark ? 0x111019 : 0xd9e0ea);
      deskMat.color.setHex(isDark ? 0x17151f : 0x334155);
      hemiLight.intensity = isDark ? 0.65 : 1.15;

      // Natural blinking
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        blinkAmount = 1;
        blinkTimer = 2.4 + Math.random() * 3.5;
      }
      blinkAmount = THREE.MathUtils.damp(blinkAmount, 0, 14, dt);
      const lidAngle = THREE.MathUtils.lerp(-Math.PI * 0.44, -Math.PI * 0.05, blinkAmount);
      eyelids.forEach((lid) => {
        lid.rotation.x = lidAngle;
      });

      // State-driven targets
      let targetMouth = 0.04;
      let targetHeadX = pointerRef.current.y * 0.08;
      let targetHeadY = pointerRef.current.x * 0.16;
      let targetHeadZ = 0;
      let targetArmLift = Math.sin(elapsed * 1.4) * 0.04;
      let targetBodyZ = 0;

      if (mode === 'listening') {
        targetHeadX = 0.08;
        targetHeadY = -0.06;
        targetHeadZ = 0.06;
        targetBodyZ = 0.14;
        targetArmLift = 0.12 + Math.sin(elapsed * 4) * 0.03;
        crimsonRimLight.intensity = 7.5 + Math.sin(elapsed * 6) * 2.0;
      } else if (mode === 'thinking') {
        targetHeadX = -0.08;
        targetHeadY = 0.14 + Math.sin(elapsed * 1.6) * 0.06;
        targetHeadZ = -0.08;
        targetArmLift = 0.22 + Math.sin(elapsed * 2.5) * 0.05;
        crimsonRimLight.intensity = 5.0;
      } else if (mode === 'speaking') {
        const audioAmp = mouthLevelRef.current;
        const syntheticSyllable = 0.22 + Math.abs(Math.sin(elapsed * 12.5)) * 0.35;
        targetMouth = THREE.MathUtils.clamp(audioAmp > 0.02 ? audioAmp : syntheticSyllable, 0.04, 1.0);
        targetHeadX = Math.sin(elapsed * 5.2) * 0.045;
        targetHeadY = Math.sin(elapsed * 2.4) * 0.11 + pointerRef.current.x * 0.08;
        targetHeadZ = Math.sin(elapsed * 3.1) * 0.04;
        targetArmLift = 0.18 + Math.sin(elapsed * 5.5) * 0.12;
        targetBodyZ = 0.08;
        crimsonRimLight.intensity = 6.2 + targetMouth * 2.5;
      } else {
        // Idle gentle breathing
        targetMouth = 0.03 + Math.max(0, Math.sin(elapsed * 1.3)) * 0.02;
        crimsonRimLight.intensity = 5.0;
      }

      smoothMouth = THREE.MathUtils.damp(smoothMouth, targetMouth, 22, dt);
      smoothHeadX = THREE.MathUtils.damp(smoothHeadX, targetHeadX, 7, dt);
      smoothHeadY = THREE.MathUtils.damp(smoothHeadY, targetHeadY, 7, dt);
      smoothHeadZ = THREE.MathUtils.damp(smoothHeadZ, targetHeadZ, 7, dt);
      smoothArmLift = THREE.MathUtils.damp(smoothArmLift, targetArmLift, 8, dt);
      smoothBodyZ = THREE.MathUtils.damp(smoothBodyZ, targetBodyZ, 6, dt);

      // Apply hinged Nutcracker jaw articulation
      jawGroup.rotation.x = smoothMouth * 0.34;
      jawGroup.position.y = 0.22 - smoothMouth * 0.065;

      // Subtle eyebrow lift while speaking/listening
      eyebrows.forEach((brow, idx) => {
        const side = idx === 0 ? -1 : 1;
        brow.position.y = 0.565 + smoothMouth * 0.015 + (mode === 'listening' ? 0.015 : 0);
        brow.rotation.z = Math.PI / 2 + side * (-0.12 + (mode === 'thinking' ? 0.08 : 0));
      });

      // Head, torso breathing, and arm gestures
      headPivot.rotation.x = smoothHeadX;
      headPivot.rotation.y = smoothHeadY;
      headPivot.rotation.z = smoothHeadZ;

      torsoGroup.position.y = Math.sin(elapsed * 1.6) * 0.012;
      characterRoot.position.z = smoothBodyZ;

      rightArmGroup.rotation.x = -smoothArmLift;
      rForearmGroup.rotation.x = -smoothArmLift * 0.6;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      envTex.dispose();
      signTexture.dispose();
      woodTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mouthLevelRef]);

  const statusLabels: Record<AvatarState, string> = {
    idle: 'Tayyor',
    listening: 'Tinglamoqda...',
    thinking: 'Javob tayyorlamoqda...',
    speaking: 'Gapirmoqda...',
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-[#0c0b10]">
      {webglUnavailable ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 to-black text-white">
          <img
            src="/icon.svg"
            alt="Qarsildoq AI"
            className="w-24 h-24 rounded-2xl mb-4 shadow-lg"
          />
          <p className="font-display text-xl font-bold">Qarsildoq AI</p>
          <p className="text-sm text-slate-300 mt-1">3D studiya rejimi tayyorlanmoqda</p>
        </div>
      ) : (
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}

      {/* Clean non-blur semantic state indicator (no backdrop-filter over WebGL, no pulsing dots) */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-xl bg-white/95 dark:bg-[#14141c]/95 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10 shadow-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            avatarState === 'speaking'
              ? 'bg-red-500'
              : avatarState === 'listening'
              ? 'bg-amber-500'
              : avatarState === 'thinking'
              ? 'bg-sky-500'
              : 'bg-emerald-500'
          }`}
        />
        <span>{statusLabels[avatarState]}</span>
      </div>
    </div>
  );
};
