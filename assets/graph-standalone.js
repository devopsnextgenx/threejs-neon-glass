// ============================================================================
// Graphify - Standalone 3D Graph Viewer
// ----------------------------------------------------------------------------
// Renders graphs with the EXACT same glass/neon technique as index.html by
// reusing the rendering engine from main.js (SceneManager + Node + Link).
// Adds standalone capabilities: load arbitrary graph JSON via file picker or
// drag & drop, and a control panel docked to the bottom-right of the canvas.
// ============================================================================

import * as THREE from 'three';
import { SceneManager, Node, Link, communityColor } from './main.js';

// Sample graph shown on first load so the canvas is never empty.
const SAMPLE_GRAPH = {
    nodes: [
        { id: 'auth.login', label: 'login()', community: 0, weight: 0.9, source_file: 'auth/login.ts', source_location: 'L12' },
        { id: 'auth.validate', label: 'validateToken()', community: 0, weight: 0.7, source_file: 'auth/validate.ts', source_location: 'L34' },
        { id: 'auth.session', label: 'SessionManager', community: 0, weight: 0.8, source_file: 'auth/session.ts', source_location: 'L5' },
        { id: 'auth.hash', label: 'hashPassword()', community: 0, weight: 0.5, source_file: 'auth/crypto.ts', source_location: 'L88' },
        { id: 'auth.middleware', label: 'authMiddleware', community: 0, weight: 0.6, source_file: 'auth/middleware.ts', source_location: 'L21' },

        { id: 'db.query', label: 'QueryBuilder', community: 1, weight: 1.0, source_file: 'db/query.ts', source_location: 'L7' },
        { id: 'db.connection', label: 'DBConnection', community: 1, weight: 0.9, source_file: 'db/connection.ts', source_location: 'L3' },
        { id: 'db.model', label: 'BaseModel', community: 1, weight: 0.8, source_file: 'db/model.ts', source_location: 'L14' },
        { id: 'db.migration', label: 'runMigrations()', community: 1, weight: 0.5, source_file: 'db/migrate.ts', source_location: 'L52' },

        { id: 'api.router', label: 'Router', community: 2, weight: 1.0, source_file: 'api/router.ts', source_location: 'L1' },
        { id: 'api.handler', label: 'RequestHandler', community: 2, weight: 0.8, source_file: 'api/handler.ts', source_location: 'L9' },
        { id: 'api.validator', label: 'validateSchema()', community: 2, weight: 0.6, source_file: 'api/validator.ts', source_location: 'L44' },
        { id: 'api.response', label: 'ResponseBuilder', community: 2, weight: 0.7, source_file: 'api/response.ts', source_location: 'L18' },
        { id: 'api.rateLimit', label: 'rateLimiter()', community: 2, weight: 0.5, source_file: 'api/rateLimit.ts', source_location: 'L30' },
        { id: 'api.logger', label: 'requestLogger()', community: 2, weight: 0.4, source_file: 'api/logger.ts', source_location: 'L67' }
    ],
    links: [
        { source: 'auth.middleware', target: 'auth.validate', relation: 'calls' },
        { source: 'auth.validate', target: 'auth.session', relation: 'uses' },
        { source: 'auth.login', target: 'auth.hash', relation: 'calls' },
        { source: 'auth.login', target: 'auth.session', relation: 'uses' },
        { source: 'auth.session', target: 'auth.validate', relation: 'calls' },

        { source: 'db.connection', target: 'db.query', relation: 'uses' },
        { source: 'db.model', target: 'db.query', relation: 'uses' },
        { source: 'db.model', target: 'db.connection', relation: 'uses' },
        { source: 'db.migration', target: 'db.connection', relation: 'uses' },

        { source: 'api.router', target: 'api.handler', relation: 'calls' },
        { source: 'api.router', target: 'api.rateLimit', relation: 'uses' },
        { source: 'api.router', target: 'api.logger', relation: 'uses' },
        { source: 'api.handler', target: 'api.validator', relation: 'calls' },
        { source: 'api.handler', target: 'api.response', relation: 'calls' },
        { source: 'api.validator', target: 'api.response', relation: 'uses' },

        { source: 'api.handler', target: 'auth.middleware', relation: 'uses' },
        { source: 'api.handler', target: 'db.model', relation: 'uses' },
        { source: 'auth.session', target: 'db.connection', relation: 'uses' },
        { source: 'db.model', target: 'auth.validate', relation: 'calls' }
    ]
};

