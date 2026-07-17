interface SkyLayerToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

/** Consistent pressed-state chip for every optional layer in the Sky chart. */
export default function SkyLayerToggle({ label, active, onToggle }: SkyLayerToggleProps) {
  const action = active ? 'Hide' : 'Show';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={`${action} ${label} on the sky chart`}
      className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-colors ${
        active
          ? 'border-white/30 bg-white/10 text-white hover:bg-white/15'
          : 'border-night-700 bg-night-800 text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
