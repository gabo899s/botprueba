# InfiniteDev 3.8 — replacement home page

The home page now comes from the user's uploaded
`infinitedev_by_adamsitoo_soluciones_infinitas_para_tus_proyectos.html`.
It replaces the previous portfolio markup, custom styles and behavior, including
its SVG blue-metal filter, introductory typography sequence, hero atmosphere,
community section, services, inline multi-step request assistant, empty-review
state, legal tabs and footer. Maes RP pages and the bot are unchanged.

Integration differences from the supplied standalone file:

- Styles and scripts are extracted to same-origin files, compatible with the
  existing Content Security Policy. The static inline progress-bar style becomes
  a CSS class. The original `transformOrigin` typo becomes `transform-origin`.
- Tailwind 3.4.17 utilities are compiled ahead of time; no CDN script or browser
  compiler is required. The two dynamically selected responsive stepper layouts
  are included explicitly in the build configuration.
- Font families and requested weights are hosted locally. Inter, Noto Serif and
  Open Sans variable fonts, Cinzel Decorative Bold and Space Mono Bold come from
  the official Google Fonts repository with their accompanying OFL licenses.
- Product menus preserve `/maes-rp` access on desktop and mobile. The added menu
  uses the supplied navigation's styling; mobile navigation applies below 1024px
  so the additional desktop link does not overflow the capsule.
- Existing full legal policies and the privacy-rights interface remain linked.
  The short cookie text distinguishes the portfolio's in-memory wizard from the
  separate authenticated Maes RP session.
- Background controls are inert during the intro. Local fonts load before its
  timed sequence; hiding the tab releases the controls and pauses the animation.
  Reduced motion skips the intro. Escape closes mobile and product menus.

The former visual-reference-3.7 document describes the superseded version.

## Rebuilding utility CSS after future class changes

Ordinary installation and startup do not require a build step. For development:

```bash
npx --yes --package tailwindcss@3.4.17 tailwindcss --config scripts/portfolio.tailwind.cjs --input scripts/portfolio-utilities.input.css --output public/css/portfolio-utilities.css --minify
```

Check in the generated CSS together with any markup or script class changes.
Custom styles live in `public/css/portfolio.css`; local font declarations live in
`public/css/portfolio-fonts.css`.
