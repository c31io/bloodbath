import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BEDROOM, ROOM, type RoomObject } from "./bedroom.js";
import { windAt } from "./systems.js";
import { loadProps } from "./props.js";
import type { EggSpotC, Fan, Host, Hot, Mosquito, Plume, Pos } from "./components.js";
import type { NightWorld } from "./night.js";
import { playerState } from "./night.js";

export interface SenseChannels {
  world: boolean;
  heat: boolean;
  co2: boolean;
}

/** Radial glow texture shared by Heat sprites, CO2 points, and the female mote. */
function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Painted night view for the window backdrop: sky gradient, stars, moon,
 *  a two-layer city skyline with lit windows. Cosmetic entropy (Math.random),
 *  same license as the plumes. */
function nightViewTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#060913");
  sky.addColorStop(0.55, "#0b1226");
  sky.addColorStop(0.8, "#16203c");
  sky.addColorStop(1, "#1d2a4a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 1024;
    const y = 60 + Math.random() * 300;
    g.globalAlpha = 0.25 + Math.random() * 0.75;
    g.fillStyle = Math.random() < 0.12 ? "#cfe0ff" : "#ffffff";
    g.beginPath();
    g.arc(x, y, 0.3 + Math.random() * 1.3, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#10182e";
  let x = 0;
  while (x < 1024) {
    const w = 40 + Math.random() * 90;
    const h = 60 + Math.random() * 90;
    g.fillRect(x, 512 - 160 - h, w, h + 160);
    x += w + Math.random() * 24;
  }
  const mx = 665;
  const my = 230;
  const mr = 30;
  const halo = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.2);
  halo.addColorStop(0, "rgba(220,228,255,0.55)");
  halo.addColorStop(1, "rgba(220,228,255,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.arc(mx, my, mr * 3.2, 0, 7);
  g.fill();
  g.fillStyle = "#e8e6d8";
  g.beginPath();
  g.arc(mx, my, mr, 0, 7);
  g.fill();
  g.fillStyle = "rgba(180,178,166,0.5)";
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.22], [-0.05, 0.35, 0.12]] as Array<[number, number, number]>) {
    g.beginPath();
    g.arc(mx + dx * mr, my + dy * mr, cr * mr, 0, 7);
    g.fill();
  }
  x = -20;
  while (x < 1024) {
    const w = 60 + Math.random() * 110;
    const h = 40 + Math.random() * 70;
    const y0 = 512 - 90 - h;
    g.fillStyle = "#080c1a";
    g.fillRect(x, y0, w, h + 90);
    const dots = Math.floor((w * h) / 900);
    for (let i = 0; i < dots; i++) {
      if (Math.random() < 0.55) continue;
      g.fillStyle = Math.random() < 0.7 ? "rgba(255,196,120,0.8)" : "rgba(170,220,255,0.7)";
      g.fillRect(x + 6 + Math.random() * (w - 12), y0 + 6 + Math.random() * (h - 10), 2.5, 3.5);
    }
    x += w + Math.random() * 30;
  }
  const haze = g.createLinearGradient(0, 300, 0, 512);
  haze.addColorStop(0, "rgba(60,80,140,0)");
  haze.addColorStop(1, "rgba(60,80,140,0.18)");
  g.fillStyle = haze;
  g.fillRect(0, 300, 1024, 212);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
interface PlumeView {
  points: THREE.Points;
  source: number;
}

const HEAT_RANGE = 3.2;
const SPOT_REVEAL = 2.6;

