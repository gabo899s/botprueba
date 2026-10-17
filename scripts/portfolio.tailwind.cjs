// Build-only configuration. The published page uses the checked-in CSS and
// never downloads or compiles Tailwind in the visitor's browser.
const path = require('node:path');
module.exports = {
  content: [path.join(__dirname, '../public/index.html'), path.join(__dirname, '../public/js/portfolio.js')],
  safelist: ['sm:grid-cols-4', 'sm:grid-cols-5'],
  darkMode: 'class',
  theme: { extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      averia: ['"Averia Serif Libre"', 'Georgia', 'serif'],
    },
    colors: { canvas: '#040406', surface: '#0A0B0E', surfaceHover: '#101218' },
  } },
};
