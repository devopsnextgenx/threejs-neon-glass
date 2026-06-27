// ============================================================================
// Graphify - Glass & Neon 3D Graph Visualization
// Reusable ES module. Drop <div id="canvas-container"></div> on any page,
// add the control/side-panel markup, and call: new Graph(container, dataUrl).
// ----------------------------------------------------------------------------
// Glass style  -> Codrops "transparent glass & plastic" technique:
//                 MeshPhysicalMaterial(transmission) + IBL environment map.
// Neon style   -> Rahultron-like emissive spheres + UnrealBloom glow.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ----------------------------------------------------------------------------
// Palette - community colors (shared by nodes & links)
// ----------------------------------------------------------------------------
const COMMUNITY_COLORS = [0x4a90e2, 0xe2554a, 0x39d98a, 0xe2a44a, 0x9b5de5, 0x00bbf9];

function communityColor(index) {
    return COMMUNITY_COLORS[index % COMMUNITY_COLORS.length];
}

// Build a smooth vertical gradient texture used as the scene background so the
// glass has something interesting to refract.
function makeGradientTexture(topHex, bottomHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, topHex);
    grad.addColorStop(1, bottomHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// ============================================================================
// Material Factory - creates the run-time swappable looks
// ============================================================================
class MaterialFactory {
    // Very clear, highly transparent glass with only a faint hue (Codrops
    // technique). The body stays almost white so the sphere reads as clear,
    // but a small `surfaceTint` (fraction, e.g. 0.05 = 5%) plus a desaturated
    // `attenuationColor` give it just a touch of color. `transparency` maps to
    // transmission (0.90..0.98 => see-through). `tint` nudges absorption hue.
    static glass(color, { tint = 0.5, surfaceTint = 0.05, transparency = 0.95, thickness = 1.5 } = {}) {
        const base = new THREE.Color(color);
        // Surface tint: mostly white with a whisper of the hue (2%-15% typical).
        const s = Math.max(0, Math.min(surfaceTint, 0.5));
        const surface = new THREE.Color(0xffffff).lerp(base, s);
        // Attenuation color keeps some hue (desaturated ~40% toward white).
        const hue = base.clone().lerp(new THREE.Color(0xffffff), 0.4);
        const mat = new THREE.MeshPhysicalMaterial({
            color: surface,
            metalness: 0.0,
            roughness: 0.015,
            transmission: transparency,    // high => light passes through
            transparent: true,
            opacity: 1.0,
            thickness: thickness * 1.4,     // optical depth -> refraction distortion
            ior: 1.5,                       // real-glass index of refraction
            envMapIntensity: 1.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            attenuationColor: hue,
            // Large distance => almost no absorption => clear, not opaque.
            attenuationDistance: 18.0 + (1 - tint) * 40.0,
            specularIntensity: 1.0,
            iridescence: 0.05,
            iridescenceIOR: 1.2,
        });
        // Chromatic dispersion bends RGB slightly differently for realism
        // (three.js r162+). Guarded so older builds don't warn.
        if ('dispersion' in mat) mat.dispersion = 3.0;
        return mat;
    }

    // Small opaque core that sits INSIDE the glass shell. three.js skips
    // transmissive objects when building the transmission buffer, so glass
    // spheres can't refract each other. An opaque core IS captured, so other
    // nodes become visible (and refraction-distorted) through the glass.
    static core(color) {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            roughness: 0.45,
            metalness: 0.0,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.18,
            envMapIntensity: 0.4,
        });
    }

    // Glowing emissive sphere/cylinder (Rahultron look). Bloom does the halo.
    static neon(color, { emissive = 1.6 } = {}) {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x000000),
            roughness: 0.35,
            metalness: 0.0,
            emissive: new THREE.Color(color),
            emissiveIntensity: emissive,
            envMapIntensity: 0.2,
        });
    }
}

