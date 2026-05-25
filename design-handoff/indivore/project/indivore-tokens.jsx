(()=>{
// Indivore — design tokens (extracted from woven-tree reference)
// Warm cream, crimson primary, terracotta + amber + sage accents.

const TOKENS = {
  // Surfaces — warm cream paper, never pure white
  cream:   '#F5EEDF',   // canvas / page bg
  paper:   '#FBF5E7',   // card surface
  paperHi: '#FFFCF3',   // raised card / input
  line:    '#E6DAC0',   // hairline divider
  lineSoft:'#EFE5CF',

  // Ink — warm dark brown, not black
  ink:     '#2B221A',
  inkSoft: '#5C4E3F',
  inkMute: '#8B7B68',
  inkFaint:'#B5A691',

  // Brand — from the woven tree
  crimson:    '#A8351F',   // primary
  crimsonDp:  '#7C2113',
  crimsonHi:  '#C75038',
  crimsonBg:  '#F6E0D6',   // tinted bg

  terra:    '#D2773A',
  terraBg:  '#F6E2CE',
  amber:    '#D9A12F',
  amberBg:  '#F6E5BA',
  sage:     '#7B8C46',
  sageBg:   '#E4E7CC',
  sageDp:   '#566234',

  // Functional
  good:    '#7B8C46',     // sage
  warn:    '#D9A12F',     // amber
  danger:  '#A8351F',     // crimson

  // Type
  fSerif:  'Newsreader, "Source Serif Pro", "Iowan Old Style", Georgia, serif',
  fSans:   'Manrope, "Helvetica Neue", system-ui, -apple-system, sans-serif',
  fMono:   '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
};

// Inject Google Fonts (once)
if (typeof document !== 'undefined' && !document.getElementById('indivore-fonts')) {
  const l = document.createElement('link');
  l.id = 'indivore-fonts';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' +
    'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500&' +
    'family=Manrope:wght@300;400;500;600;700;800&' +
    'family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&' +
    'family=Lora:ital,wght@0,400;0,500;0,600;1,400&' +
    'family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&' +
    'family=Public+Sans:wght@400;500;600;700&' +
    'family=DM+Sans:wght@400;500;600;700&' +
    'family=Inter+Tight:wght@400;500;600;700&' +
    'family=JetBrains+Mono:wght@400;500;600&display=swap';
  document.head.appendChild(l);
}

// Global stylesheet — reset + utility classes scoped to .iv-*
if (typeof document !== 'undefined' && !document.getElementById('indivore-base')) {
  const s = document.createElement('style');
  s.id = 'indivore-base';
  s.textContent = `
    .iv * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    .iv {
      font-family: ${TOKENS.fSans};
      color: ${TOKENS.ink};
      background: ${TOKENS.cream};
      letter-spacing: -0.005em;
    }
    .iv h1, .iv h2, .iv h3, .iv .serif { font-family: ${TOKENS.fSerif}; letter-spacing: -0.02em; }
    .iv .mono { font-family: ${TOKENS.fMono}; letter-spacing: -0.01em; }

    .iv button { font-family: inherit; cursor: pointer; border: 0; background: none; color: inherit; padding: 0; }
    .iv input, .iv textarea { font-family: inherit; color: inherit; }
    .iv input:focus, .iv textarea:focus { outline: none; }
    .iv ::placeholder { color: ${TOKENS.inkMute}; opacity: 1; }

    /* Subtle paper grain */
    .iv-paper-grain {
      background-image:
        radial-gradient(rgba(120,80,40,0.025) 1px, transparent 1px),
        radial-gradient(rgba(120,80,40,0.018) 1px, transparent 1px);
      background-size: 3px 3px, 7px 7px;
      background-position: 0 0, 1px 2px;
    }

    /* Animated count-up — fade on update */
    @keyframes iv-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
    .iv-pulse { animation: iv-pulse .4s ease; }

    @keyframes iv-rise { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .iv-rise { animation: iv-rise .35s cubic-bezier(.2,.7,.3,1); }

    @keyframes iv-flip { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
    .iv-flip { animation: iv-flip .55s ease; transform-style: preserve-3d; }

    @keyframes iv-toast { 0% { transform: translateY(20px); opacity: 0; } 15% { transform: translateY(0); opacity: 1; } 85% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-6px); opacity: 0; } }
    .iv-toast { animation: iv-toast 2s ease forwards; }

    /* Scroll hidden inside iOS frame */
    .iv-scroll::-webkit-scrollbar { display: none; }
    .iv-scroll { scrollbar-width: none; }
  `;
  document.head.appendChild(s);
}

window.TOKENS = TOKENS;

})();
