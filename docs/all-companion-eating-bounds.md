# All-companion eating audit (1.11.3)

The prior checks validated normalized frames and stage bounds, which could miss a character already cut off in its source atlas. This repair adds source-image checks before cropping.

All four roles now have dedicated six-frame eating atlases in both3D and pixel styles: space/pixel-{cat,robot,rabbit,octopus}-eat.png. The cat, robot and rabbit atlases are newly drawn; octopus atlases from1.11.1 are retained. Existing drinking frames remain unchanged. All original faces, ears, costumes and accessories were used as references. Robot has no furry tail or organic face; bunny has its original exposed fur and long ears, without a helmet.

Built-in imagegen prompt set: original character identity from space-rescue.png, one role per3-column2-row transparent atlas, six food discovery/reach/nibble/chew/happy poses, complete ears/antenna/tail/hands with generous cell gutters, fixed camera/scale/floor baseline. Matching polished3D and crisp pixel-art versions. Targeted edits removed an unintended robot skin-cheek detail and an unintended bunny helmet. A padding edit reduced the entire pixel bunny groups within their cells after the first source test found only1px of edge margin.

Validation: scripts/pet-all-feeding-test.cjs audits48 source frames with a required8px minimum opaque-pixel margin; measured minimum is9px. It then verifies all normalized eating canvases and16 role/style/left-right feeding combinations, tracks actual bounds during eating, confirms multiple animated frames and return to walking. Existing18px stage safety inset remains unchanged. Source art audit can run separately with QUOTA_ART_ONLY=1.

## 1.11.4 translucent helmet follow-up
Eating atlas crops now include alpha above 8 rather than only opaque pixels above 120, so translucent helmet edges are retained. Eating sprites also use a 56-unit extent rather than 62 to leave more canvas margin. The canvas audit now inspects translucent pixels as well. Packaged cat checks cover both styles and both feeding edges; the 103 unit tests pass. A broader source runtime run passed all 3D roles but encountered a missed feeding click in the pixel robot case (food stayed hidden), so it is not counted as a full runtime pass for this revision.