// ============================================================================
// Scene Manager - owns renderer, camera, lights, env map, post-processing
// ============================================================================
class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        // Separate overlay scene for labels so they stay crisp and are NOT
        // affected by bloom (keeps neon-mode labels identical to glass mode).
        this.labelScene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            55, window.innerWidth / window.innerHeight, 0.1, 2000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.currentStyle = 'glass';
        this.isDarkTheme = true;
        this.tint = 0.5;
        this.surfaceTint = 0.05;
        this.transparency = 0.95;
        this.linkThickness = 2.0;
        this.linkFillet = 1.0;
        this.brightness = 0.25;
        this.baseExposure = 1.1;
        this.nodesByIds = new Map();
        this.linksByIds = new Map();

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selected = null;
        this.clock = new THREE.Clock();

        this._setupRenderer();
        this._setupCamera();
        this._setupEnvironment();
        this._setupLights();
        this._setupComposer();
        this._setupControls();
        this._applyBackground();

        window.addEventListener('resize', () => this.onResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);
    }

    _setupCamera() {
        this.camera.position.set(0, 6, 34);
        this.camera.lookAt(0, 0, 0);
    }

    // Image-based lighting - the secret to believable glass refraction.
    _setupEnvironment() {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = this.envMap;
    }

    _setupLights() {
        this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        this.keyLight.position.set(8, 14, 10);
        this.scene.add(this.keyLight);

        this.rimLight = new THREE.DirectionalLight(0x88aaff, 1.2);
        this.rimLight.position.set(-12, -6, -8);
        this.scene.add(this.rimLight);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
        this.scene.add(this.ambientLight);

        // Remember base intensities so the brightness slider can scale them.
        this._baseLight = {
            key: this.keyLight.intensity,
            rim: this.rimLight.intensity,
            ambient: this.ambientLight.intensity,
            env: 1.0,
        };
    }

    _setupComposer() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.35, 0.5, 0.85
        );
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
    }

    _setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.8;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 120;
    }

    // Background + bloom depend on both the theme and the active style.
    _applyBackground() {
        let top, bottom;
        if (this.currentStyle === 'neon') {
            top = this.isDarkTheme ? '#0a0a16' : '#1a1a2e';
            bottom = this.isDarkTheme ? '#02030a' : '#0d0d1a';
        } else {
            top = this.isDarkTheme ? '#243049' : '#eaf0fb';
            bottom = this.isDarkTheme ? '#05070e' : '#b9c8e6';
        }
        if (this.background) this.background.dispose();
        this.background = makeGradientTexture(top, bottom);
        this.scene.background = this.background;
    }

    setTheme(isDark) {
        this.isDarkTheme = isDark;
        this._applyBackground();
    }

    setStyle(style) {
        this.currentStyle = style;
        if (style === 'neon') {
            this.bloomPass.strength = 1.15;
            this.bloomPass.radius = 0.7;
            this.bloomPass.threshold = 0.0;
            this.baseExposure = 1.0;
        } else {
            this.bloomPass.strength = 0.35;
            this.bloomPass.radius = 0.5;
            this.bloomPass.threshold = 0.85;
            this.baseExposure = 1.1;
        }
        this._applyBrightness();
        this._applyBackground();
        this.nodesByIds.forEach((n) => n.updateMaterial(style));
        this.linksByIds.forEach((l) => l.updateMaterial(style));
    }

    // Brightness multiplier (~0.3..2.5) scales scene exposure and lights.
    setBrightness(value) {
        this.brightness = value;
        this._applyBrightness();
    }

    _applyBrightness() {
        const b = this.brightness;
        this.renderer.toneMappingExposure = this.baseExposure * b;
        if (this.keyLight) this.keyLight.intensity = this._baseLight.key * b;
        if (this.rimLight) this.rimLight.intensity = this._baseLight.rim * b;
        if (this.ambientLight) this.ambientLight.intensity = this._baseLight.ambient * b;
    }

    setTint(value) {
        this.tint = value;
        if (this.currentStyle === 'glass') {
            this.nodesByIds.forEach((n) => n.updateMaterial('glass'));
            this.linksByIds.forEach((l) => l.updateMaterial('glass'));
        }
    }

    // Surface tint as a fraction (0.02 = 2%, 0.15 = 15%).
    setSurfaceTint(value) {
        this.surfaceTint = value;
        if (this.currentStyle === 'glass') {
            this.nodesByIds.forEach((n) => n.updateMaterial('glass'));
            this.linksByIds.forEach((l) => l.updateMaterial('glass'));
        }
    }

    // Transparency as transmission (0.90 = 90% .. 0.98 = 98% see-through).
    setTransparency(value) {
        this.transparency = value;
        if (this.currentStyle === 'glass') {
            this.nodesByIds.forEach((n) => n.updateMaterial('glass'));
            this.linksByIds.forEach((l) => l.updateMaterial('glass'));
        }
    }

    // Link/cylinder diameter multiplier (1.0 = default).
    setLinkThickness(value) {
        this.linkThickness = value;
        this.linksByIds.forEach((l) => l.update());
    }

    // Fillet radius (world units) blending links into spheres organically.
    setLinkFillet(value) {
        this.linkFillet = value;
        this.linksByIds.forEach((l) => l.update());
    }

    setAutoRotate(enabled) {
        this.controls.autoRotate = enabled;
    }

    resetView() {
        this.camera.position.set(0, 6, 34);
        this.controls.target.set(0, 0, 0);
    }

    // Dolly the camera toward/away from the orbit target.
    // factor < 1 zooms in, factor > 1 zooms out.
    zoom(factor) {
        const offset = new THREE.Vector3()
            .subVectors(this.camera.position, this.controls.target);
        let dist = offset.length() * factor;
        dist = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, dist));
        offset.setLength(dist);
        this.camera.position.copy(this.controls.target).add(offset);
    }

    // Toggle left-drag panning (otherwise left-drag rotates). Right-drag always pans.
    setPanMode(on) {
        this.panMode = on;
        if (on) {
            this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            this.controls.autoRotate = false;
        } else {
            this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        }
    }

    // Frame the whole graph: recenter the target and fit all nodes in view.
    centerView() {
        const box = new THREE.Box3();
        this.nodesByIds.forEach((n) => {
            box.expandByPoint(new THREE.Vector3(
                n.position.x, n.position.y, n.position.z
            ));
        });
        if (box.isEmpty()) {
            this.resetView();
            return;
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 4) * 0.5;
        const fov = (this.camera.fov * Math.PI) / 180;
        const dist = (radius / Math.sin(fov / 2)) * 1.5;

        const dir = new THREE.Vector3()
            .subVectors(this.camera.position, this.controls.target)
            .normalize();
        if (dir.lengthSq() === 0) dir.set(0, 0.3, 1).normalize();

        this.controls.target.copy(center);
        this.camera.position.copy(center).addScaledVector(dir, dist);
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
    }

    onPointerDown(event) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const meshes = [];
        this.nodesByIds.forEach((n) => meshes.push(n.mesh));
        this.linksByIds.forEach((l) => l.meshes.forEach((m) => meshes.push(m)));

        const hits = this.raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
            this.selectObject(hits[0].object.userData.owner);
        } else {
            this.deselectObject();
        }
    }

    selectObject(owner) {
        if (!owner) return;
        this.deselectObject();
        this.selected = owner;
        owner.highlight();
        this.showDetailsPanel(owner);
    }

    deselectObject() {
        if (this.selected) this.selected.unhighlight();
        this.selected = null;
        this.hideDetailsPanel();
    }

    showDetailsPanel(owner) {
        const panel = document.querySelector('.side-panel');
        const content = document.getElementById('sidePanelContent');
        const d = owner.data;
        let html;

        if (owner.isNode) {
            html = `
                <div class="detail-group">
                    <div class="detail-label">Node ID</div>
                    <div class="detail-value">${d.id}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Label</div>
                    <div class="detail-value">${d.label}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Source File</div>
                    <div class="detail-value">${d.source_file ?? '—'}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${d.source_location ?? '—'}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Weight</div>
                    <div class="detail-value">${Math.round((d.weight ?? 0) * 100)}%</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Community</div>
                    <span class="detail-badge">Community ${d.community}</span>
                </div>`;
        } else {
            html = `
                <div class="detail-group">
                    <div class="detail-label">Connection</div>
                    <div class="detail-value">${d.source} &rarr; ${d.target}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Relation Type</div>
                    <span class="detail-badge">${d.relation ?? 'link'}</span>
                </div>`;
        }

        content.innerHTML = html;
        panel.classList.add('active');
    }

    hideDetailsPanel() {
        const panel = document.querySelector('.side-panel');
        const content = document.getElementById('sidePanelContent');
        content.innerHTML = '<p class="empty-state">Select a node or link to view details</p>';
        panel.classList.remove('active');
    }

    start() {
        const tick = () => {
            requestAnimationFrame(tick);
            const t = this.clock.getElapsedTime();
            // Gentle floating shimmer on nodes (links stay attached visually).
            this.nodesByIds.forEach((n) => n.animate(t));
            this.controls.update();
            this.composer.render();
            // Draw labels on top of the bloomed image so they read clearly in
            // both glass and neon modes.
            this.renderer.autoClear = false;
            this.renderer.clearDepth();
            this.renderer.render(this.labelScene, this.camera);
            this.renderer.autoClear = true;
        };
        tick();
    }
}

