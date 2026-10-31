# Octopus eating bounds (1.11.1)

Diagnosis: loaded eating frames stayed within their144px canvases, but feeding targets allowed the72px actor box to reach x0 at the rounded stage edge. This could cut off tentacles at the window corners. The original shared care atlas also had tight cell gutters.

Fix: feedingTarget keeps the full actor box18px inside each horizontal edge and aligns the food with its center. Clicks near corners are projected to that safe ground position. This applies to all companions. Normal walking, stage dimensions and provider geometry are unchanged.

Dedicated six-pose octopus eating atlases replace the eating half of the care assets: src/ui/pets/space-octopus-eat.png and src/ui/pets/pixel-octopus-eat.png. Existing drinking frames remain unchanged.

Built-in imagegen used space-octopus-orange.png as the original identity reference. Prompt set: original orange round head, brown eyes, white sclera, eyebrows and suction-cup tentacles, no clothing;3columns2rows, six eating poses (notice nugget, reach, nibble, chew, swallow, upright), same body scale/camera/foot baseline, complete tentacles with generous transparent cell gutters. One matching polished3D version and one crisp limited-palette pixel version. No text, scenery or extra characters.

Tests cover safe targets at multiple stage widths, center clicks unchanged, all12 eating-frame margins, both stage corners in both styles, actual actor bounds throughout eating, frame progression, return to walking and renderer errors.
