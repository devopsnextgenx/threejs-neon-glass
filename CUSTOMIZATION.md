# Customization Guide

This guide shows how to customize Graphify for your specific needs.

## 🎨 Visual Customization

### Changing Node Colors by Community

Edit `Node.getCommunityColor()` in `main.js` (around line 350):

```javascript
getCommunityColor() {
    // Your custom colors (hex values)
    const colors = [
        0xFF6B6B,  // Red
        0x4ECDC4,  // Teal
        0x45B7D1,  // Blue
        0xFFA07A   // Light salmon
    ];
    return colors[this.data.community % colors.length];
}
```

### Adjusting Node Size

In `Node.create()` method (around line 360):

```javascript
// Current: size based on weight (1 to 3)
this.size = 1 + data.weight * 2;

// Alternative: Fixed size
this.size = 1.5;

// Alternative: Different scale
this.size = 0.5 + data.weight * 3;
```

### Glass Material Properties

Edit `MaterialFactory.createGlassMaterial()`:

```javascript
return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.3,           // 0-1: How metallic (0 = non-metal)
    roughness: 0.1,           // 0-1: Surface smoothness
    transmission: 0.95,       // 0-1: Transparency (1 = fully transparent)
    thickness: 2.0,           // Refraction thickness
    ior: 1.5,                 // Index of refraction (glass ~ 1.5)
    envMapIntensity: 1.5,     // Environment reflection strength
    clearcoat: 0.8,           // Clear coat layer strength
    clearcoatRoughness: 0.1,  // Clear coat surface roughness
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.1,   // Glow intensity
});
```

**Tips:**
- ↑ `transmission` → More transparent
- ↓ `roughness` → More reflective/shiny
- ↑ `ior` → More refraction distortion
- ↑ `emissiveIntensity` → More self-glow

### Neon Material Properties

Edit `MaterialFactory.createNeonMaterial()`:

```javascript
return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.2,           // 0-1: Metallic effect
    roughness: 0.5,           // 0-1: Surface roughness
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.8,   // ← Increase for brighter glow
    toneMapped: false,        // Allows overbright values
});
```

**Tips:**
- ↑ `emissiveIntensity` → Brighter glowing effect
- ↓ `roughness` → More reflective surface
- ↑ `metalness` → More metallic appearance

### Bloom Effect Intensity

In `SceneManager.setupComposer()` (around line 130):

```javascript
this.bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,    // ← strength (try 0.5-3)
    0.4,    // ← radius (try 0.2-1)
    0.85    // ← threshold (try 0-1)
);
```

## 🎯 Behavior Customization

### Force-Directed Layout Parameters

In `Graph.applyForceDirectedLayout()` (around line 580):

```javascript
const iterations = 50;    // More iterations = better layout
const k = 5;             // Spring constant (lower = tighter clusters)
const repulsion = 20;    // Higher = more spread out
const damping = 0.5;     // Movement smoothness (0-1)
```

**Layout Tuning Guide:**
| Issue | Solution |
|-------|----------|
| Nodes too clustered | ↑ `repulsion` or ↓ `k` |
| Nodes too spread | ↓ `repulsion` or ↑ `k` |
| Rough/jittery layout | ↑ `damping` |
| Slow layout calculation | ↓ `iterations` |
| Links too short/long | Adjust `k` |

### Camera Controls

In `SceneManager.setupControls()` (around line 125):

```javascript
this.controls.enableDamping = true;      // Smooth camera movement
this.controls.dampingFactor = 0.05;      // ← Camera smoothness (0-0.1)
this.controls.autoRotate = true;         // Auto rotation on load
this.controls.autoRotateSpeed = 2;       // ← Rotation speed (try 0.5-5)
this.controls.minDistance = 10;          // ← Min zoom distance
this.controls.maxDistance = 100;         // ← Max zoom distance
```

### Default Scene Setup

In `SceneManager.setupScene()` (around line 98):

```javascript
// Change background color
this.scene.background = new THREE.Color(0xffffff);  // White

// Change fog for depth effect
this.scene.fog = new THREE.Fog(0xffffff, 100, 200); // color, near, far
//                                              ↑     ↑
//                                            fog start/end distance

// Adjust lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
//                                           color     intensity ↑

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
//                                                   color     intensity ↑
directionalLight.position.set(10, 20, 10);  // ← Light direction
```

## 🎛️ UI Customization

### Change Control Panel Position

In `style.css`, modify `.control-panel`:

```css
.control-panel {
    top: 20px;      /* Move vertically */
    left: 20px;     /* Move horizontally */
    width: 280px;   /* Panel width */
    /* Or use: right, bottom */
}
```