export class GameView {
  readonly scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private worldGroup = new THREE.Group();
  private glow = glowTexture();
  private glowBound = new Set<number>();
  private heatGlow: Array<{ id: number; strength: number; uniforms: Array<{ value: number }> }> = [];
  private glowMats: THREE.Material[] = [];
  private co2Group = new THREE.Group();
  private plumes: PlumeView[] = [];
  private nightGroup = new THREE.Group();
  private propsGroup = new THREE.Group();
  private propReady = false;
  private fallbacks: THREE.Object3D[] = [];
  private spotRings = new Map<number, THREE.Mesh>();
  private fanBlades: THREE.Group | null = null;
  private femaleMote: THREE.Sprite | null = null;
  private idleAngle = 0;
  private clock = new THREE.Clock();
  // The hero: the player's own mosquito body. A camera child in play (the
  // lower-center "you" silhouette), a hovering showpiece on the menu. Wings
  // are named pivot groups in the GLB; the abdomen group pulses while feeding.
  private heroPivot = new THREE.Group();
  private heroModel: THREE.Group | null = null;
  private heroWingR: THREE.Object3D | null = null;
  private heroWingL: THREE.Object3D | null = null;
  private heroAbdomen: THREE.Object3D | null = null;
  private heroMode: "menu" | "fp" | null = null;
  private heroAir = 1; // 1 flying, 0 landed
  private flapPhase = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.02, 40);
    // The hero model rides the camera: it must be in the scene graph for
    // camera children to render.
    this.scene.add(this.camera);
    void new GLTFLoader()
      .loadAsync("models/mosquito.glb")
      .then((gltf) => {
        this.heroModel = gltf.scene;
        this.heroModel.scale.setScalar(0.2);
        this.heroModel.rotation.y = Math.PI; // authored facing +Z; fly nose-first
        this.heroWingR = this.heroModel.getObjectByName("wingR") ?? null;
        this.heroWingL = this.heroModel.getObjectByName("wingL") ?? null;
        this.heroAbdomen = this.heroModel.getObjectByName("abdomen") ?? null;
        this.heroPivot.add(this.heroModel);
        this.propsGroup.add(this.heroPivot); // menu hover until a Night binds
      })
      .catch(() => {}); // cosmetic: play without the hero if it fails to load
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.16);
    // MSAA on the composer's target: the post pipeline bypasses the canvas
    // multisample buffer, so without this every edge aliases on DPR-1 screens.
    // The target must be DRAWING-BUFFER sized: EffectComposer never resizes a
    // custom target on its own, and a CSS-sized one renders the whole frame at
    // 1x and upscales - big pixels on every DPR>1 screen until a resize fires.
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(buf.x, buf.y, { samples: 4, type: THREE.HalfFloatType }),
    );
    this.scene.add(this.worldGroup, this.co2Group);
    this.worldGroup.add(this.propsGroup, this.nightGroup);

    this.buildRoom();
    this.buildLights();
    void loadProps(this.propsGroup).then(() => {
      this.propReady = true;
      for (const mesh of this.fallbacks) mesh.visible = false;
    });

    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.85, 0.55);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(innerWidth, innerHeight); // align internal sizes with the buffer

    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });
  }

  private mat(color: number, opts: { emissive?: number; ei?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
      roughness: opts.rough ?? 0.9,
      metalness: 0,
    });
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    this.worldGroup.add(mesh);
    return mesh;
  }

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0x232a45, 0.7));
    const moon = new THREE.DirectionalLight(0x7d90c8, 0.5);
    moon.position.set(0, 4, -6);
    this.scene.add(moon);
    const lamp = new THREE.PointLight(0xffa050, 9, 6, 2);
    lamp.position.set(BEDROOM.lamp.anchor.x, BEDROOM.lamp.anchor.y, BEDROOM.lamp.anchor.z);
    this.scene.add(lamp);
    const laptopGlow = new THREE.PointLight(0x9fd0ff, 2.2, 2.2, 2);
    laptopGlow.position.set(BEDROOM.laptop.anchor.x, BEDROOM.laptop.anchor.y + 0.1, BEDROOM.laptop.anchor.z);
    this.scene.add(laptopGlow);
  }

  private buildRoom(): void {
    const R = { x: -ROOM.minX, z: -ROOM.minZ, h: ROOM.height };
    this.box(R.x * 2, 0.1, R.z * 2, 0, -0.05, 0, this.mat(0x241f31));
    this.box(R.x * 2, 0.1, R.z * 2, 0, R.h, 0, this.mat(0x181523));
    this.box(0.1, R.h, R.z * 2, -R.x, R.h / 2, 0, this.mat(0x2c2540));
    // north wall, split around the window opening (x -0.8..0.8, y 1.41..2.15)
    const wall = this.mat(0x2c2540);
    this.box(R.x * 2, 1.41, 0.1, 0, 0.705, -R.z, wall);
    this.box(R.x * 2, 0.85, 0.1, 0, 2.575, -R.z, wall);
    this.box(2.2, 0.74, 0.1, -1.9, 1.78, -R.z, wall);
    this.box(2.2, 0.74, 0.1, 1.9, 1.78, -R.z, wall);
    this.box(0.1, R.h, R.z * 2, R.x, R.h / 2, 0, this.mat(0x2c2540));
    this.box(R.x * 2, R.h, 0.1, 0, R.h / 2, R.z, this.mat(0x2c2540));

    // sill shelf for the windowsill plant model (its solid lives in SOLIDS, bedroom.ts)
    this.box(1.1, 0.06, 0.32, 0, 1.38, -2.36, this.mat(0x35294a));

    // window dressing: lintel over the opening, cross muntins (the posts at
    // x ±0.8 are its jambs), a faint glass pane, and the night view outside
    const frame = this.mat(0x0c0a14);
    this.box(1.68, 0.08, 0.12, 0, 2.15, -R.z, frame);
    this.box(0.05, 0.74, 0.06, 0, 1.78, -R.z, frame);
    this.box(1.6, 0.05, 0.06, 0, 1.78, -R.z, frame);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.74),
      new THREE.MeshBasicMaterial({ color: 0x9db8ff, transparent: true, opacity: 0.06, depthWrite: false }),
    );
    glass.position.set(0, 1.78, -R.z - 0.04);
    this.worldGroup.add(glass);
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 7),
      new THREE.MeshBasicMaterial({ map: nightViewTexture(), fog: false, toneMapped: false }),
    );
    view.position.set(0, 2.2, -6.5);
    this.worldGroup.add(view);
    this.box(0.06, 1.3, 0.06, -0.8, 1.6, -R.z + 0.1, this.mat(0x0c0a14));
    this.box(0.06, 1.3, 0.06, 0.8, 1.6, -R.z + 0.1, this.mat(0x0c0a14));
    this.box(1.0, 0.02, 1.4, -1.5, 0.02, 1.5, this.mat(0x5a3550, { rough: 1 }));
    this.box(0.05, 2.0, 0.9, R.x - 0.06, 1.0, 1.2, this.mat(0x35294a));

    // ceiling fan: hub + three blades, spun by the ECS angle each frame
    const fanGroup = new THREE.Group();
    fanGroup.position.set(BEDROOM.fan.anchor.x, BEDROOM.fan.anchor.y, BEDROOM.fan.anchor.z);
    fanGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), this.mat(0x151221)));
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.015, 0.16), this.mat(0x241d38, { rough: 0.6 }));
      blade.position.x = 0.42;
      blade.rotation.z = 0.35;
      const arm = new THREE.Group();
      arm.add(blade);
      arm.rotation.y = (i * Math.PI * 2) / 3;
      fanGroup.add(arm);
    }
    this.fanBlades = fanGroup;
    this.worldGroup.add(fanGroup);
  }

  /** Drop every per-Night mesh: binding twice must not double the scene. */
  private clearNight(): void {
    this.nightGroup.clear();
    // co2Group holds only per-Night objects: plume points and the female mote.
    // Detach and dispose them or old sessions ghost on as frozen trails.
    for (const c of this.co2Group.children) {
      const o = c as THREE.Points | THREE.Sprite;
      if ((o as THREE.Points).isPoints) o.geometry.dispose(); // Sprite shares a module-level geometry
      (o.material as THREE.Material).dispose();
    }
    this.co2Group.clear();
    this.fallbacks = [];
    this.glowBound.clear();
    this.spotRings.clear();
    this.plumes = [];
    this.femaleMote = null;
    for (const m of this.glowMats) m.dispose();
    this.glowMats = [];
    this.heatGlow = [];
  }

  /** Model replaces it once loaded; until then the primitive stays visible. */
  private fallback(mesh: THREE.Object3D): THREE.Object3D {
    mesh.visible = !this.propReady;
    this.fallbacks.push(mesh);
    return mesh;
  }

  /** Hot entity -> which model glows: the body-carrying BEDROOM row at this anchor. */
  private bodyFor(pos: Pos): string | undefined {
    for (const row of Object.values(BEDROOM) as RoomObject[]) {
      if (Math.hypot(row.anchor.x - pos.x, row.anchor.y - pos.y, row.anchor.z - pos.z) < 0.01) return row.body;
    }
    return undefined;
  }

  /** Model-wide Heat: clone the body model's materials and add a fresnel warm
   *  glow to their emissive (edges burn hottest). sync drives uHeat by the same
   *  proximity falloff that drove the old sprite beacons. */
  private bindGlow(id: number, file: string, strength: number, color: THREE.Color): void {
    if (this.glowBound.has(id)) return; // hosts carry "hot" too; bind once
    this.glowBound.add(id);
    const uniforms: Array<{ value: number }> = [];
    for (const wrapper of this.propsGroup.children) {
      if (wrapper.userData.file !== file) continue;
      wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        const uHeat = { value: 0 };
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uHeat = uHeat;
          shader.uniforms.uHeatColor = { value: color };
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform float uHeat;\nuniform vec3 uHeatColor;")
            .replace(
              "#include <emissivemap_fragment>",
              [
                "#include <emissivemap_fragment>",
                "#ifndef FLAT_SHADED",
                "  float heatRim = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);",
                "  totalEmissiveRadiance += uHeatColor * uHeat * (0.25 + 1.5 * heatRim);",
                "#endif",
              ].join("\n"),
            );
        };
        mesh.material = mat;
        this.glowMats.push(mat);
        uniforms.push(uHeat);
      });
    }
    if (uniforms.length > 0) this.heatGlow.push({ id, strength, uniforms });
  }

  /** Bind live ECS entities to view meshes: hosts, hot decoys, spots, plants, plumes, female. */
  bindWorld(world: NightWorld): void {
    this.clearNight();
    for (const id of world.query("host")) {
      const host = world.get<Host>(id, "host")!;
      const pos = world.get<Pos>(id, "pos")!;
      if (host.kind === "human") {
        const body = this.fallback(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 4, 8), this.mat(0xb98d7a, { rough: 0.8 })));
        body.rotation.z = Math.PI / 2;
        body.position.set(pos.x - 0.15, pos.y + 0.08, pos.z);
        body.userData.entity = id;
        this.nightGroup.add(body);
        const head = this.fallback(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), this.mat(0xc9a08c, { rough: 0.8 })));
        head.position.set(pos.x - 0.85, pos.y + 0.12, pos.z);
        head.userData.entity = id;
        this.nightGroup.add(head);
      } else {
        const body = this.fallback(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), this.mat(0x8a6242, { rough: 1 })));
        body.rotation.z = Math.PI / 2;
        body.position.set(pos.x, pos.y + 0.09, pos.z);
        body.userData.entity = id;
        this.nightGroup.add(body);
        const head = this.fallback(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), this.mat(0x9a7050, { rough: 1 })));
        head.position.set(pos.x + 0.24, pos.y + 0.16, pos.z);
        head.userData.entity = id;
        this.nightGroup.add(head);
        for (const dz of [-0.04, 0.04]) {
          const ear = this.fallback(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 6), this.mat(0x8a6242, { rough: 1 })));
          ear.position.set(pos.x + 0.26, pos.y + 0.26, pos.z + dz);
          this.nightGroup.add(ear);
        }
      }

      const warm = host.kind === "human" ? new THREE.Color(1, 0.55, 0.25) : new THREE.Color(1, 0.4, 0.15);
      const bodyFile = this.bodyFor(pos);
      if (bodyFile) this.bindGlow(id, bodyFile, host.kind === "human" ? 0.9 : 0.7, warm);
    }

    for (const id of world.query("hot")) {
      if (this.glowBound.has(id)) continue; // host loop already bound it
      const pos = world.get<Pos>(id, "pos")!;
      const bodyFile = this.bodyFor(pos);
      if (bodyFile) this.bindGlow(id, bodyFile, world.get<Hot>(id, "hot")!.strength, new THREE.Color(1, 0.42, 0.1));
      const prop = this.fallback(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), this.mat(0xffb060, { emissive: 0xffb060, ei: 1.6 })));
      prop.position.set(pos.x, pos.y, pos.z);
      prop.userData.entity = id;
      this.nightGroup.add(prop);
    }

    const spotColor: Record<string, number> = { plain: 0x5a6a8a, ember: 0xd87a30, royal: 0x9a5ae0 };
    for (const id of world.query("eggSpot")) {
      const spot = world.get<EggSpotC>(id, "eggSpot")!;
      const pos = world.get<Pos>(id, "pos")!;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.012, 8, 24),
        new THREE.MeshBasicMaterial({
          color: spotColor[spot.quality]!,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      ring.position.set(pos.x, pos.y + 0.02, pos.z);
      ring.rotation.x = Math.PI / 2;
      ring.userData.entity = id;
      this.nightGroup.add(ring);
      this.spotRings.set(id, ring);
    }

    for (const id of world.query("plant")) {
      const pos = world.get<Pos>(id, "pos")!;
      const pot = this.fallback(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 10), this.mat(0x7a4a3a)));
      pot.position.set(pos.x, pos.y - 0.08, pos.z);
      pot.userData.entity = id;
      this.nightGroup.add(pot);
      for (let i = 0; i < 5; i++) {
        const leaf = this.fallback(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), this.mat(0x2f5a3a, { rough: 1 })));
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(pos.x + Math.cos(a) * 0.05, pos.y + 0.16, pos.z + Math.sin(a) * 0.05);
        leaf.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
        leaf.userData.entity = id;
        this.nightGroup.add(leaf);
      }
    }

    // CO2 plumes: animals only — the plumes system integrates, the view uploads
    const gain = playerState(world)?.mosquito.senseMod ?? 1;
    for (const id of world.query("plume")) {
      const plume = world.get<Plume>(id, "plume")!;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(plume.positions, 3));
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color: 0x7fd8c8,
          size: 0.045,
          map: this.glow,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.5 * gain,
          depthWrite: false,
        }),
      );
      // Particles integrate in place from a parked array (y -10 until the
      // first respawn), so the bounding sphere Three computes on first render
      // is a tiny bubble below the floor — never in the frustum. Never cull.
      points.frustumCulled = false;
      this.co2Group.add(points);
      this.plumes.push({ points, source: id });
    }

    const female = world.query("femalePath")[0];
    if (female !== undefined) {
      this.femaleMote = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: 0xbfe8ff,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.9,
        }),
      );
      this.femaleMote.scale.setScalar(0.09);
      this.co2Group.add(this.femaleMote);
    }
  }

  /** Per-frame sync: camera, fan, Heat, CO2, Egg Spots, the female mote. Null world = menu idle. */
  sync(world: NightWorld | null, channels: SenseChannels): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = performance.now() / 1000;
    const ref = world ? playerState(world) : null;
    if (ref && world) {
      const m = ref.mosquito;
      const p = ref.pos;
      this.camera.quaternion.setFromEuler(new THREE.Euler(m.pitch, m.yaw, m.roll, "YXZ"));
      this.camera.position.set(p.x, p.y, p.z);

      // model-wide heat: the fresnel glow on the body meshes themselves
      for (const fx of this.heatGlow) {
        const hp = world.get<Pos>(fx.id, "pos");
        if (!hp) continue;
        const d = Math.hypot(hp.x - p.x, hp.y - p.y, hp.z - p.z);
        const v = channels.heat ? Math.max(0, 1 - d / HEAT_RANGE) * fx.strength * (0.75 + 0.25 * Math.sin(t * 2.4)) : 0;
        for (const u of fx.uniforms) u.value = v;
      }

      for (const [id, ring] of this.spotRings) {
        const sp = world.get<Pos>(id, "pos")!;
        const used = world.get<EggSpotC>(id, "eggSpot")!.used;
        const d = Math.hypot(sp.x - p.x, sp.y - p.y, sp.z - p.z);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = used ? 0.05 : Math.max(0, 1 - d / SPOT_REVEAL) * (0.5 + Math.sin(t * 2.2) * 0.25);
      }

      // the plumes system advances the arrays; the view only re-uploads them
      for (const plume of this.plumes) {
        plume.points.geometry.getAttribute("position").needsUpdate = true;
      }

      const female = world.query("femalePath")[0];
      if (female !== undefined && this.femaleMote) {
        const fp = world.get<Pos>(female, "pos")!;
        this.femaleMote.position.set(fp.x, fp.y, fp.z);
      }

      const fanId = world.query("fan")[0];
      if (fanId !== undefined && this.fanBlades) {
        this.fanBlades.rotation.y = world.get<Fan>(fanId, "fan")!.angle;
      }

      const vel = world.get<Pos>(ref.player, "vel")!;
      this.updateHero(dt, t, world, m, vel);
    } else {
      this.idleAngle += dt * 0.12;
      this.camera.position.set(Math.cos(this.idleAngle) * 1.6, 1.6 + Math.sin(this.idleAngle * 0.7) * 0.3, Math.sin(this.idleAngle) * 1.4);
      this.camera.lookAt(0.8, 0.9, 0);
      if (this.fanBlades) this.fanBlades.rotation.y += dt * 1.5;
      this.updateHero(dt, t, null, null, null);
    }

    this.worldGroup.visible = channels.world;
    this.co2Group.visible = channels.co2;
    this.composer.render();
  }

  /** Hero pose + flap. In play it rides the camera (the lower-center "you");
   *  wings buzz while flying, fold flat when landed, and the belly swells
   *  while feeding. On the menu it hovers at the idle look target, facing
   *  the drifting camera. Cosmetic only — never touches the sim. */
  private updateHero(dt: number, t: number, world: NightWorld | null, m: Mosquito | null, vel: Pos | null): void {
    if (!this.heroModel) return;
    const mode = world ? "fp" : "menu";
    if (this.heroMode !== mode) {
      this.heroPivot.removeFromParent();
      (mode === "fp" ? this.camera : this.propsGroup).add(this.heroPivot);
      this.heroMode = mode;
    }

    // 1 flying, 0 landed; eases over ~0.25 s on takeoff and touchdown
    if (m) this.heroAir += ((m.landedOn !== null ? 0 : 1) - this.heroAir) * Math.min(1, dt * 7);
    else this.heroAir = 1;
    const air = this.heroAir;

    // wing flap: fast buzz in flight (faster with speed), a slow sweep on the
    // menu, stillness when landed. Pivots rotate around the body axis.
    const speed = vel ? Math.hypot(vel.x, vel.y, vel.z) : 0;
    const rate = mode === "menu" ? 4.5 : 13 + 9 * Math.min(speed, 2.2);
    if (air > 0.02) this.flapPhase = (this.flapPhase + dt * rate * air) % 1;
    const buzz = Math.sin(this.flapPhase * Math.PI * 2);
    const base = mode === "menu" ? 0.35 : 0.5;
    const osc = mode === "menu" ? 0.28 : 0.42;
    const theta = (1 - air) * 0.06 + air * (base + osc * buzz);
    if (this.heroWingR) this.heroWingR.rotation.z = theta;
    if (this.heroWingL) this.heroWingL.rotation.z = -theta;
    if (mode === "fp" && m && vel) {
      // body: bob and sway with the flap beat, pitch with vertical speed
      const bob = air * 0.006 * Math.sin(this.flapPhase * Math.PI + 1);
      this.heroPivot.position.set(0, -0.165 - 0.025 * (1 - air) + bob, -0.3);
      this.heroPivot.rotation.set(0, 0, 0);
      const climb = Math.max(-0.25, Math.min(0.25, vel.y * 0.15)) * air;
      const sway = air * 0.045 * Math.sin(this.flapPhase * Math.PI);
      this.heroModel.rotation.set(-climb + sway * 0.6, Math.PI, sway, "YXZ");
      if (this.heroAbdomen) {
        this.heroAbdomen.scale.setScalar(m.feeding ? 1 + 0.06 * Math.sin(t * 6) : 1);
      }
    } else {
      // menu showpiece: hover at the idle look target, nose toward the camera
      this.heroPivot.position.set(0.8, 1.02 + 0.04 * Math.sin(t * 2.1), 0);
      this.heroPivot.rotation.set(0, Math.atan2(this.camera.position.x - 0.8, this.camera.position.z), 0, "YXZ");
      this.heroModel.rotation.set(0, 0, 0, "YXZ");
      if (this.heroAbdomen) this.heroAbdomen.scale.setScalar(1);
    }
  }

  /** Entity id under normalized device coordinates, for the inspector. */
  raycastEntity(nx: number, ny: number): number | undefined {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.camera);
    for (const h of ray.intersectObjects(this.worldGroup.children, false)) {
      const entity = h.object.userData.entity as number | undefined;
      if (entity !== undefined) return entity;
    }
    return undefined;
  }
}