// ============================================================================
// Node - a graph node rendered as a sphere, sized by weight
// ============================================================================
class Node {
    constructor(data, sceneManager) {
        this.data = data;
        this.sceneManager = sceneManager;
        this.isNode = true;

        this.radius = 0.7 + (data.weight ?? 0.5) * 1.8;
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30
        );

        const geometry = new THREE.SphereGeometry(this.radius, 48, 48);
        const material = MaterialFactory.glass(this.color(), {
            tint: sceneManager.tint,
            surfaceTint: sceneManager.surfaceTint,
            transparency: sceneManager.transparency,
            thickness: this.radius,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.userData.owner = this;
        sceneManager.scene.add(this.mesh);

        // Opaque inner core so this node is visible (and refracted) through
        // OTHER glass spheres. Hidden in neon mode (the shell glows instead).
        const coreGeo = new THREE.SphereGeometry(this.radius * 0.5, 32, 32);
        this.core = new THREE.Mesh(coreGeo, MaterialFactory.core(this.color()));
        this.core.position.copy(this.position);
        this.core.userData.owner = this;
        sceneManager.scene.add(this.core);

        this._phase = Math.random() * Math.PI * 2;
        this._addLabel();
    }

    color() {
        return communityColor(this.data.community);
    }

    _addLabel() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(10, 12, 20, 0.72)';
        ctx.roundRect ? ctx.roundRect(4, 12, 248, 40, 10) : ctx.rect(4, 12, 248, 40);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.data.label ?? this.data.id, 128, 33);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.label = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, transparent: true, depthWrite: false, toneMapped: false,
        }));
        this.label.scale.set(4, 1, 1);
        // Labels live in the overlay scene (rendered after bloom).
        this.sceneManager.labelScene.add(this.label);
        this._positionLabel();
    }

    _positionLabel() {
        this.label.position.set(
            this.position.x,
            this.position.y + this.radius + 1.2,
            this.position.z
        );
    }

    setPosition(vec) {
        this.position.copy(vec);
        this.mesh.position.copy(vec);
        this.core.position.copy(vec);
        this._positionLabel();
    }

    updateMaterial(style) {
        this.mesh.material.dispose();
        this.mesh.material = style === 'neon'
            ? MaterialFactory.neon(this.color())
            : MaterialFactory.glass(this.color(), {
                tint: this.sceneManager.tint,
                surfaceTint: this.sceneManager.surfaceTint,
                transparency: this.sceneManager.transparency,
                thickness: this.radius,
            });
        // Core only matters for glass refraction; neon shell glows on its own.
        this.core.visible = style !== 'neon';
    }

    animate(t) {
        const y = Math.sin(t * 0.8 + this._phase) * 0.12;
        this.mesh.position.y = this.position.y + y;
        this.core.position.y = this.position.y + y;
        this.label.position.y = this.position.y + this.radius + 1.2 + y;
    }

    highlight() {
        this.mesh.scale.setScalar(1.25);
        this.core.scale.setScalar(1.25);
    }

    unhighlight() {
        this.mesh.scale.setScalar(1.0);
        this.core.scale.setScalar(1.0);
    }
}

