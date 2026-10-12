/** Verlauf und Halo für den gelben Planeten. Einmal pro SVG einbinden. */
export function PlanetDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-planet`} cx="38%" cy="32%" r="75%">
        <stop offset="0%" stopColor="#FFE08A" />
        <stop offset="55%" stopColor="#F6BB12" />
        <stop offset="100%" stopColor="#C98F00" />
      </radialGradient>
      <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F6BB12" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#F6BB12" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