// ============================================================================
// StandaloneGraph - reuses main.js rendering, swaps fetch for in-memory data
// ============================================================================
class StandaloneGraph {
    constructor(container) {
        this.sceneManager = new SceneManager(container);
        this.nodes = [];
        this.links = [];
        this._started = false;
        this._search = '';
        this._selectedCommunity = null;
        this._wireUI();
        this._wireExplore();
        this._wireFileLoading();
    }

    // Build (or rebuild) the scene from a graph data object.
    loadData(data) {
        if (!data || !Array.isArray(data.nodes)) {
            throw new Error('Graph JSON must contain a "nodes" array.');
        }
        this.clear();

        data.nodes.forEach((nd) => {
            const node = new Node(nd, this.sceneManager);
            this.nodes.push(node);
            this.sceneManager.nodesByIds.set(nd.id, node);
        });

        (data.links || data.edges || []).forEach((ld) => {
            const src = this.sceneManager.nodesByIds.get(ld.source);
            const tgt = this.sceneManager.nodesByIds.get(ld.target);
            if (!src || !tgt) return;
            const link = new Link(ld, src, tgt, this.sceneManager);
            this.links.push(link);
            this.sceneManager.linksByIds.set(`${ld.source}__${ld.target}`, link);
        });

        this._layout();
        this.sceneManager.setStyle(this.sceneManager.currentStyle || 'glass');

        // Reset explore filters for the freshly loaded graph, then rebuild the
        // cluster list and apply node/link visibility (honours search + labels).
        this._search = '';
        this._selectedCommunity = null;
        const searchInput = document.getElementById('nodeSearch');
        if (searchInput) searchInput.value = '';
        this._renderClusters();
        this._applyFilter();

        document.getElementById('loadingIndicator')?.classList.add('hidden');

        if (!this._started) {
            this.sceneManager.start();
            this._started = true;
        }
    }

    // Remove every node/link mesh and release GPU resources before a reload.
    clear() {
        const sm = this.sceneManager;
        sm.deselectObject();

        this.nodes.forEach((n) => {
            sm.scene.remove(n.mesh);
            sm.scene.remove(n.core);
            sm.labelScene.remove(n.label);
            n.mesh.geometry.dispose();
            n.mesh.material.dispose();
            n.core.geometry.dispose();
            n.core.material.dispose();
            n.label.material.map?.dispose();
            n.label.material.dispose();
        });

        this.links.forEach((l) => {
            sm.scene.remove(l.group);
            l.meshes.forEach((m) => {
                m.geometry.dispose();
                m.material.dispose();
            });
        });

        this.nodes = [];
        this.links = [];
        sm.nodesByIds.clear();
        sm.linksByIds.clear();
    }

    // Simple 3D force-directed layout (mirrors main.js).
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
            radio.addEventListener('change', (e) => {
                sm.setStyle(e.target.value);
                this._applyFilter();
            });
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

        document.getElementById('showLabels')?.addEventListener('change', () => {
            this._applyFilter();
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
            const ar = document.getElementById('autoRotate');
            if (active && ar) ar.checked = false;
        });