// ============================================================================
// Link - a connection rendered as a thin cylinder between two nodes
// ============================================================================
class Link {
    constructor(data, sourceNode, targetNode, sceneManager) {
        this.data = data;
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.sceneManager = sceneManager;
        this.isNode = false;

        const style = sceneManager.currentStyle;
        // Three parts share one transform group: the two fillet ends take their
        // connected sphere's exact glass look, the straight middle keeps the
        // blended link colour. Geometry is rebuilt per-layout in world units.
        this.group = new THREE.Group();
        this.endA = new THREE.Mesh(new THREE.BufferGeometry(), this._endMaterial(sourceNode, style));
        this.mid = new THREE.Mesh(new THREE.BufferGeometry(), this._midMaterial(style));
        this.endB = new THREE.Mesh(new THREE.BufferGeometry(), this._endMaterial(targetNode, style));
        this.meshes = [this.endA, this.mid, this.endB];
        this.meshes.forEach((m) => { m.userData.owner = this; this.group.add(m); });
        sceneManager.scene.add(this.group);

        this.update();
    }

    color() {
        const a = new THREE.Color(communityColor(this.sourceNode.data.community));
        const b = new THREE.Color(communityColor(this.targetNode.data.community));
        return a.lerp(b, 0.5).getHex();
    }

