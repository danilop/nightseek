import { Eye, EyeOff } from 'lucide-react';

interface MilkyWayToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export default function MilkyWayToggle({ visible, onToggle }: MilkyWayToggleProps) {
  const Icon = visible ? EyeOff : Eye;
  const action = visible ? 'Hide' : 'Show';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      title={`${action} the Milky Way band on the sky chart`}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium text-xs transition-colors ${
        visible
          ? 'border-amber-300/40 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25'
          : 'border-night-700 bg-night-800 text-gray-300 hover:border-gray-500 hover:text-white'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {action} Milky Way
    </button>
  );
}
