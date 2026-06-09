// Subtle grain texture over gradients — makes them look expensive vs. flat.
// z-[1] keeps it above page background but below all interactive layers (z-30+).
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025]"
      style={{ backgroundImage: NOISE_SVG, backgroundSize: '128px 128px' }}
      aria-hidden="true"
    />
  );
}
