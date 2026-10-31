# Interactive companions (1.8.0)

Resident walking now includes a random action after 35–60 seconds, then 35–65 seconds between actions. Greeting and sad poses last4 seconds, sleep9 seconds, water7 seconds, eating4 seconds. Adjacent automatic actions do not repeat. After a water break there is a20-minute active-play cooldown for automatic water reminders; manual preview remains available. These actions are expressions, not quota state.

Settings offer character and action selectors plus Preview pet action. Walking resumes after each action. Real quota rescue preempts all resident activity. Closing or native suspension clears the food target and pending animation. Reduced motion keeps static companionship without character travel or animated effects.

Click the pet stage (not the quota strip or close button) to drop a food pile onto the ground below the click. One target is kept; a new click replaces it. The character turns and accelerates toward it at up to85px/s versus38px/s for normal walking, eats on arrival, and resumes walking. Targets near the left/right edges are supported without teleporting back into the normal stroll region.

## Artwork
Built-in imagegen generated project assets:
- src/ui/pets/space-care.png: six-column, eight-row sprite atlas; original cat/robot/rabbit and orange octopus, six water bottle drinking poses and six eating poses per character. Reference original faces, costumes and proportions; robot has no animal tail in new care art.
- src/ui/pets/space-care-props.png: transparent two-cell golden star food nuggets and blue water bottle.
- src/ui/pets/space-octopus-rest.png: original orange octopus, six sleepy/dejected poses and six sleeping poses.
Prompt set: preserve supplied character identities; polished3D, transparent backgrounds, fixed camera/body scale/floor baseline, sequential drinking/eating and sleeping frames, generous gutters, no text or environment. Original classic atlas supplies the three existing sad/sleep poses; smooth atlas supplies greetings. Per-row bounds account for generated atlas spacing; edge fragments are removed before normalization.

## Validation
Unit tests cover random scheduling, action duration, feeding priority, both edge targets and returning without teleportation. Desktop tests cover16 role/action combinations, actual sprite rendering, feed arrival, eating, return to walking, replacing targets, close cleanup, and renderer errors. Existing resident, four-language and style tests remain applicable.

## Deferred TODO: message receiver and bubbles
Not implemented in this release. Future module should accept RSS/Atom polling or local messages, normalize them into a bounded queue (title/body/source/time), and display plain-text bubbles above the current companion. Feed interaction and real quota alerts should take priority. Add source management, pause/mute, preview, duplicate suppression and a reading duration limit. No execution of received text. Keep the quota strip geometry fixed and measure bubble height inside the existing stage.

## Selectable stage backgrounds (1.8.1)
Settings → Stage background offers Meteor forest (default), Vivid nebula, and Classic night. Validated choices persist across restart. All backgrounds use the same112px stage and do not change quota or actor positions.

Built-in imagegen generated src/ui/pets/meteor-forest.png from the user's landscape as visual reference. Final prompt: original panoramic3:1 deep teal/midnight sky with dense tiny stars, cyan/gold shooting stars, small blue crescent moon in the upper right third, layered turquoise mountains and dark pine forest, thin warm horizon glow, clear dark ground for pets, polished painterly style; no text, watermark, logos or characters.