### Change Theme Colors

In `style.css`, modify `:root` section:

```css
:root {
    --bg-primary: #ffffff;          /* Main background */
    --bg-secondary: #f5f5f5;        /* Secondary background */
    --text-primary: #222222;        /* Main text */
    --text-secondary: #666666;      /* Secondary text */
    --border-color: #dddddd;        /* Borders */
    --accent-color: #2563eb;        /* Buttons, highlights */
    --glass-color: rgba(255, 255, 255, 0.1);  /* Glass tint */
    --panel-bg: rgba(255, 255, 255, 0.95);    /* Panel background */
}
```

Dark theme colors in `body.dark-theme`:

```css
body.dark-theme {
    --bg-primary: #0f0f0f;
    --text-primary: #ffffff;
    --accent-color: #3b82f6;
    /* ... etc */
}
```

### Change Font

In `style.css`, modify `body`:

```css
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    /* Or use: 'Courier New', 'Monaco', 'Menlo' for monospace */
}
```

## 📊 Data Format Customization

### Adding Custom Node Properties

1. Add to `graphify.json`:
```json
{
  "id": "node-1",
  "label": "Node",
  "custom_field": "custom_value"
}
```

2. Display in side panel, modify `SceneManager.showDetailsPanel()`:
```javascript
html += `
    <div class="detail-group">
        <div class="detail-label">Custom Field</div>
        <div class="detail-value">${data.custom_field}</div>
    </div>
`;
```

### Adding Custom Link Properties

Similar process:
1. Add to links in `graphify.json`
2. Display in `showDetailsPanel()` method

## 🚀 Performance Optimization

### For Large Graphs (1000+ nodes)

1. Reduce label rendering:
```javascript
// In createNodes()
const node = new Node(nodeData, this.sceneManager, false); // false = no labels
```

2. Simplify geometry:
```javascript
// In Node.create(), reduce subdivisions
const geometry = new THREE.IcosahedronGeometry(this.size, 3); // was 6
```

3. Disable auto-rotation by default:
```javascript
// In SceneManager.setupControls()
this.controls.autoRotate = false; // Set to false
```

4. Use neon style (simpler shaders):
```javascript
// In Graph.load()
this.sceneManager.setStyle('neon'); // Instead of 'glass'
```

### For Mobile Devices

```javascript
// Add at start of main.js
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    // Use simpler materials
    this.sceneManager.setStyle('neon');
    // Disable bloom
    this.bloomPass.enabled = false;
    // Reduce node count or complexity
}
```

## 🔌 Extending with New Features

### Add a Statistics Panel

```javascript
// In main.js, add to Graph class
showStatistics() {
    const stats = {
        nodes: this.nodes.length,
        links: this.links.length,
        communities: new Set(this.nodes.map(n => n.data.community)).size
    };
    
    console.log('Graph Statistics:', stats);
    // Display in a new UI panel
}
```

### Add Node Search

```javascript
searchNode(query) {
    const results = this.nodes.filter(n => 
        n.data.label.toLowerCase().includes(query.toLowerCase())
    );
    
    if (results.length > 0) {
        const firstResult = results[0];
        this.sceneManager.camera.position.copy(firstResult.position);
        this.sceneManager.controls.target.copy(firstResult.position);
    }
}
```

### Add Animation on Load

```javascript
// In Graph.load(), after layout
animateNodesIn() {
    const duration = 1000; // ms
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        this.nodes.forEach(node => {
            node.mesh.scale.set(progress, progress, progress);
        });
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    
    animate();
}
```

## 🎓 Advanced Customization

### Custom Shaders

Replace `MeshPhysicalMaterial` with custom GLSL:

```javascript
const customShader = new THREE.ShaderMaterial({
    uniforms: {
        color: { value: new THREE.Color(0x00ff00) },
        time: { value: 0 }
    },
    vertexShader: `
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        void main() {
            gl_FragColor = vec4(color, 1.0);
        }
    `
});
```

### Dynamic Material Switching

Create new style in `MaterialFactory`:

```javascript
static createHolographicMaterial(color = 0x00ff00) {
    // Your holographic shader logic
}
```

Then add radio option in HTML and update `Graph.setupUIListeners()`.

## 📝 Tips & Tricks

1. **Better Performance**: Disable labels on mobile devices
2. **Artistic Effect**: Increase bloom strength for dreamy look
3. **Technical Look**: Use glass effect with high ior values
4. **Better Visibility**: Increase link cylinder radius in `Link.create()`
5. **Custom Colors**: Use a color picker tool to find hex values

Need more help? Check README.md or QUICKSTART.md!
