# All-companion eating audit (1.11.3)

The prior checks validated normalized frames and stage bounds, which could miss a character already cut off in its source atlas. This repair adds source-image checks before cropping.

All four roles now have dedicated six-frame eating atlases in both3D and pixel styles: space/pixel-{cat,robot,rabbit,octopus}-eat.png. The cat, robot and rabbit atlases are newly drawn; octopus atlases from1.11.1 are retained. Existing drinking frames remain unchanged. All original faces, ears, costumes and accessories were used as references. Robot has no furry tail or organic face; bunny has its original exposed fur and long ears, without a helmet.

Built-in imagegen prompt set: original character identity from space-rescue.png, one role per3-column2-row transparent atlas, six food discovery/reach/nibble/chew/happy poses, complete ears/antenna/tail/hands with generous cell gutters, fixed camera/scale/floor baseline. Matching polished3D and crisp pixel-art versions. Targeted edits removed an unintended robot skin-cheek detail and an unintended bunny helmet. A padding edit reduced the entire pixel bunny groups within their cells after the first source test found only1px of edge margin.

Validation: scripts/pet-all-feeding-test.cjs audits48 source frames with a required8px minimum opaque-pixel margin; measured minimum is9px. It then verifies all normalized eating canvases and16 role/style/left-right feeding combinations, tracks actual bounds during eating, confirms multiple animated frames and return to walking. Existing18px stage safety inset remains unchanged. Source art audit can run separately with QUOTA_ART_ONLY=1.