    // Fillet end material: the connected sphere's exact glass (or neon) look.
    _endMaterial(node, style) {
        return style === 'neon'
            ? MaterialFactory.neon(node.color(), { emissive: 1.1 })
            : MaterialFactory.glass(node.color(), {
                tint: this.sceneManager.tint,
                surfaceTint: this.sceneManager.surfaceTint,
                transparency: this.sceneManager.transparency,
                thickness: node.radius,
            });
    }

    // Straight middle material: the blended source/target link colour.
    _midMaterial(style) {
        return style === 'neon'
            ? MaterialFactory.neon(this.color(), { emissive: 1.1 })
            : MaterialFactory.glass(this.color(), {
                tint: this.sceneManager.tint,
                surfaceTint: this.sceneManager.surfaceTint,
                transparency: this.sceneManager.transparency,
                thickness: 0.4,
            });
    }

    // Build the three lathe segments. Each end is an external fillet: a concave
    // cove tangent to the cylinder (radius R) and tangent to the sphere surface,
    // with its wide rim lying exactly ON the sphere surface. `len` is the
    // centre-to-centre length. Returns { endAGeo, midGeo, endBGeo } (nulls when
    // a segment degenerates, e.g. no fillet or a very short link).
    _buildGeometries(len) {
        const R = 0.12 * (this.sceneManager.linkThickness ?? 1) * (this._highlightScale ?? 1);
        const rA = this.sourceNode.radius;
        const rB = this.targetNode.radius;
        const f = Math.max(0, this.sceneManager.linkFillet ?? 0);
        const seg = 14;

        const v = (rho, y) => new THREE.Vector2(Math.max(0.001, rho), y);
        const lathe = (profile) => new THREE.LatheGeometry(profile, 20);

        // Fillet arc (radius f) tangent to the cylinder line rho=R and tangent
        // to a sphere of radius rS centred on the axis. Arc points run from the
        // sphere-tangent rim (small y) to the cylinder tangent (y=yp), measured
        // from the sphere centre. null if the fillet can't seat.
        const fillet = (rS) => {
            if (f <= 1e-4) return null;
            const Rp = R + f;                       // arc-centre radial distance
            const ypSq = (rS + f) * (rS + f) - Rp * Rp;
            if (ypSq <= 1e-6) return null;          // fillet too large to seat
            const yp = Math.sqrt(ypSq);             // arc-centre axial position
            const alpha = Math.atan2(yp, Rp);
            const arc = [];
            for (let i = 0; i <= seg; i++) {
                const th = (Math.PI + alpha) - alpha * (i / seg);
                arc.push({ rho: Rp + f * Math.cos(th), y: yp + f * Math.sin(th) });
            }
            return { yp, arc };
        };

        const fA = fillet(rA);
        const fB = fillet(rB);
        const yStartA = fA ? fA.yp : Math.sqrt(Math.max(0, rA * rA - R * R));
        const yStartB = fB ? (len - fB.yp) : (len - Math.sqrt(Math.max(0, rB * rB - R * R)));

        let endAGeo = null;
        let midGeo = null;
        let endBGeo = null;

        if (fA && fA.yp < yStartB) {
            endAGeo = lathe(fA.arc.map((p) => v(p.rho, p.y)));
        }
        if (yStartB > yStartA + 1e-3) {
            midGeo = lathe([v(R, yStartA), v(R, yStartB)]);
        }
        if (fB && (len - fB.yp) > yStartA) {
            const prof = [];
            for (let i = fB.arc.length - 1; i >= 0; i--) {
                prof.push(v(fB.arc[i].rho, len - fB.arc[i].y));
            }
            endBGeo = lathe(prof);
        }
        return { endAGeo, midGeo, endBGeo };
    }

