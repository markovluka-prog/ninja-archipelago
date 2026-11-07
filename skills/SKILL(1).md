---
name: procedural-3d-animation
description: Use when asked to build 3D models, rig and animate them, or add physics (cloth, flight, rigid bodies) with Three.js or Blender; includes quality checklist and render-and-inspect loop.
---

# Procedural 3D: models, animation, physics

## 1. Choose the engine
- **Three.js (default)**: interactive result in a browser or artifact, single HTML file, ES modules from CDN (pin versions).
- **Blender + Python (`bpy`, headless)**: when the user wants offline renders, glTF/FBX export, or high-quality sculpt/modifier workflows. Check first: `which blender` / `python -c "import bpy"`. If missing, fall back to Three.js and say so.

## 2. Pipeline (do in order, verify each step)
1. **Brief**: subject, style (stylized / low-poly / realistic), target (interactive / render / export). Set a polygon and scale budget.
2. **Model**: build from named parts in a hierarchy (`Group` per limb or component), pivots at joints. Use smooth shading, bevels/rounded shapes, consistent proportions. Never one giant merged mesh if it must animate.
3. **Materials**: PBR (`MeshStandardMaterial`/`MeshPhysicalMaterial`), 3-5 colors max, roughness variation, subtle noise textures generated on canvas.
4. **Lighting**: 3-point or HDRI-style (`RoomEnvironment`), soft shadows, ACES tone mapping, sRGB output.
5. **Animation**: skeleton or joint hierarchy plus `AnimationMixer`/keyframe tracks; use easing, overlap and follow-through, secondary motion (tails, hair, cloth). Expose a clip list and a speed control.
6. **Physics** (see below).
7. **Render and inspect**: screenshot from 3+ angles with headless Chrome/Playwright, look at the images, fix visible problems (intersections, floating parts, flat lighting, wrong scale), repeat at least once.

## 3. Physics recipes
- **Cloth**: Verlet particle grid, structural + shear + bend constraints, 8-15 solver iterations, fixed timestep (1/60, substeps), wind as noise-driven force per triangle normal, pin points, sphere/capsule collisions by pushing particles out. Update `BufferGeometry` positions and recompute normals each frame; render double-sided.
- **Flight (birds, planes, drones)**: lift = 0.5*rho*v^2*S*Cl(alpha), drag likewise, thrust and gravity; control by pitch/roll/yaw torques with damping. Wings: flap cycle plus bank-into-turn. Add trail/particles for readability.
- **Rigid bodies / collisions**: Rapier (WASM) or cannon-es; sync meshes to bodies every step; use simple collider shapes, not the render mesh.
- **Soft secondary motion**: spring-damper chains for tails, hair, antennae.
- Always use a **fixed timestep with accumulator**, clamp dt, and keep physics independent of frame rate.

## 4. Quality checklist (must pass before delivering)
- No z-fighting, no parts floating or clipping, correct normals.
- Silhouette reads clearly from the main camera angle.
- Animation loops seamlessly; no popping at loop point.
- Cloth does not explode or tunnel; stable for 60 s.
- Runs at 60 fps on a mid laptop (limit shadow map size, geometry count, pixel ratio <= 2).
- Controls: orbit camera, play/pause, reset, and sliders for key physics parameters.

## 5. Delivery
- Interactive: one self-contained HTML published as an artifact.
- Offline/export: `.glb` (with animations) plus a rendered preview image or MP4 (ffmpeg, `-preset veryfast`).
- State honestly what code-made geometry can and cannot do (hero characters and photoreal assets need sculpting or purchased/CC0 models; offer glTF import as the upgrade path).