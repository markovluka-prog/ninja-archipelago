---
name: procedural-3d-cartoon-maker
description: Use when asked to make a short 3D cartoon or animated film from code-built models: story, shots, camera, sound, fast deterministic render and MP4 export. Pairs with procedural-3d-animation.
---

# 3D cartoon maker (fast mode)

Short film (15-60 s) from code-built 3D models. Models, rigs and physics come from `procedural-3d-animation`. Priority: **a watchable draft in minutes, then polish only what the user asks for.**

## 0. Speed rules (apply everywhere)
- Never ask questions the defaults can answer. Defaults: 16:9, 30 s, 30 fps, cute low-poly toon style, no dialogue, one hero.
- **Draft first**: 480p, 12 fps, no shadows, no outlines, no post-processing. Show it, then render final only once.
- **One file, one pass**: a single `scene.html` with all models, timeline and camera. Do not split into many modules.
- **Reuse, don't redesign**: parametric builders (`makeCharacter(opts)`, `makeProp(type)`); simple primitives (spheres, capsules, rounded boxes) over complex geometry.
- **Cap complexity**: <= 3 characters, <= 8 props, <= 6 shots, <= 50k triangles, shadow map 1024, pixel ratio 1 for draft.
- **Batch tool calls**: write the whole scene in one file write, run render and encode in one command. Fix with small Edits, never rewrite the file.
- Do not re-render the full film to fix one shot: render only the frame range of that shot (`--from/--to`) and splice.

## 1. Brief (one line, no questions)
Hero, want, obstacle, ending. Pick everything missing yourself and state the choice in one line.

## 2. Shot list (table, 4-6 shots)
`#, seconds, camera, action, sound`. Each shot 2-6 s, one gag or emotion per shot, cut on action. Structure: setup 15% -> escalation 60% -> payoff 25%.

## 3. Look
Toon material (`MeshToonMaterial`, 3-step ramp), 3-4 flat colors from a fixed palette, sky gradient, simple ground. Outline (inverted hull) and soft shadow only in the final pass.

## 4. Animation (cartoon principles, cheap to implement)
- Squash and stretch on bounces, anticipation before big moves, overshoot and settle (spring easing), arcs, holds on key poses, follow-through on tails, ears, cloth.
- Drive all from a master timeline `renderFrame(i)`: t = i/fps, pure function of time, seeded RNG, fixed-step physics pre-baked into arrays at load.
- Camera: keyframed position/target/FOV with easing; one purposeful move per shot.

## 5. Sound (synthesized, 1 script)
One Python/numpy script writes `audio.wav`: bass + chord + pentatonic melody, tempo matched to cuts, SFX (pop, whoosh, thud) at timeline event times. Same event list drives animation and sound, so they stay in sync.

## 6. Fast render pipeline
1. `renderFrame(i)` with `preserveDrawingBuffer: true`.
2. Playwright/headless Chrome, `--use-gl=angle` or `swiftshader`, **N parallel workers** (N = CPU cores, each takes a frame range); save JPEG q90 for draft, PNG for final.
3. Encode in one command:
   `ffmpeg -framerate 30 -i frames/%05d.png -i audio.wav -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -shortest out.mp4`
4. Draft -> check -> final. Skip the draft only if the film is under 10 s.

## 7. Quick QA (one contact sheet, not many)
Montage of 1 frame per 0.5 s (`ffmpeg ... -vf tile`). Check: hero in frame, no clipping, readable poses, SFX within 2 frames of impacts, even dimensions and yuv420p. Fix only visible defects, one pass.

## 8. Delivery
Send the MP4 plus one line on what happens in the film. Offer one next step (new scene, new character, other style). State honestly: stylized code-built characters, not studio rigs.