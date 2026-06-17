# Rumah 5 × 12.5 m — 3D Interior Walkthrough

A fully interactive 3D model of a narrow two-storey house (5 m wide × 12.5 m deep),
built with **Three.js**. No build step, no internet — Three.js is vendored locally.

## Run it

```bash
cd house3d
./run.sh            # serves on http://localhost:8123
# or:  python3 serve.py 8123
```

Then open **http://localhost:8123** in any modern browser.
ES modules require `http://` (opening `index.html` as a `file://` is blocked by browser CORS),
which is why a tiny static server is included.

## Controls

| Action | How |
|---|---|
| Orbit / zoom / pan | drag · scroll · right-drag |
| Preset cameras | **Isometric / Top / Front / Side** |
| Dollhouse cutaway | uncheck **Outer walls** |
| Reveal a single floor | uncheck **Upper level** |
| Roof on/off, room labels | checkboxes |
| Night mode | turns on interior lighting |
| First-person walk | **Walk inside** → `WASD` + mouse · `E` upstairs · `Q` downstairs · `Esc` to exit |
| **Live dimensions** | drag the **Width / Carport / Living / Backyard / Floor ht** sliders — the whole house (walls, slabs, stairs and furniture) rebuilds in real time. **reset** restores the site-plan values. |

## Layout (built to the site plan — Lantai 1 & 2)

Lot **5.0 m wide × ~15.4 m deep**. Metric and to scale; the backyard back wall is
slanted to match the plan (6.41 m left / 5.73 m right).

**Lantai 1** — carport (front, car parked clear of the house) → ruang tamu + ruang
makan (open plan, left) with toilet, staircase and dapur (kitchen: sink, stove,
fridge, washer) on the right strip → backyard at the rear. Enclosed depth ≈ 4.9 m.

**Lantai 2** — Kamar Tidur 1 (master) + KM/WC 1 at the front (over the carport),
KM/WC 2 mid-floor, Kamar Tidur 2 & 3 at the back overlooking the backyard void.
Floor-to-floor +3.00 m. Floor depth ≈ 6.5 m (cantilevers over the carport).

Between floors is a **winder (curved) staircase** around a central newel, matching
the fan stair drawn in the plan, with its entry beside the ground-floor toilet.

The interior is laid out to match the site plan's orientation (mirrored left-right),
windows are only on the **front and back** faces (side walls solid), and the 2nd-floor
rear sits **80 cm deeper** than the ground-floor back wall.

The geometry is **parametric** — `computeLayout()` in `js/house.js` turns a handful
of dimensions into every wall/slab/room rectangle, and the furniture is placed
relative to those rectangles, so changing a dimension moves everything correctly.

## Realism

Procedural textures (wood planks, ceramic tile, painted walls, lawn, paving),
image-based ambient lighting (`RoomEnvironment` + PMREM) for soft reflections,
a gradient sky, and 4K soft shadows from a directional "sun".

## Structure

```
house3d/
  index.html        # UI + import map
  styles.css
  serve.py          # static server (no os.getcwd — sandbox-safe)
  js/
    main.js         # scene, lights, camera, UI, furnishing, walk mode
    house.js        # shell: slabs, walls-with-openings, stairs void, roof
    furniture.js    # primitive-based furniture/fixture library
  vendor/           # Three.js r160 (local copy)
```

All geometry is metric — 1 unit = 1 metre — and the footprint is centred on the origin.
