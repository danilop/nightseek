interface NightSeekIconProps {
  className?: string;
}

export default function NightSeekIcon({ className }: NightSeekIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ns-sky" cx="35%" cy="25%" r="65%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#070614" />
        </radialGradient>
        <linearGradient id="ns-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="ns-tube" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="ns-moon" x1="20%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#f0f4ff" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
        <radialGradient id="ns-glow">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Lens ring */}
      <circle cx={50} cy={50} r={49} fill="url(#ns-ring)" />
      <circle cx={50} cy={50} r={45.5} fill="url(#ns-sky)" />
      <circle
        cx={50}
        cy={50}
        r={45.5}
        fill="none"
        stroke="#4338ca"
        strokeWidth={0.5}
        opacity={0.5}
      />

      {/* Crescent moon */}
      <circle cx={28} cy={24} r={9} fill="url(#ns-moon)" />
      <circle cx={33} cy={21} r={8} fill="url(#ns-sky)" />

      {/* Feature star */}
      <circle cx={70} cy={20} r={7} fill="url(#ns-glow)" />
      <line x1={70} y1={11} x2={70} y2={29} stroke="#fbbf24" strokeWidth={0.6} opacity={0.4} />
      <line x1={61} y1={20} x2={79} y2={20} stroke="#fbbf24" strokeWidth={0.6} opacity={0.4} />
      <circle cx={70} cy={20} r={2.5} fill="#fbbf24" />
      <circle cx={70} cy={20} r={1.2} fill="#fffbeb" />

      {/* Small stars */}
      <circle cx={45} cy={15} r={1} fill="#c7d2fe" />
      <circle cx={80} cy={38} r={0.9} fill="#a5b4fc" />
      <circle cx={18} cy={42} r={0.8} fill="#818cf8" />
      <circle cx={38} cy={32} r={0.7} fill="#818cf8" />
      <circle cx={58} cy={38} r={0.7} fill="#6366f1" />

      {/* Telescope */}
      <g transform="translate(44, 54) rotate(-35)">
        <rect x={-22} y={-4.5} width={38} height={9} rx={2} fill="url(#ns-tube)" opacity={0.9} />
        <rect x={14} y={-6} width={5} height={12} rx={1.5} fill="#38bdf8" opacity={0.85} />
        <rect x={18} y={-5} width={1.5} height={10} rx={0.5} fill="#0ea5e9" opacity={0.5} />
        <rect x={-26} y={-3} width={5} height={6} rx={1} fill="#4338ca" />
        <rect x={-6} y={-5.5} width={3} height={11} rx={1} fill="#4f46e5" opacity={0.6} />
      </g>

      {/* Tripod */}
      <line
        x1={44}
        y1={54}
        x2={28}
        y2={78}
        stroke="#4338ca"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={44}
        y1={54}
        x2={60}
        y2={78}
        stroke="#4338ca"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={44}
        y1={54}
        x2={44}
        y2={80}
        stroke="#4338ca"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={44} cy={54} r={3} fill="#4338ca" />

      {/* Tiny stars */}
      <circle cx={72} cy={60} r={0.8} fill="#818cf8" />
      <circle cx={22} cy={65} r={0.7} fill="#4f46e5" />
      <circle cx={65} cy={75} r={0.6} fill="#4f46e5" />
    </svg>
  );
}
