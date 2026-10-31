# Complete pixel companion mode (1.9.0)

Select Settings → Pet animation style → Pixel animation. The style now controls all four characters' walking, greetings, sad expressions, sleep, water reminders, eating, title visits and quota rescue scenes. Food props and the Meteor forest background also switch to dedicated pixel artwork. Other animation styles and background choices remain available.

## Reference artwork and generation
Built-in imagegen used original space-rescue.png, repaired space-robot-walk.png, orange space-octopus-orange.png, and space-care.png as identity/action references. New project assets are pixel-cat.png, pixel-robot.png, pixel-rabbit.png, pixel-octopus.png, pixel-rabbit-sleep.png, pixel-props.png and pixel-meteor.png under src/ui/pets/.

Final prompt set: one6-column7-row transparent pixel-art atlas per original role, preserve original face, outfit, proportions, ears/antenna and colors, robot has no tail; twelve walking frames followed by six greeting, sad, sleep, drinking and eating frames; crisp limited-palette pixel clusters with generous gutters. A separate3-column2-row sleeping bunny atlas preserves the original curled-up/seated pose with closed eyes. Props preserve the golden star nuggets and blue water bottle. Landscape converts the original blue-green meteor sky, crescent moon, mountain silhouettes and pine forest into pixel art.

The generated bunny atlas omitted sleep and duplicated eating, so runtime explicitly maps its actual drinking/eating rows and uses the separate sleep atlas. Measured row bounds and independent per-frame edge cleanup prevent neighbouring sprites leaking into crops. Characters are rendered on a48px grid and enlarged by3 with nearest-neighbour and binary alpha. Pixel mode disables crossfading and fractional breathing deformation; discrete action frames retain actual animation.

## Validation
scripts/pet-pixel-complete-test.cjs checks192 loaded logical frames for nonempty content, binary alpha and aligned3x3 blocks; all four roles and action previews, pixel props/background, title companions, rescue scene and renderer errors. Existing three-style, four-language and3D interaction tests provide regression coverage. A negative elapsed-time race during rapid preview changes was clamped before selecting rescue frames.

This release fills style coverage; it does not claim that the separate foot-contact/stride calibration work is complete.
