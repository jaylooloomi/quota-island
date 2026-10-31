# Dedicated recharge animations (1.13.0)

Four independent transparent six-frame atlases: space-{cat,robot,rabbit,octopus}-recharge.png. Generated with built-in imagegen using original space-rescue.png and space-octopus-orange.png references. Prompt: preserve original character identity, fixed camera and planted floor, strict 3x2 grid, generous gutters, no background/text, six connect/charge/energized poses. Cat connects power cell to suit; robot charges chest port; rabbit charges star antenna; octopus connects cable with tentacles. These are separate assets from greeting, drinking and rescue theater.

Renderer uses dedicated loadRecharge() and a 3.6-second six-keyframe sequence with interpolation. Translucent helmet and charging glow are included in crop/alignment bounds. Existing seven-second action duration retained.

Packaged regression verifies all four selector actions animate independently, all 24 frames fit the canvas including translucent pixels, recharge assets differ from greetings, no synthetic battery overlay and no renderer errors. Unit suite: 103 passed.
