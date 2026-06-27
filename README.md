# Graphify - Interactive 3D Graph Visualization

A modular, interactive 3D graph visualization built with Three.js featuring glass spheres as nodes and cylinder links. The application supports multiple visual styles (glass effect and neon glow) with runtime shader switching.

## Features

✨ **Visual Effects**
- Glass effect with color tint (Codrops-inspired transparent glass materials)
- Neon glow effect (Rahultron-style with emissive materials)
- Bloom post-processing for enhanced aesthetics
- Real-time material switching

🎨 **Theming**
- Dark and light theme toggle
- Gradient backgrounds suited for each effect type
- Smooth theme transitions

🔧 **Interaction**
- Orbit camera controls with auto-rotation
- Clickable nodes and links
- Side panel with detailed information on selection
- Weight-based node sizing

📊 **Graph Features**
- Force-directed layout algorithm
- Node-link visualization with cylinders
- Community-based color coding
- Label display with toggle
- Responsive design

## Project Structure

```
clear-glass-threejs/
├── index.html          # Main HTML with UI controls
├── style.css           # Comprehensive styling with theme support
├── main.js             # Modular JavaScript with classes
├── graphify.json       # Sample graph data
└── README.md           # This file
```

## Requirements

- Modern web browser with WebGL support
- No build process required - works directly in browser
- All dependencies loaded via CDN

## Dependencies

- **Three.js** (r128) - 3D graphics library
- **Three.js EffectComposer** - Post-processing effects
- **Three.js UnrealBloomPass** - Bloom effect
- **Three.js OrbitControls** - Camera control

All loaded via CDN in `index.html`

## Setup & Usage

### Option 1: Local Server (Recommended)

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (http-server)
npx http-server
```

Then open `http://localhost:8000` in your browser.

### Option 2: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

## How to Use

### Controls

- **Mouse Drag**: Rotate the view
- **Mouse Scroll**: Zoom in/out
- **Click Node/Link**: Select and view details

### UI Controls

**Visualization Style**
- **Glass Effect**: Transparent glass spheres with color tint (default)
- **Neon Glow**: Luminous spheres with emissive materials

**Display Options**
- **Show Labels**: Toggle node name display
- **Auto Rotate**: Enable/disable automatic scene rotation

**Theme**
- Click the theme button (top-right) to toggle between light and dark themes

**Actions**
- **Reset View**: Return camera to default position
- **Close Details**: Click the × button in the side panel

## Data Format

The visualization expects a JSON file with the following structure:

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "label": "Display Name",
      "community": 0,
      "weight": 0.8,
      "source_file": "path/to/file.ts",
      "source_location": "L12"
    }
  ],
  "links": [
    {
      "source": "node-id-1",
      "target": "node-id-2",
      "relation": "calls"
    }
  ]
}
```

### Properties

**Nodes**
- `id`: Unique identifier
- `label`: Display name in visualization
- `community`: Community/cluster index (affects color)
- `weight`: 0-1 value determining sphere size
- `source_file`: File path for details
- `source_location`: Line number reference

**Links**
- `source`: Source node ID
- `target`: Target node ID
- `relation`: Relationship type (calls, uses, etc.)

## Code Architecture

### MaterialFactory
Handles creation of different shader materials:
- `createGlassMaterial()`: Physical material with transmission and clearcoat
- `createNeonMaterial()`: Standard material with emissive glow
- Cylinder variants for link materials

### SceneManager
Core 3D scene setup and rendering:
- Manages Three.js scene, camera, renderer
- Handles post-processing (bloom effect)
- Orbit controls and interaction
- Theme switching
- Material updates

### Node
Represents graph nodes:
- Icosahedron geometry (6 subdivisions)
- Weight-based sizing
- Optional label sprites
- Community-based coloring
- Highlight/selection states

### Link
Represents connections between nodes:
- Cylinder geometry connecting nodes
- Blended colors from source and target nodes
- Highlight/selection states
- Force-directed layout support

### Graph
Main application class:
- Loads JSON data
- Creates nodes and links
- Applies force-directed layout
- Manages UI event listeners
- Coordinates scene updates

## Customization

### Changing Colors

Edit the color arrays in `Node.getCommunityColor()` and `Link.getLinkColor()`:

```javascript
const colors = [0x4a90e2, 0xe24a4a, 0x4ae290, 0xe2a44a];
```

### Adjusting Physics

In the `Graph.applyForceDirectedLayout()` method:

```javascript
const k = 5;          // Spring constant (higher = tighter layout)
const repulsion = 20; // Repulsive force (higher = more spread)
const damping = 0.5;  // Movement damping (lower = more movement)
const iterations = 50; // Simulation iterations (higher = better spacing)
```

### Material Properties

Modify material properties in `MaterialFactory`:

```javascript
transmission: 0.95,    // 0 = opaque, 1 = fully transparent
roughness: 0.1,       // 0 = mirror, 1 = diffuse
thickness: 2.0,       // Physical thickness for refraction
ior: 1.5,             // Index of refraction (glass ≈ 1.5)
emissiveIntensity: 0.1 // Glow intensity
```

### Bloom Effect

Adjust in `SceneManager.setupComposer()`:

```javascript
new THREE.UnrealBloomPass(
  new THREE.Vector2(width, height),
  1.5,    // strength (higher = more bloom)
  0.4,    // radius
  0.85    // threshold
)
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Any modern browser with WebGL 2.0 support

## Performance Tips

1. **Large graphs**: Reduce label display or increase camera far plane
2. **Mobile**: Use neon style (simpler shaders) for better performance
3. **Custom data**: Limit nodes to <500 for smooth interaction
4. **Force layout**: Reduce `iterations` for faster initial load

## Troubleshooting

**Black screen?**
- Check browser console for errors (F12)
- Verify WebGL support in your browser
- Ensure `graphify.json` is in the same directory

**Labels not showing?**
- Check "Show Labels" checkbox in control panel
- Increase camera zoom with mouse scroll

**Performance issues?**
- Switch to neon style (lower shader complexity)
- Reduce node count
- Disable auto-rotate
- Check GPU temperature

## Future Enhancements

- [ ] Graph filtering and search
- [ ] Animation between layout types (force-directed, hierarchical, etc.)
- [ ] Export visualization as image/video
- [ ] Physics-based interactions
- [ ] More visual styles (wireframe, holographic, etc.)
- [ ] Network statistics panel
- [ ] Zoom to node functionality
- [ ] Link thickness based on relationship strength

## License

MIT - Feel free to use in your projects!

## Credits

- Inspired by [Codrops Glass Effect Tutorial](https://tympanus.net/codrops/2021/10/27/creating-the-effect-of-transparent-glass-and-plastic-in-three-js/)
- Neon style inspired by [Rahultron](https://rahul-logs.vercel.app/rahultron)
- Built with [Three.js](https://threejs.org/)