    _swapGeo(mesh, geo) {
        mesh.geometry.dispose();
        mesh.geometry = geo ?? new THREE.BufferGeometry();
        mesh.visible = !!geo;
    }

    // Rebuild + orient the segments so they span source -> target.
    update() {
        const start = this.sourceNode.position;
        const end = this.targetNode.position;
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();

        const { endAGeo, midGeo, endBGeo } = this._buildGeometries(len);
        this._swapGeo(this.endA, endAGeo);
        this._swapGeo(this.mid, midGeo);
        this._swapGeo(this.endB, endBGeo);

        // Geometry runs along +Y from 0 (source) to len (target).
        this.group.position.copy(start);
        this.group.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), dir.clone().normalize()
        );
    }

    updateMaterial(style) {
        this.endA.material.dispose();
        this.mid.material.dispose();
        this.endB.material.dispose();
        this.endA.material = this._endMaterial(this.sourceNode, style);
        this.mid.material = this._midMaterial(style);
        this.endB.material = this._endMaterial(this.targetNode, style);
    }

    highlight() {
        this._highlightScale = 2.4;
        this.update();
    }

    unhighlight() {
        this._highlightScale = 1;
        this.update();
    }
}

// ============================================================================
// Graph - loads data, builds the scene graph, wires the UI
// ============================================================================
class Graph {
    constructor(container, dataUrl) {
        this.sceneManager = new SceneManager(container);
        this.dataUrl = dataUrl;
        this.nodes = [];
        this.links = [];
        this._wireUI();
    }

    async load() {
        try {
            const res = await fetch(this.dataUrl);
            const data = await res.json();

            data.nodes.forEach((nd) => {
                const node = new Node(nd, this.sceneManager);
                this.nodes.push(node);
                this.sceneManager.nodesByIds.set(nd.id, node);
            });

            data.links.forEach((ld) => {
                const src = this.sceneManager.nodesByIds.get(ld.source);
                const tgt = this.sceneManager.nodesByIds.get(ld.target);
                if (!src || !tgt) return;
                const link = new Link(ld, src, tgt, this.sceneManager);
                this.links.push(link);
                this.sceneManager.linksByIds.set(`${ld.source}__${ld.target}`, link);
            });

            this._layout();
            this.sceneManager.setStyle('glass');

            document.getElementById('loadingIndicator')?.classList.add('hidden');
            this.sceneManager.start();
        } catch (err) {
            console.error('Failed to load graph data:', err);
            const li = document.getElementById('loadingIndicator');
            if (li) li.querySelector('p').textContent = 'Failed to load graphify.json';
        }
    }

    // Simple 3D force-directed layout (Fruchterman-Reingold flavored).
    _layout() {
        const iterations = 220;
        const area = 28;
        const k = area / Math.cbrt(Math.max(this.nodes.length, 1));
        let temp = area * 0.18;

        for (let it = 0; it < iterations; it++) {
            this.nodes.forEach((n) => (n._disp = new THREE.Vector3()));

            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const a = this.nodes[i];
                    const b = this.nodes[j];
                    const delta = new THREE.Vector3().subVectors(a.position, b.position);
                    let dist = delta.length() || 0.01;
                    const repulse = (k * k) / dist;
                    delta.normalize().multiplyScalar(repulse);
                    a._disp.add(delta);
                    b._disp.sub(delta);
                }
            }

