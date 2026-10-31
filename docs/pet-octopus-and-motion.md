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
