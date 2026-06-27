# 📚 Graphify Documentation Index

Welcome to **Graphify** - Interactive 3D Graph Visualization with Glass & Neon Effects!

## 🚀 Quick Navigation

### I want to...

**Get started immediately**
→ Read [`QUICKSTART.md`](QUICKSTART.md) (5 min read)
- 30-second setup
- Basic usage
- Common issues

**Understand all features**
→ Read [`FEATURES.md`](FEATURES.md) (checklist format)
- Complete feature list
- Implementation details
- What's included

**Customize for my needs**
→ Read [`CUSTOMIZATION.md`](CUSTOMIZATION.md) (detailed guide)
- Change colors
- Adjust physics
- Add new styles
- Performance tips

**Learn everything in detail**
→ Read [`README.md`](README.md) (comprehensive)
- Full documentation
- All properties explained
- Browser support
- Troubleshooting

## 📁 File Structure

```
graphify/
├── index.html              # ⚙️ Main HTML file - UI structure
├── style.css              # 🎨 Styling - themes & layout
├── main.js                # 💻 All JavaScript logic (modular classes)
├── graphify.json          # 📊 Sample graph data
├── QUICKSTART.md          # 🚀 30-second setup guide
├── README.md              # 📖 Complete documentation
├── CUSTOMIZATION.md       # 🎯 Detailed customization guide
├── FEATURES.md            # ✨ Feature checklist
└── INDEX.md               # 👈 This file!
```

## 🎯 Key Features

| Feature | File | Details |
|---------|------|---------|
| Glass Effect | main.js | `MaterialFactory.createGlassMaterial()` |
| Neon Effect | main.js | `MaterialFactory.createNeonMaterial()` |
| 3D Scene | main.js | `SceneManager` class |
| Graph Data | main.js | `Graph` class |
| Nodes | main.js | `Node` class |
| Links | main.js | `Link` class |
| UI/Controls | index.html, style.css | Panels, buttons, toggles |
| Themes | style.css | Light/dark mode |
| Data | graphify.json | Sample graph |

## 💡 How to Use

### 1️⃣ Setup (Choose One)

**Python**
```bash
python -m http.server 8000
# Visit: http://localhost:8000
```

**VS Code Live Server**
- Install extension
- Right-click index.html → "Open with Live Server"

**Any HTTP Server**
```bash
# Node.js
npx http-server

# Or any other local server
```

### 2️⃣ Interact

- **Drag**: Rotate view
- **Scroll**: Zoom
- **Click**: Select node/link
- **Buttons**: Change style, theme, settings

### 3️⃣ Customize

Edit `graphify.json` to load your data, or modify CSS/JS as needed.

## 📖 Documentation Guide

### For Different User Types

**Developer Starting Out**
1. Read QUICKSTART.md
2. Run the visualization
3. Read README.md section "How to Use"
4. Try changing colors in CUSTOMIZATION.md

**Experienced Developer**
1. Look at FEATURES.md checklist
2. Review main.js architecture
3. Check CUSTOMIZATION.md for advanced topics
4. Extend as needed

**Designer**
1. Check CUSTOMIZATION.md "Visual Customization"
2. Play with colors in style.css
3. Try different materials in MaterialFactory
4. Adjust lighting and effects

**Data Scientist**
1. Review graphify.json format in README.md
2. Learn about force-directed layout
3. Customize Graph.applyForceDirectedLayout() parameters
4. Add custom properties to nodes

## 🎨 Visual Customization Quick Links

| Want to... | See... | Section |
|-----------|--------|---------|
| Change node colors | CUSTOMIZATION.md | "Changing Node Colors by Community" |
| Adjust node size | CUSTOMIZATION.md | "Adjusting Node Size" |
| Tweak glass material | CUSTOMIZATION.md | "Glass Material Properties" |
| Adjust neon brightness | CUSTOMIZATION.md | "Neon Material Properties" |
| Change bloom effect | CUSTOMIZATION.md | "Bloom Effect Intensity" |
| Modify layout spacing | CUSTOMIZATION.md | "Force-Directed Layout Parameters" |
| Adjust camera speed | CUSTOMIZATION.md | "Camera Controls" |
| Change theme colors | CUSTOMIZATION.md | "Change Theme Colors" |

