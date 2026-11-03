/**
 * App-wide UI colors. This lives under src/terminal so terminal screens can
 * use it without importing the UI namespace; src/ui/brand re-exports it.
 */
export const uiColors = {
  background: '#090C0D',
  panel: '#0D1112',
  panelRaised: '#111617',
  border: '#30383B',
  borderSoft: '#232A2D',
  ink: '#F2F4F5',
  muted: '#AAB7C6',
  subdued: '#707C84',
  accent: '#FFC21A',
  /** Gold-tinted fill behind accent-bordered selected or success states. */
  accentSurface: '#201A0A',
  /** Near-black for inset text wells and for text on accent fills. */
  inset: '#0B0A06',
  danger: '#FF8795',
  warning: '#FFC65C',
} as const;
