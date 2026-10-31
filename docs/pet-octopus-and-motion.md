# Four-character companion update (1.7.0)

- Existing Claude cat, Codex robot, Antigravity rabbit remain available. Octopus is an independent companion, not an additional quota provider.
- Settings: choose a character, then summon walking or preview the title pet. Automatic visits include all four characters; rescue scenes keep their three provider roles.
- Rabbit uses a replacement twelve-frame walking atlas. All walking frames use shared scale, horizontal centering and grounded foot alignment; movement remains continuous with edge turning.
- Octopus uses twelve walking frames and twelve hello frames. Title visits play the hello sequence; stage roaming plays walking and mirrors at the edge. Classic/smooth/pixel rescue choices remain available.
- Original source atlases retained. New assets: src/ui/pets/space-rabbit-walk.png and src/ui/pets/space-octopus.png.

## Asset generation
Built-in imagegen was used (not CLI). Final prompt set: regular six-column transparent 3D sprite atlases; twelve consecutive right-facing lavender astronaut rabbit walking poses; turquoise baby octopus with ivory collar and gold star, twelve tentacle walking poses plus twelve friendly waving hello poses, consistent camera, size and baseline. An alpha extraction edit preserved octopus grid positions. PNG alpha is preserved; RGB backdrop colors in transparent pixels are not rendered.

## Validation
scripts/pet-crew-test.cjs checks four roles through the actual settings UI, twelve nonempty centered grounded frames, both directions, continuous motion, octopus hello rendering and renderer errors. Existing i18n and three-style desktop regression tests remain applicable.

## Orange reference redesign (1.7.2)

Active octopus atlas: src/ui/pets/space-octopus-orange.png. Previous turquoise atlas is retained. Built-in imagegen used the user-provided orange octopus as design reference only. Final prompt: transparent 6-column, 4-row atlas, 24 equal cells; friendly orange octopus with round head, large brown eyes and white sclera, curved eyebrows, joyful smile, subtly textured skin and cream-peach suction cups; no clothing or props; fixed three-quarter right-facing camera; first twelve frames seamless tentacle walk, last twelve frames greeting wave. Keep body scale and floor baseline consistent.

Rendered opaque silhouettes are recentered after resampling to avoid jitter caused by low-alpha tentacle edges. Moving status now reads 職守中 / On duty / 見守り中 / 근무 중.

## Original rabbit restored (1.7.4)

Walking now uses the original rabbit frames in space-walk.png, exactly the same original character artwork. The redesigned space-rabbit-walk.png is retained as an unused historical asset. Shared centering, fixed scale, grounded baseline, frame interpolation and continuous left/right motion remain. Do not substitute a newly designed rabbit when improving motion.
