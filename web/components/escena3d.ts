/**
 * Escena 3D de la portada (Three.js): una cancha de noche, el balón en el punto central
 * y el pozo como una torre de monedas. Hay una moneda por participante, y el número sale
 * del contrato: cuando alguien se une, cae una moneda nueva.
 *
 * Este archivo se carga aparte (import dinámico) para no frenar el resto de la página.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Escena = {
  setMonedas: (n: number) => void;
  destruir: () => void;
};

type Opciones = { monedas: number; reducido: boolean };

const COLORES = {
  noche: 0x04170f,
  cespedA: "#0d5c3b",
  cespedB: "#10693f",
  tiza: 0xf4f6f1,
  marcador: 0xffc531,
  balonBlanco: new THREE.Color(0xf2f3ee),
  balonNegro: new THREE.Color(0x16181b),
};

const MAX_MONEDAS = 30;
const RADIO_MONEDA = 0.56;
const ALTO_MONEDA = 0.14;
const POS_BALON = new THREE.Vector3(0, 0.62, 0.9);
const POS_POZO = new THREE.Vector3(1.2, 0, 1.35);

export function montarEscena(contenedor: HTMLElement, opciones: Opciones): Escena | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  } catch {
    return null; // sin WebGL: queda el fondo de respaldo en CSS
  }

  const reducido = opciones.reducido;
  // estado del bucle de dibujo (declarado antes de cualquier pedirCuadro)
  let visible = true;
  let cuadro = 0;
  let anterior = performance.now();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLORES.noche);
  escena.fog = new THREE.Fog(COLORES.noche, 11, 34);

  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  // Reflejos suaves para que las monedas brillen como metal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const entorno = new RoomEnvironment();
  escena.environment = pmrem.fromScene(entorno, 0.04).texture;
  escena.environmentIntensity = 0.55;
  entorno.dispose?.();
  pmrem.dispose();
  const desechables: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (desechables.push(x), x);

  // ---------- Cancha ----------
  const texCesped = guardar(new THREE.CanvasTexture(franjasCesped()));
  texCesped.colorSpace = THREE.SRGBColorSpace;
  texCesped.wrapS = texCesped.wrapT = THREE.RepeatWrapping;
  texCesped.repeat.set(1, 8);
  texCesped.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const cancha = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(80, 80)),
    guardar(
      new THREE.MeshStandardMaterial({ map: texCesped, roughness: 0.95, envMapIntensity: 0.15 }),
    ),
  );
  cancha.rotation.x = -Math.PI / 2;
  cancha.receiveShadow = true;
  escena.add(cancha);

  const matTiza = guardar(
    new THREE.MeshBasicMaterial({ color: COLORES.tiza, transparent: true, opacity: 0.6 }),
  );
  const circulo = new THREE.Mesh(guardar(new THREE.RingGeometry(2.6, 2.68, 128)), matTiza);
  circulo.rotation.x = -Math.PI / 2;
  circulo.position.set(POS_BALON.x, 0.004, POS_BALON.z);
  const lineaMedia = new THREE.Mesh(guardar(new THREE.PlaneGeometry(80, 0.08)), matTiza);
  lineaMedia.rotation.x = -Math.PI / 2;
  lineaMedia.position.set(POS_BALON.x, 0.004, POS_BALON.z);
  escena.add(circulo, lineaMedia);

  // ---------- Balón (parches negros donde caen los 12 vértices del icosaedro) ----------
  const balon = new THREE.Mesh(
    guardar(geometriaBalon(0.62)),
    guardar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 })),
  );
  balon.position.copy(POS_BALON);
  balon.rotation.set(0.35, 0.6, 0.1);
  balon.castShadow = true;
  escena.add(balon);

  // ---------- Monedas del pozo ----------
  const texCara = guardar(new THREE.CanvasTexture(caraMoneda()));
  texCara.colorSpace = THREE.SRGBColorSpace;
  const matCanto = guardar(
    new THREE.MeshStandardMaterial({ color: 0xe0a400, metalness: 0.85, roughness: 0.32 }),
  );
  const matCara = guardar(
    new THREE.MeshStandardMaterial({ map: texCara, metalness: 0.7, roughness: 0.35 }),
  );
  const geoMoneda = guardar(
    new THREE.CylinderGeometry(RADIO_MONEDA, RADIO_MONEDA, ALTO_MONEDA, 56),
  );
  const pozo = new THREE.Group();
  pozo.position.copy(POS_POZO);
  escena.add(pozo);

  // Marca en el pasto cuando el pozo está vacío.
  const marcaVacia = new THREE.Mesh(
    guardar(new THREE.RingGeometry(RADIO_MONEDA - 0.05, RADIO_MONEDA, 64)),
    guardar(
      new THREE.MeshBasicMaterial({ color: COLORES.marcador, transparent: true, opacity: 0.55 }),
    ),
  );
  marcaVacia.rotation.x = -Math.PI / 2;
  marcaVacia.position.set(POS_POZO.x, 0.006, POS_POZO.z);
  escena.add(marcaVacia);

  let primeraVez = true;
  type Moneda = {
    malla: THREE.Mesh;
    inicio: number;
    yFinal: number;
    giro: number;
    pendiente: boolean;
  };
  const monedas: Moneda[] = [];

  function setMonedas(n: number) {
    const objetivo = Math.max(0, Math.min(MAX_MONEDAS, Math.floor(n)));
    const ahora = performance.now();
    // Si bajan (contrato nuevo), se quitan de arriba hacia abajo.
    while (monedas.length > objetivo) {
      const m = monedas.pop()!;
      pozo.remove(m.malla);
    }
    // Si suben, caen una tras otra. La primera vez se deja ver la cancha vacía un instante.
    let retraso = primeraVez ? 450 : 0;
    primeraVez = false;
    while (monedas.length < objetivo) {
      const i = monedas.length;
      const malla = new THREE.Mesh(geoMoneda, [matCanto, matCara, matCara]);
      malla.castShadow = true;
      malla.receiveShadow = true;
      // pequeñas imperfecciones para que parezca una torre real
      malla.position.x = (azar(i * 3.1) - 0.5) * 0.07;
      malla.position.z = (azar(i * 7.7) - 0.5) * 0.07;
      malla.rotation.y = Math.PI / 2 + (azar(i * 1.3) - 0.5) * 0.5; // el "0,01" de la cara queda legible
      const yFinal = ALTO_MONEDA / 2 + i * (ALTO_MONEDA + 0.004);
      // Si la portada no está a la vista (por ejemplo, te uniste más abajo en la página),
      // la moneda espera y cae cuando vuelves a verla.
      const pendiente = !visible && !reducido;
      const moneda = {
        malla,
        inicio: pendiente ? Infinity : ahora + retraso,
        yFinal,
        giro: 0.9 + azar(i) * 0.8,
        pendiente,
      };
      monedas.push(moneda);
      pozo.add(malla);
      colocarMoneda(moneda, reducido ? Infinity : ahora);
      retraso += 170;
    }
    marcaVacia.visible = monedas.length === 0;
    pedirCuadro();
  }

  function colocarMoneda(m: Moneda, ahora: number) {
    const p = Math.min(1, Math.max(0, (ahora - m.inicio) / 900));
    const altura = 4.5;
    m.malla.visible = ahora >= m.inicio || p === 1;
    m.malla.position.y = m.yFinal + altura * (1 - rebote(p));
    m.malla.rotation.x = (1 - suavizar(p)) * m.giro;
    m.malla.rotation.z = (1 - suavizar(p)) * m.giro * 0.4;
  }

  // ---------- Luces de estadio ----------
  escena.add(new THREE.HemisphereLight(0xcfe9d8, 0x062618, 0.7));
  const foco = new THREE.SpotLight(0xfff4dd, 3.2, 0, 0.55, 0.7, 0);
  foco.position.set(-5, 12, 9);
  foco.target.position.set(0.8, 0, 0.4);
  foco.castShadow = true;
  foco.shadow.mapSize.set(1024, 1024);
  foco.shadow.bias = -0.0004;
  escena.add(foco, foco.target);
  const contraluz = new THREE.DirectionalLight(COLORES.marcador, 0.9);
  contraluz.position.set(6, 4, -6);
  escena.add(contraluz);

  // Torres de iluminación a lo lejos.
  const texHalo = guardar(new THREE.CanvasTexture(halo()));
  for (const x of [-16, 14]) {
    const s = new THREE.Sprite(
      guardar(
        new THREE.SpriteMaterial({
          map: texHalo,
          color: 0xfff1cf,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      ),
    );
    s.position.set(x, 6.5, -30);
    s.scale.set(4.5, 4.5, 1);
    escena.add(s);
  }

  // ---------- Encuadre según el ancho de pantalla ----------
  const base = { pos: new THREE.Vector3(), mira: new THREE.Vector3() };
  function encuadrar(ancho: number, alto: number) {
    camara.aspect = ancho / alto;
    if (camara.aspect >= 1.15) {
      // escritorio: los objetos a la derecha, el texto a la izquierda
      base.pos.set(-1.55, 2.1, 7.6);
      base.mira.set(-1.45, 0.75, 0);
    } else {
      // celular: objetos centrados y abajo, el texto arriba
      base.pos.set(0.8, 3.4, 11.5);
      base.mira.set(0.8, 2.2, 0);
    }
    camara.updateProjectionMatrix();
  }

  const tam = () => {
    const w = Math.max(1, contenedor.clientWidth);
    const h = Math.max(1, contenedor.clientHeight);
    renderer.setSize(w, h, false);
    encuadrar(w, h);
    pedirCuadro();
  };
  const observador = new ResizeObserver(tam);
  observador.observe(contenedor);
  tam();

  // ---------- Paralaje suave con el puntero (responde a la persona) ----------
  const puntero = new THREE.Vector2();
  const suave = new THREE.Vector2();
  const alMover = (e: PointerEvent) => {
    puntero.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    pedirCuadro();
  };
  if (!reducido) window.addEventListener("pointermove", alMover, { passive: true });

  // ---------- Bucle (se pausa fuera de pantalla) ----------
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) return;
    let retraso = 250;
    for (const m of monedas) {
      if (!m.pendiente) continue;
      m.pendiente = false;
      m.inicio = performance.now() + retraso;
      retraso += 170;
    }
    pedirCuadro();
  });
  io.observe(contenedor);

  function pedirCuadro() {
    if (!cuadro) cuadro = requestAnimationFrame(dibujar);
  }

  function dibujar(ahora: number) {
    cuadro = 0;
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;

    let animando = false;
    for (const m of monedas) {
      colocarMoneda(m, reducido ? Infinity : ahora);
      if (!reducido && !m.pendiente && ahora < m.inicio + 900) animando = true;
    }
    if (!reducido) {
      balon.rotation.y += dt * 0.35;
      suave.lerp(puntero, 0.06);
      animando = true;
    }
    camara.position.set(base.pos.x + suave.x * 0.45, base.pos.y - suave.y * 0.25, base.pos.z);
    camara.lookAt(base.mira);
    renderer.render(escena, camara);

    if (animando && visible && !document.hidden) pedirCuadro();
  }

  const alCambiarVisibilidad = () => !document.hidden && pedirCuadro();
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  setMonedas(opciones.monedas);

  return {
    setMonedas,
    destruir() {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", alMover);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      desechables.forEach((d) => d.dispose());
      escena.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function geometriaBalon(radio: number) {
  // Balón clásico = icosaedro truncado: 12 pentágonos negros y 20 hexágonos blancos.
  // Cada punto de la esfera toma el color de la cara del poliedro que "ve" primero.
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");
  const vertices: THREE.Vector3[] = [];
  const caras: THREE.Vector3[] = [];
  for (let i = 0; i < ico.count; i += 3) {
    const tri = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(ico, i + k));
    caras.push(tri[0].clone().add(tri[1]).add(tri[2]).normalize());
    for (const v of tri) if (!vertices.some((p) => p.distanceTo(v) < 1e-4)) vertices.push(v);
  }
  // Distancias del centro a cada tipo de cara (cortando cada arista en tercios).
  const [v0, v1, v2] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(ico, k));
  const corte = v0.clone().lerp(v1, 1 / 3);
  const dPent = corte.dot(v0.clone().normalize());
  const dHex = corte.dot(v0.clone().add(v1).add(v2).normalize());
  const pentagonos = vertices.map((v) => v.clone().normalize());

  const geo = new THREE.IcosahedronGeometry(radio, 28); // no indexada: 3 vértices por cara
  const pos = geo.getAttribute("position");
  const colores = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const p = a.add(b).add(c).normalize();
    let pent = -Infinity;
    for (const n of pentagonos) pent = Math.max(pent, p.dot(n) / dPent);
    let hex = -Infinity;
    for (const n of caras) hex = Math.max(hex, p.dot(n) / dHex);
    const col = pent > hex ? COLORES.balonNegro : COLORES.balonBlanco;
    for (let k = 0; k < 3; k++) col.toArray(colores, (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  // normales de esfera perfecta: superficie suave, parches con borde nítido
  const normales = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    a.fromBufferAttribute(pos, i)
      .normalize()
      .toArray(normales, i * 3);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normales, 3));
  return geo;
}

function franjasCesped() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = COLORES.cespedA;
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = COLORES.cespedB;
  ctx.fillRect(0, 128, 64, 128);
  return c;
}

function caraMoneda() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(100, 90, 10, 128, 128, 128);
  g.addColorStop(0, "#ffe08a");
  g.addColorStop(1, "#f2b705");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(120, 78, 0, 0.55)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(110, 70, 0, 0.75)";
  ctx.font = "bold 64px Bahnschrift, 'DIN Alternate', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0,01", 128, 132);
  return c;
}

function halo() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(255,244,210,0.8)");
  g.addColorStop(1, "rgba(255,244,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/** Número pseudoaleatorio estable entre 0 y 1 (la torre se ve igual en cada visita). */
function azar(semilla: number) {
  const x = Math.sin(semilla * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function suavizar(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

/** Caída con un par de rebotes chicos, como una moneda que aterriza en la torre. */
function rebote(p: number) {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}
