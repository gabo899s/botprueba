# InfiniteDev 3.7 — visual reference

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
The reflective lettering is an original local Canvas 2D implementation with
moving blue/silver reflection ribbons, a text mask and an internal highlight rim.
It recreates the reference appearance rather than distributing the site's shader.
DOM text remains available to assistive technologies and CSS provides a fallback.

Intro timeline (seconds after local font loading):

- 0: white Infinitas in Noto Serif, held until 1.4.
- 1.4, 2.15, 2.65, 2.98, 3.2: Open Sans, Syncopate, Space Grotesk, Poppins,
  then Averia Serif Libre italic. Each family appears once.
- 3.6: reflective blue finish; 3.95: bloom begins revealing.
- 4.1–5.15: word moves into the headline as the remaining page appears.

No neon, viewport edge illumination or violet scroll transition remains.
Reduced motion skips the intro and holds reflections and bloom still. Hiding the
page during intro releases inert controls; reflection rendering pauses while the
tab is hidden and skips the main word when it is outside the viewport.
