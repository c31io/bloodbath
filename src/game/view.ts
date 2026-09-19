import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
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
  private heatSprites = new Map<number, THREE.Sprite>();
  private heatGlow: Array<{ id: number; strength: number; uniforms: Array<{ value: number }> }> = [];
  private glowMats: THREE.Material[] = [];
  private heatGroup = new THREE.Group();
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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.02, 40);
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.16);
    this.scene.background = new THREE.Color(0x03040a);
    this.scene.add(this.worldGroup, this.heatGroup, this.co2Group);
    this.worldGroup.add(this.propsGroup, this.nightGroup);

    this.buildRoom();
    this.buildLights();
    void loadProps(this.propsGroup).then(() => {
      this.propReady = true;
      for (const mesh of this.fallbacks) mesh.visible = false;
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.85, 0.55);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

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
    this.box(0.1, R.h, R.z * 2, R.x, R.h / 2, 0, this.mat(0x2c2540));
    this.box(R.x * 2, R.h, 0.1, 0, R.h / 2, -R.z, this.mat(0x2c2540));
    this.box(R.x * 2, R.h, 0.1, 0, R.h / 2, R.z, this.mat(0x2c2540));

    // sill shelf for the windowsill plant model (its solid lives in SOLIDS, bedroom.ts)
    this.box(1.1, 0.06, 0.32, 0, 1.38, -2.36, this.mat(0x35294a));
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
    this.fallbacks = [];
    this.heatSprites.clear();
    this.spotRings.clear();
    this.plumes = [];
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
      if (!row.body) continue;
      if (Math.hypot(row.anchor.x - pos.x, row.anchor.y - pos.y, row.anchor.z - pos.z) < 0.01) return row.body;
    }
    return undefined;
  }

  /** Model-wide Heat: clone the body model's materials and add a fresnel warm
   *  glow to their emissive (edges burn hottest). sync drives uHeat by the same
   *  proximity falloff as the sprites. */
  private bindGlow(id: number, file: string, strength: number, color: THREE.Color): void {
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
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: warm,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      );
      sprite.position.set(pos.x, pos.y, pos.z);
      sprite.userData.strength = host.kind === "human" ? 0.9 : 0.7;
      this.heatGroup.add(sprite);
      this.heatSprites.set(id, sprite);
      const bodyFile = this.bodyFor(pos);
      if (bodyFile) this.bindGlow(id, bodyFile, sprite.userData.strength as number, warm);
    }

    for (const id of world.query("hot")) {
      if (this.heatSprites.has(id)) continue;
      const hot = world.get<Hot>(id, "hot")!;
      const pos = world.get<Pos>(id, "pos")!;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: new THREE.Color(1, 0.42, 0.1),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      );
      sprite.position.set(pos.x, pos.y, pos.z);
      sprite.userData.strength = hot.strength;
      this.heatGroup.add(sprite);
      this.heatSprites.set(id, sprite);
      const bodyFile = this.bodyFor(pos);
      if (bodyFile) this.bindGlow(id, bodyFile, hot.strength, new THREE.Color(1, 0.42, 0.1));

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

      for (const [id, sprite] of this.heatSprites) {
        const hp = world.get<Pos>(id, "pos");
        if (!hp) continue;
        const strength = (sprite.userData.strength as number | undefined) ?? 0.7;
        const d = Math.hypot(hp.x - p.x, hp.y - p.y, hp.z - p.z);
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = Math.max(0, 1 - d / HEAT_RANGE) * 0.6 * strength;
        sprite.scale.setScalar(0.5 + Math.sin(t * 3) * 0.04);
      }

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
    } else {
      this.idleAngle += dt * 0.12;
      this.camera.position.set(Math.cos(this.idleAngle) * 1.6, 1.6 + Math.sin(this.idleAngle * 0.7) * 0.3, Math.sin(this.idleAngle) * 1.4);
      this.camera.lookAt(0.8, 0.9, 0);
      if (this.fanBlades) this.fanBlades.rotation.y += dt * 1.5;
    }

    this.worldGroup.visible = channels.world;
    this.heatGroup.visible = channels.heat;
    this.co2Group.visible = channels.co2;
    this.composer.render();
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
