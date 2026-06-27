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
        this._linkLengthScale = 1.5;
        this._wireUI();
        this._wireExplore();
        this._wireFileLoading();
    }

    // Build (or rebuild) the scene from a graph data object.
    loadData(data) {
        console.group('[Graphify] loadData()');
        if (!data || !Array.isArray(data.nodes)) {
            console.error('[Graphify] loadData: invalid data — missing nodes array', data);
            throw new Error('Graph JSON must contain a "nodes" array.');
        }
        console.log('[Graphify] loadData: raw data received —', data.nodes.length, 'nodes,', (data.links || data.edges || []).length, 'links');

        this.clear();
        console.log('[Graphify] loadData: clear() done. this.nodes.length =', this.nodes.length);

        data.nodes.forEach((nd) => {
            const node = new Node(nd, this.sceneManager);
            this.nodes.push(node);
            this.sceneManager.nodesByIds.set(nd.id, node);
        });
        console.log('[Graphify] loadData: nodes pushed. this.nodes.length =', this.nodes.length);

        // Log first node shape so we can confirm n.data structure
        if (this.nodes.length > 0) {
            const firstNode = this.nodes[0];
            console.log('[Graphify] loadData: first node instance keys =', Object.keys(firstNode));
            console.log('[Graphify] loadData: first node .data =', firstNode.data);
            console.log('[Graphify] loadData: first node .community (direct) =', firstNode.community);
            console.log('[Graphify] loadData: first node .data?.community =', firstNode.data?.community);
        }

        (data.links || data.edges || []).forEach((ld) => {
            const src = this.sceneManager.nodesByIds.get(ld.source);
            const tgt = this.sceneManager.nodesByIds.get(ld.target);
            if (!src || !tgt) return;
            const link = new Link(ld, src, tgt, this.sceneManager);
            this.links.push(link);
            this.sceneManager.linksByIds.set(`${ld.source}__${ld.target}`, link);
        });
        console.log('[Graphify] loadData: links pushed. this.links.length =', this.links.length);

        this._layout();
        console.log('[Graphify] loadData: _layout() done');

        this.sceneManager.setStyle(this.sceneManager.currentStyle || 'glass');
        console.log('[Graphify] loadData: setStyle() done. currentStyle =', this.sceneManager.currentStyle);

        this._applyFilter();
        console.log('[Graphify] loadData: _applyFilter() done');

        this._renderClusters();
        console.log('[Graphify] loadData: _renderClusters() done (synchronous)');

        // Snapshot the DOM right after _renderClusters to see if it wrote correctly
        const listElAfterSync = document.getElementById('clusterList');
        console.log('[Graphify] loadData: #clusterList children count after sync render =', listElAfterSync?.children.length);
        console.log('[Graphify] loadData: #clusterList innerHTML after sync render =', listElAfterSync?.innerHTML?.slice(0, 300));

        document.getElementById('loadingIndicator')?.classList.add('hidden');

        if (!this._started) {
            console.log('[Graphify] loadData: calling sceneManager.start() for first time');
            this.sceneManager.start();
            this._started = true;
        }
        this.sceneManager.centerView();
        console.log('[Graphify] loadData: centerView() done');

        // Snapshot DOM again after centerView — did something wipe #clusterList?
        const listElAfterCenter = document.getElementById('clusterList');
        console.log('[Graphify] loadData: #clusterList children count after centerView =', listElAfterCenter?.children.length);

        Promise.resolve().then(() => {
            console.log('[Graphify] loadData: microtask _renderClusters() firing');
            this._renderClusters();
            const listElMicro = document.getElementById('clusterList');
            console.log('[Graphify] loadData: #clusterList children count after microtask render =', listElMicro?.children.length);
            console.log('[Graphify] loadData: #clusterList innerHTML after microtask =', listElMicro?.innerHTML?.slice(0, 300));
        });

        console.groupEnd();
    }

    // Remove every node/link mesh and release GPU resources before a reload.
    clear() {
        console.group('[Graphify] clear()');
        const sm = this.sceneManager;
        console.log('[Graphify] clear: calling sm.deselectObject()');
        sm.deselectObject();
        console.log('[Graphify] clear: deselectObject() returned');

        // Reset explore/filter state so the new graph always starts clean.
        this._search = '';
        this._selectedCommunity = null;
        console.log('[Graphify] clear: state reset — _search="", _selectedCommunity=null');

        // Clear the cluster list DOM immediately so stale entries never linger
        // between the clear() call and the subsequent _renderClusters() call.
        const clusterList = document.getElementById('clusterList');
        console.log('[Graphify] clear: #clusterList element found =', !!clusterList, '| children before wipe =', clusterList?.children.length);
        if (clusterList) clusterList.innerHTML = '';
        console.log('[Graphify] clear: #clusterList wiped');

        // Clear the search input value to match the reset _search state.
        const searchInput = document.getElementById('nodeSearch');
        if (searchInput) searchInput.value = '';

        // Clear the search meta text.
        const searchMeta = document.getElementById('searchMeta');
        if (searchMeta) searchMeta.textContent = '';
        console.log('[Graphify] clear: old nodes to dispose =', this.nodes.length, '| old links =', this.links.length);

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
        console.log('[Graphify] clear: done');
        console.groupEnd();
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
                // Spring pulling each link toward its desired rest length
                // (per-link JSON `length` or 1.5x largest connected diameter,
                // scaled by the Link Length slider).
                const rest = this._desiredLinkLength(link);
                const attract = (dist - rest) * 0.35;
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

        // Normalize the overall scale so connected nodes settle at their desired
        // link length (~1.5x node diameter by default). All-pairs repulsion
        // tends to inflate spacing, so we rescale every position uniformly to
        // bring the mean actual length onto the mean desired length.
        this._normalizeScale();

        this.links.forEach((l) => l.update());
    }

    // Uniformly rescale all node positions so the average link length matches
    // the average desired rest length. Preserves the layout's shape while
    // pulling nodes to ~1.5-3x their diameter apart.
    _normalizeScale() {
        if (!this.links.length) return;
        let actual = 0;
        let desired = 0;
        this.links.forEach((l) => {
            actual += l.sourceNode.position.distanceTo(l.targetNode.position);
            desired += this._desiredLinkLength(l);
        });
        if (actual <= 1e-3) return;
        const s = desired / actual;
        this.nodes.forEach((n) => n.setPosition(n.position.clone().multiplyScalar(s)));
    }

    // Desired rest length for a link: an explicit JSON `length` if provided,
    // otherwise 1.5x the largest connected node's diameter. Scaled live by the
    // Link Length slider.
    _desiredLinkLength(link) {
        const rA = link.sourceNode.radius;
        const rB = link.targetNode.radius;
        const largestDiameter = 2 * Math.max(rA, rB);
        const base = (link.data && link.data.length != null)
            ? link.data.length
            : 1.5 * largestDiameter;
        return base * this._linkLengthScale;
    }

    // Re-run the layout with a new link-length multiplier.
    setLinkLength(scale) {
        this._linkLengthScale = scale;
        this._layout();
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

        document.getElementById('linkLengthRange')?.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            this.setLinkLength(v);
            const out = document.getElementById('linkLengthValue');
            if (out) out.textContent = `${v.toFixed(1)}x`;
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
        console.group('[Graphify] _renderClusters()');
        console.log('[Graphify] _renderClusters: this.nodes.length =', this.nodes.length);

        const listEl = document.getElementById('clusterList');
        console.log('[Graphify] _renderClusters: #clusterList found =', !!listEl);
        if (!listEl) {
            console.warn('[Graphify] _renderClusters: EARLY RETURN — #clusterList not in DOM!');
            console.groupEnd();
            return;
        }

        // Log #clusterList's parent chain to confirm it's still attached to document
        let el = listEl;
        const chain = [];
        while (el) { chain.push(el.tagName || '#document'); el = el.parentElement; }
        console.log('[Graphify] _renderClusters: #clusterList DOM chain =', chain.join(' > '));
        console.log('[Graphify] _renderClusters: #clusterList isConnected =', listEl.isConnected);

        const counts = new Map();
        this.nodes.forEach((n) => {
            // Defensive: Node class may expose community via .data.community,
            // .community directly, or not at all — fall back to 0.
            const c = (n.data?.community ?? n.community ?? 0);
            counts.set(c, (counts.get(c) || 0) + 1);
        });
        const communities = [...counts.keys()].sort((a, b) => a - b);
        console.log('[Graphify] _renderClusters: communities found =', communities, '| counts =', Object.fromEntries(counts));

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
            const hex = '#' + (communityColor(c) & 0xFFFFFF).toString(16).padStart(6, '0');
            makeItem(c, `Community ${c}`, counts.get(c),
                `<span class="cluster-swatch" style="background:${hex}"></span>`);
        });

        console.log('[Graphify] _renderClusters: done — appended', listEl.children.length, 'items to #clusterList');
        console.log('[Graphify] _renderClusters: final innerHTML =', listEl.innerHTML.slice(0, 400));
        console.groupEnd();
    }

    // Toggle isolation of a community (click again or "All" to clear).
    // Selecting a community highlights its nodes and centres the camera on
    // them; clearing the selection re-frames the whole graph.
    _selectCommunity(community) {
        this._selectedCommunity =
            this._selectedCommunity === community ? null : community;
        console.log('[Graphify] _selectCommunity: sel =', this._selectedCommunity, '| nodes =', this.nodes.length);
        this._renderClusters();
        this._applyFilter();

        if (this._selectedCommunity === null) {
            this.sceneManager.centerView();
        } else {
            const members = this.nodes.filter(
                (n) => (n.data?.community ?? n.community ?? 0) === this._selectedCommunity);
            console.log('[Graphify] _selectCommunity: members =', members.length);
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
        const clustering = sel !== null;

        // Per-node state: 'member' (full size), 'ghost' (shrunk + de-emphasised
        // when another cluster is selected), or 'hidden' (filtered out by search).
        const stateById = new Map();
        let shown = 0;

        this.nodes.forEach((n) => {
            const d = n.data;
            const matchesText = !term
                || (d.label || '').toLowerCase().includes(term)
                || (d.id || '').toLowerCase().includes(term);

            if (!matchesText) {
                n.mesh.visible = false;
                n.core.visible = false;
                n.label.visible = false;
                n.setClusterHighlight(false);
                stateById.set(d.id, 'hidden');
                return;
            }

            const ghost = clustering && (d?.community ?? n.community ?? 0) !== sel;
            const isHighlightedClusterNode = clustering && !ghost;
            const scale = ghost ? 0.4 : 1.0;

            n.mesh.visible = true;
            n.core.visible = !neon;
            n.label.visible = labelsOn && !ghost;
            n.mesh.scale.setScalar(scale);
            n.core.scale.setScalar(scale);
            
            if (typeof n.setClusterHighlight === 'function') {
                if (isHighlightedClusterNode) {
                    console.log('[Graphify] _applyFilter: highlighting node', d.id, 'community', d.community);
                }
                n.setClusterHighlight(isHighlightedClusterNode);
            } else {
                console.warn('[Graphify] _applyFilter: n.setClusterHighlight is NOT a function for node', d.id);
            }

            stateById.set(d.id, ghost ? 'ghost' : 'member');
            shown++;
        });

        this.links.forEach((l) => {
            const a = stateById.get(l.sourceNode.data.id);
            const b = stateById.get(l.targetNode.data.id);
            const present = a && a !== 'hidden' && b && b !== 'hidden';
            // When a cluster is selected, keep only its internal links visible so
            // the highlighted community's structure stands out.
            const visible = clustering
                ? present && a === 'member' && b === 'member'
                : present;
            l.group.visible = !!visible;
            if (typeof l.setClusterHighlight === 'function') {
                l.setClusterHighlight(clustering && visible);
            }
        });

        const meta = document.getElementById('searchMeta');
        if (meta) {
            meta.textContent = (term || clustering)
                ? `${shown} of ${this.nodes.length} nodes shown`
                : '';
        }
    }

    // File picker + drag & drop loading of arbitrary graph JSON.
    _wireFileLoading() {
        const errorEl = document.getElementById('loadError');
        const setError = (msg) => { if (errorEl) errorEl.textContent = msg || ''; };

        const readFile = (file) => {
            console.log('[Graphify] readFile: called with file =', file?.name, '| size =', file?.size);
            if (!file) {
                console.warn('[Graphify] readFile: no file provided, skipping');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    console.log('[Graphify] readFile: JSON parsed OK, calling loadData');
                    this.loadData(data);
                    setError('');
                } catch (err) {
                    console.error('[Graphify] readFile: parse/load error —', err);
                    setError(`Could not load: ${err.message}`);
                }
            };
            reader.onerror = () => {
                console.error('[Graphify] readFile: FileReader error');
                setError('Could not read the file.');
            };
            reader.readAsText(file);
        };

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            // Listen on both 'change' and 'input' — some browsers fire one or the other.
            // Also attach at the document level (capture phase) to catch it even if
            // something in the label/toolbar is stopping propagation.
            const onFileSelected = (e) => {
                if (e.target !== fileInput) return;   // only care about our input
                console.log('[Graphify] file event fired — type:', e.type,
                    '| files.length:', e.target.files?.length,
                    '| files[0]:', e.target.files?.[0]?.name ?? 'undefined');
                const file = e.target.files?.[0];
                if (!file) return;
                readFile(file);
                setTimeout(() => { fileInput.value = ''; }, 0);
            };

            // Attach in capture phase at document level so label/toolbar can't swallow it
            document.addEventListener('change', onFileSelected, true);
            document.addEventListener('input',  onFileSelected, true);
            console.log('[Graphify] fileInput: capture-phase listeners attached on document for', fileInput);
        } else {
            console.error('[Graphify] fileInput: #fileInput element NOT FOUND in DOM');
        }

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