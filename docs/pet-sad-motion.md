# Dejected action animation repair (1.9.3)

Root cause: classic/smooth cat, robot and bunny used one static sad pose (frame1 from the classic rescue atlas), with only1.2% breathing. Pixel frames existed but their subtle changes were hard to notice.

All four3D roles now use six original-reference poses from src/ui/pets/space-sad-motion.png. The four-second action lowers the head, sighs and recovers before returning to walking. Pixel mode plays its existing six sad frames discretely, with the same explicit sigh/recovery phase and a short localized sigh bubble. Reduced motion keeps a static dejected pose and no animated bubble movement.

Built-in imagegen prompt: use original rescue and orange octopus references, preserve the kitten, tailless ivory robot, original floppy-ear bunny and orange octopus; six columns/four rows on transparent alpha. Six clearly different poses per row: neutral, lowering head and shoulders, fully bowed, closed-eye exhale with pale blue puff, recovering, upright. Same full-body scale and grounded feet, no redesign, no text or environment. Measured row cuts preserve complete heads, ears and antennae.

Validation: sadPose unit tests cover time clamping, finite indices, lower/sigh/recover phases, discrete pixel playback and reduced motion. Desktop test samples actual canvas pixels over3.45 seconds for every combination of four roles and three styles, requires at least three distinct raster images and four pose indices, then verifies return to walking. Pixel-mode regression still audits192 binary-alpha integer-grid frames.