## 🔧 Customization Roadmap

### Easy (5 minutes)
- Change node colors
- Adjust bloom intensity
- Toggle features on/off
- Switch themes

### Medium (15 minutes)
- Modify layout parameters
- Change material properties
- Add new UI controls
- Display custom data

### Advanced (1 hour)
- Create new shader effects
- Add animation framework
- Implement search/filter
- Build custom interactions

## 📊 Data Format

Quick reference:

```json
{
  "nodes": [{
    "id": "string",           // Unique identifier
    "label": "string",        // Display name
    "community": 0,           // Color group
    "weight": 0.8,            // Size (0-1)
    "source_file": "string",  // Metadata
    "source_location": "L42"   // Metadata
  }],
  "links": [{
    "source": "string",       // Source node ID
    "target": "string",       // Target node ID
    "relation": "string"      // Type (calls, uses, etc.)
  }]
}
```

## 🚀 Performance Optimization

For large graphs:
1. See CUSTOMIZATION.md → "Performance Optimization"
2. Disable labels for 1000+ nodes
3. Reduce subdivision levels
4. Use neon style (faster)
5. Limit layout iterations

## ❓ Common Questions

**Q: How do I load my own data?**
A: Replace `graphify.json` with your data following the format in README.md

**Q: Can I change the colors?**
A: Yes! See CUSTOMIZATION.md → "Changing Node Colors by Community"

**Q: How do I add more styles?**
A: Create new material in MaterialFactory, add radio button, update event listener

**Q: Is it mobile-friendly?**
A: Yes! Includes responsive design and touch controls

**Q: Can I export the visualization?**
A: Currently shows on screen. Can be extended with screenshot/video export

**Q: What browser do I need?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ (WebGL 2.0)

## 🔗 External Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Glass Effect Tutorial](https://tympanus.net/codrops/2021/10/27/creating-the-effect-of-transparent-glass-and-plastic-in-three-js/)
- [Rahultron Example](https://rahul-logs.vercel.app/rahultron)
- [Force-Directed Layouts](https://en.wikipedia.org/wiki/Force-directed_graph_drawing)
- [WebGL Guide](https://www.khronos.org/webgl/)

## 📝 File Descriptions

### index.html
- Defines page structure
- Creates UI panels and controls
- Loads CDN scripts (Three.js, controls, post-processing)
- Handles DOM elements for interaction

### style.css
- Complete styling system
- Dark/light theme via CSS variables
- Responsive design breakpoints
- Smooth animations and transitions
- Glass morphism effects

### main.js
- **MaterialFactory**: Creates different shader materials
- **SceneManager**: Manages 3D scene, rendering, interaction
- **Node**: Represents graph nodes
- **Link**: Represents connections
- **Graph**: Main app logic, data loading, layout

### graphify.json
- Sample graph data
- 15 nodes in 3 communities
- 19 links between nodes
- Ready to customize with your data

## 🎓 Learning Path

1. **Day 1**: QUICKSTART.md → Get it running
2. **Day 2**: README.md → Understand architecture
3. **Day 3**: CUSTOMIZATION.md → Tweak your version
4. **Day 4**: FEATURES.md → Deep dive into specifics
5. **Day 5**: main.js → Study the code
6. **Day 6+**: Extend and customize!

## ✨ Ready?

Start here:
- **First time?** → [`QUICKSTART.md`](QUICKSTART.md)
- **Need details?** → [`README.md`](README.md)
- **Want to customize?** → [`CUSTOMIZATION.md`](CUSTOMIZATION.md)
- **Check features?** → [`FEATURES.md`](FEATURES.md)

## 🆘 Troubleshooting

**Problem** | **Solution**
-----------|------------
Black screen | Check F12 console for errors, verify WebGL support
Labels hidden | Zoom in, check "Show Labels" checkbox
Slow performance | Switch to Neon style, reduce nodes, disable bloom
No data loaded | Verify graphify.json exists and is in same directory
Controls not working | Ensure you're clicking on canvas, not UI

## 🎉 You're All Set!

Everything is ready to use. Pick a guide above and start exploring!

Questions? Check the relevant documentation file above.

Happy visualizing! 🚀✨
