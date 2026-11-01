/** Angular distance ruler; positions are schematic, not a sky orientation. */
export default function AngularSeparationDiagram({
  degrees,
  first,
  second,
}: {
  degrees: number;
  first: string;
  second: string;
}) {
  if (!Number.isFinite(degrees) || degrees < 0) return null;
  const extent = Math.max(10, Math.ceil(degrees / 5) * 5);
  const end = 20 + (degrees / extent) * 260;
  return (
    <svg
      viewBox="0 0 300 80"
      role="img"
      aria-label={`${first} and ${second}: ${degrees.toFixed(1)}° angular separation. Schematic.`}
      className="w-full max-w-sm"
    >
      <title>
        {first} – {second}: {degrees.toFixed(1)}°
      </title>
      <line x1="20" y1="32" x2="280" y2="32" stroke="#475569" />
      <line x1="20" y1="32" x2={end} y2="32" stroke="#c4b5fd" strokeWidth="3" />
      <circle cx="20" cy="32" r="5" fill="#38bdf8" />
      <circle cx={end} cy="32" r="5" fill="#c4b5fd" />
      <text x="20" y="62" fill="#cbd5e1" fontSize="12">
        0°
      </text>
      <text x="280" y="62" textAnchor="end" fill="#cbd5e1" fontSize="12">
        {extent}°
      </text>
      <text x="150" y="16" textAnchor="middle" fill="#e2e8f0" fontSize="12">
        {degrees.toFixed(1)}° separation
      </text>
    </svg>
  );
}