            this.links.forEach((link) => {
                const delta = new THREE.Vector3()
                    .subVectors(link.sourceNode.position, link.targetNode.position);
                const dist = delta.length() || 0.01;
                const attract = (dist * dist) / k;
                delta.normalize().multiplyScalar(attract);
                link.sourceNode._disp.sub(delta);
                link.targetNode._disp.add(delta);
            });

            this.nodes.forEach((n) => {
                const d = n._disp.length() || 0.01;
                const next = n.position.clone()
                    .add(n._disp.multiplyScalar(Math.min(d, temp) / d));
                n.position.copy(next);
            });

            temp *= 0.985;
        }

        // Center the layout.
        const center = new THREE.Vector3();
        this.nodes.forEach((n) => center.add(n.position));
        center.multiplyScalar(1 / Math.max(this.nodes.length, 1));
        this.nodes.forEach((n) => n.setPosition(n.position.clone().sub(center)));
        this.links.forEach((l) => l.update());
    }

    _wireUI() {
        const sm = this.sceneManager;

        document.getElementById('themeBtn')?.addEventListener('click', () => {
            const dark = document.body.classList.toggle('dark-theme');
            sm.setTheme(dark);
        });

        document.querySelectorAll('input[name="style"]').forEach((radio) => {
            radio.addEventListener('change', (e) => sm.setStyle(e.target.value));
        });

        document.getElementById('tintRange')?.addEventListener('input', (e) => {
            const t = parseFloat(e.target.value);
            sm.setTint(t);
            const out = document.getElementById('tintValue');
            if (out) out.textContent = t.toFixed(2);
        });

        document.getElementById('surfaceTintRange')?.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value);
            sm.setSurfaceTint(pct / 100);
            const out = document.getElementById('surfaceTintValue');
            if (out) out.textContent = `${pct}%`;
        });

        document.getElementById('transparencyRange')?.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value);
            sm.setTransparency(pct / 100);
            const out = document.getElementById('transparencyValue');
            if (out) out.textContent = `${pct}%`;
        });

        document.getElementById('linkThicknessRange')?.addEventListener('input', (e) => {
            const mult = parseFloat(e.target.value);
            sm.setLinkThickness(mult);
            const out = document.getElementById('linkThicknessValue');
            if (out) out.textContent = `${mult.toFixed(1)}x`;
        });

        document.getElementById('linkFilletRange')?.addEventListener('input', (e) => {
            const f = parseFloat(e.target.value);
            sm.setLinkFillet(f);
            const out = document.getElementById('linkFilletValue');
            if (out) out.textContent = f.toFixed(2);
        });

        document.getElementById('brightnessRange')?.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value);
            sm.setBrightness(pct / 100);
            const out = document.getElementById('brightnessValue');
            if (out) out.textContent = `${pct}%`;
        });

        document.getElementById('showLabels')?.addEventListener('change', (e) => {
            this.nodes.forEach((n) => { n.label.visible = e.target.checked; });
        });

        document.getElementById('autoRotate')?.addEventListener('change', (e) => {
            sm.setAutoRotate(e.target.checked);
        });

        document.getElementById('resetView')?.addEventListener('click', () => sm.resetView());

        // Camera toolbar
        document.getElementById('zoomInBtn')?.addEventListener('click', () => sm.zoom(0.8));
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => sm.zoom(1.25));
        document.getElementById('centerBtn')?.addEventListener('click', () => sm.centerView());
        document.getElementById('panBtn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const active = btn.classList.toggle('active');
            sm.setPanMode(active);
            // Keep the Auto Rotate checkbox in sync when pan disables it.
            const ar = document.getElementById('autoRotate');
            if (active && ar) ar.checked = false;
        });

        document.getElementById('closeSidePanel')?.addEventListener('click', () => {
            sm.deselectObject();
        });
    }
}

// ============================================================================
// Bootstrap - default dark theme to suit the glass/neon scene
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('dark-theme');
    const container = document.getElementById('canvas-container');
    const graph = new Graph(container, 'graphify.json');
    graph.load();
});

export { Graph, SceneManager, Node, Link, MaterialFactory };
