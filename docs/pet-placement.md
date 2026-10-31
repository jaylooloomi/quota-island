# Resident companion position (1.11.0)

Settings → Companion position selects Lower stage (existing default) or Title area. The setting is validated and saved independently from the Resident roaming pet toggle. Summon resident pet enables residency using the selected character. Title mode stays indefinitely in the existing brand slot, temporarily hiding the name/version, with compact height76px and unchanged provider coordinates. Disable residency to restore branding. Pixel/smooth/classic styles and reduced-motion preferences remain supported.

Title companions use the existing title greeting animation within the brand slot. Feeding requires the lower stage; explicit action previews and real alerts temporarily use that stage and return to the selected resident position afterward. Expanding settings, dragging or hiding suspends display; returning to the compact view resumes the selected position. Normal title preview retains its separate15-second timeout.

Pet controls are grouped in two columns so the extra placement selector fits the four-language settings view without scrolling.

Validation: scripts/pet-placement-test.cjs checks title display beyond16 seconds, requested character, fixed76px height and provider positions, manual action return, stage/title transitions, pixel and reduced motion, restored branding, invalid setting rejection and persistence across restart. Existing resident and locale tests remain applicable.
