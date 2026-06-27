# Quick Start Guide

## 🚀 Get Started in 30 Seconds

### Step 1: Start a Local Server

Choose one method based on what you have installed:

**Python 3** (most common)
```bash
cd d:\opt\github\devopsnextgenx\clear-glass-threejs
python -m http.server 8000
```

**Python 2**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js**
```bash
npx http-server
```

**VS Code** (simplest if you use VS Code)
1. Install "Live Server" extension (5Down Goyal)
2. Right-click `index.html`
3. Select "Open with Live Server"

### Step 2: Open in Browser

Navigate to: `http://localhost:8000`

You should see the 3D graph visualization loading!

## 🎮 First Steps

1. **Rotate**: Click and drag with mouse
2. **Zoom**: Scroll wheel
3. **Click a sphere**: See details in the right panel
4. **Switch styles**: Select "Neon Glow" in top-left panel
5. **Toggle theme**: Click sun/moon icon (top-right)

## 📋 File Overview

| File | Purpose |
|------|---------|
| `index.html` | UI structure and controls |
| `style.css` | Styling with theme support |
| `main.js` | All 3D logic and interactions |
| `graphify.json` | Sample data (replace with your own) |
| `README.md` | Full documentation |

## 🎨 Two Built-in Styles

### Glass Effect (Default)
- Transparent material like real glass
- Color tint with reflections
- Professional, technical feel
- Best for: Code dependency graphs, network diagrams

### Neon Glow
- Luminous, emissive materials
- Glowing effect like Rahultron
- Modern, artistic feel
- Best for: Creative visualization, dashboards

## 🎛️ Controls Explained

**Top-Left Panel:**
- `Glass Effect / Neon Glow`: Switch visual style
- `Show Labels`: Toggle node names
- `Auto Rotate`: Automatic scene rotation
- `Reset View`: Back to initial view

**Top-Right Button:**
- 🌞/🌙: Switch between light and dark themes

**Right Panel (appears on selection):**
- Shows selected node/link details
- Source files, relationships, communities
- Click × to close

## 🔗 Your Own Data

Replace the default `graphify.json` with your own:

```json
{
  "nodes": [
    {
      "id": "my-node",
      "label": "My Component",
      "community": 0,
      "weight": 0.8,
      "source_file": "src/component.ts",
      "source_location": "L42"
    }
  ],
  "links": [
    {
      "source": "node-1",
      "target": "node-2",
      "relation": "calls"
    }
  ]
}
```

## 🐛 Common Issues

**"Cannot GET /"**
→ Make sure you're serving from the correct directory containing all files

**Black screen**
→ Check browser console (F12) for errors, ensure WebGL is supported

**Labels not visible**
→ Check "Show Labels" checkbox, zoom in with scroll wheel

**Slow performance**
→ Try Neon Glow style, reduce number of nodes, or disable auto-rotate

## 📱 Mobile Support

Works on mobile with touch controls:
- 1 finger drag: Rotate
- 2 finger pinch: Zoom
- Tap: Select node (on devices with larger screens)

## 🎓 Customization Examples

### Change Default Style
In `main.js`, line with `this.sceneManager.setStyle('glass')`, change to `'neon'`

### Change Node Colors
Edit `Node.getCommunityColor()` - modify the color hex codes

### Adjust Physics Layout
In `Graph.applyForceDirectedLayout()`:
- Increase `repulsion` for more spread
- Decrease `k` for tighter clusters
- Increase `iterations` for better layout

### Faster/Slower Loading
Reduce `iterations` in `applyForceDirectedLayout()` for faster, or increase for better spacing

## 🔗 Useful Resources

- Three.js Docs: https://threejs.org/docs/
- WebGL Guide: https://www.khronos.org/webgl/
- Force-Directed Layout: https://en.wikipedia.org/wiki/Force-directed_graph_drawing

## ✅ What's Included

✓ Glass shader with transmission and clearcoat
✓ Neon/glow effect with emissive materials
✓ Bloom post-processing
✓ Light/dark themes
✓ Orbit camera controls
✓ Force-directed layout
✓ Interactive selection
✓ Details panel
✓ Fully modular, reusable code
✓ Responsive design
✓ No build tools needed

## 🎯 Next Steps

1. Run the visualization
2. Explore both styles
3. Try different themes
4. Load your own data
5. Customize colors and physics
6. Use in your project!

Need more help? Check the full README.md file.
