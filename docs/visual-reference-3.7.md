# InfiniteDev 3.7.1 — visual reference

The user supplied an MHTML export of the 21st.dev homepage, a screenshot and a
4.79-second recording of its reflective “living” lettering. The live website
returned HTTP 403 in this environment; implementation uses the supplied snapshot.

The upper-page bloom retains the three OKLCH radial gradients, proportions,
72svh vertical anchor and 48px blur found in that snapshot. It is clipped and
faded at the hero boundary so subsequent sections stay black. Its gentle CSS
motion is independent of scrolling. The navigation remains the existing black
floating navigation. Trajectory uses the existing community names directly on
the page, without a surrounding card.

The reference italic word uses Averia Serif Libre. Its open-license font is
bundled with its OFL, from the Google Fonts repository. The regular interface
retains Poppins; the proprietary Apparat font in the snapshot is not distributed.
The reflective lettering is an original local Canvas 2D implementation. A
chamfer distance field and smoothed height field produce rounded glyph normals;
a moving reflected environment creates blue/cyan highlights around stems,
counters and serifs. It replaces the previous screen-wide ribbon gradients.
The glyph mask stays fixed, so reflections do not distort letter shapes. Rendering
is capped at 32 fps, skips the offscreen word and pauses when the tab is hidden.
DOM text remains available to assistive technologies and CSS provides a fallback.

The intro now uses 21 distinct locally bundled families. Additional fonts come
from the official Google Fonts repository, each with its accompanying OFL.

Intro timeline (seconds after local font loading):

- 0–1.7: white Infinitas, held in Noto Serif.
- 1.7–8.05: twenty changes, with intervals decreasing from 1.25 seconds to
  35 milliseconds. No family repeats. Apparent letter height is normalized;
  mobile widths remain constrained.
- 8.4: reflective blue finish; 8.75: bloom begins revealing.
- 8.95–10: word moves into the headline as the remaining page appears.

No neon, viewport edge illumination or violet scroll transition remains.
Reduced motion skips the intro and holds reflections and bloom still. Hiding the
page during intro releases inert controls; reflection rendering pauses while the
tab is hidden and skips the main word when it is outside the viewport.