        document.getElementById('closeSidePanel')?.addEventListener('click', () => {
            sm.deselectObject();
        });
    }

    // Search box: filter nodes by label / id as the user types.
    _wireExplore() {
        const input = document.getElementById('nodeSearch');
        input?.addEventListener('input', (e) => {
            this._search = e.target.value || '';
            this._applyFilter();
        });
    }

    // Build the cluster (community) list with colour swatch + node count.
    _renderClusters() {
        const listEl = document.getElementById('clusterList');
        if (!listEl) return;

        const counts = new Map();
        this.nodes.forEach((n) => {
            const c = n.data.community ?? 0;
            counts.set(c, (counts.get(c) || 0) + 1);
        });
        const communities = [...counts.keys()].sort((a, b) => a - b);

        listEl.innerHTML = '';

        const makeItem = (community, name, count, swatchHtml) => {
            const item = document.createElement('button');
            item.type = 'button';
            const active = this._selectedCommunity === community;
            item.className = 'cluster-item' + (active ? ' active' : '');
            item.innerHTML =
                `${swatchHtml}<span class="cluster-name">${name}</span>` +
                `<span class="cluster-count">${count}</span>`;
            item.addEventListener('click', () => this._selectCommunity(community));
            listEl.appendChild(item);
        };

        // "All clusters" reset entry.
        makeItem(null, 'All clusters', this.nodes.length,
            '<span class="cluster-swatch all"></span>');

        communities.forEach((c) => {
            const hex = '#' + (communityColor(c) >>> 0).toString(16).padStart(6, '0');
            makeItem(c, `Community ${c}`, counts.get(c),
                `<span class="cluster-swatch" style="background:${hex}"></span>`);
        });
    }

    // Toggle isolation of a community (click again or "All" to clear).
    // Selecting a community highlights its nodes and centres the camera on
    // them; clearing the selection re-frames the whole graph.
    _selectCommunity(community) {
        this._selectedCommunity =
            this._selectedCommunity === community ? null : community;
        this._renderClusters();
        this._applyFilter();

        if (this._selectedCommunity === null) {
            this.sceneManager.centerView();
        } else {
            const members = this.nodes.filter(
                (n) => (n.data.community ?? 0) === this._selectedCommunity);
            this._focusNodes(members);
        }
    }

    // Frame the camera on a subset of nodes (used when isolating a cluster).
    // Keeps the current viewing direction but re-targets and dollies the
    // camera so the given nodes fill the view.
    _focusNodes(nodes) {
        if (!nodes || !nodes.length) return;
        const sm = this.sceneManager;

        const box = new THREE.Box3();
        nodes.forEach((n) => box.expandByPoint(n.position));

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 4) * 0.5;

        const fov = (sm.camera.fov * Math.PI) / 180;
        const dist = (radius / Math.sin(fov / 2)) * 1.4;

        const dir = new THREE.Vector3()
            .subVectors(sm.camera.position, sm.controls.target)
            .normalize();
        if (dir.lengthSq() === 0) dir.set(0, 0.3, 1).normalize();

        sm.controls.target.copy(center);
        sm.camera.position.copy(center).addScaledVector(dir, dist);
        sm.controls.update?.();
    }

    // Recompute node/link visibility from the current search + cluster filters.
    // A node is shown when it matches the search text AND (no cluster selected
    // OR it belongs to the selected cluster). A link shows only when both of
    // its endpoints are visible.
    _applyFilter() {
        const term = this._search.trim().toLowerCase();
        const sel = this._selectedCommunity;
        const labelsOn = document.getElementById('showLabels')?.checked ?? true;
        const neon = this.sceneManager.currentStyle === 'neon';

        const visibleById = new Map();
        let shown = 0;

        this.nodes.forEach((n) => {
            const d = n.data;
            const matchesText = !term
                || (d.label || '').toLowerCase().includes(term)
                || (d.id || '').toLowerCase().includes(term);
            const matchesCluster = sel === null || (d.community ?? 0) === sel;
            const visible = matchesText && matchesCluster;

            visibleById.set(d.id, visible);
            if (visible) shown++;

            n.mesh.visible = visible;
            n.core.visible = visible && !neon;
            n.label.visible = visible && labelsOn;
        });

        this.links.forEach((l) => {
            const v = visibleById.get(l.sourceNode.data.id)
                && visibleById.get(l.targetNode.data.id);
            l.group.visible = !!v;
        });

        const meta = document.getElementById('searchMeta');
        if (meta) {
            meta.textContent = (term || sel !== null)
                ? `${shown} of ${this.nodes.length} nodes shown`
                : '';
        }
    }

    // File picker + drag & drop loading of arbitrary graph JSON.
    _wireFileLoading() {
        const errorEl = document.getElementById('loadError');
        const setError = (msg) => { if (errorEl) errorEl.textContent = msg || ''; };

        const readFile = (file) => {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.loadData(data);
                    setError('');
                } catch (err) {
                    setError(`Could not load: ${err.message}`);
                }
            };
            reader.onerror = () => setError('Could not read the file.');
            reader.readAsText(file);
        };

        document.getElementById('fileInput')?.addEventListener('change', (e) => {
            readFile(e.target.files[0]);
            e.target.value = '';
        });

        // Drag & drop anywhere on the canvas.
        const container = this.sceneManager.container;
        const overlay = document.getElementById('dropOverlay');
        let dragDepth = 0;

        const showOverlay = (show) => {
            if (overlay) overlay.classList.toggle('active', show);
        };

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragDepth++;
            showOverlay(true);
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) showOverlay(false);
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            showOverlay(false);
            const file = e.dataTransfer?.files?.[0];
            if (file) readFile(file);
        });

        // Keep a reference in case future features need the container.
        void container;
    }
}

// ============================================================================
// Bootstrap
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('dark-theme');
    const container = document.getElementById('canvas-container');
    const graph = new StandaloneGraph(container);
    graph.loadData(SAMPLE_GRAPH);
});

export { StandaloneGraph };
