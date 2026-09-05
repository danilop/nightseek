import { Calendar, Globe, Sun, Telescope } from 'lucide-react';
import { useUIState } from '@/hooks/useUIState';

const TABS = [
  { key: 'overview' as const, label: 'Overview', Icon: Sun },
  { key: 'targets' as const, label: 'Targets', Icon: Telescope },
  { key: 'sky' as const, label: 'Sky', Icon: Globe },
  { key: 'events' as const, label: 'Events', Icon: Calendar },
];

interface TabBarProps {
  variant: 'top' | 'bottom';
}

export default function TabBar({ variant }: TabBarProps) {
  const { activeTab, setActiveTab } = useUIState();
  const bottom = variant === 'bottom';
  const navigate = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index + TABS.length - 1) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = TABS[nextIndex].key;
    setActiveTab(next);
    document.getElementById(`tab-${variant}-${next}`)?.focus();
  };
  return (
    <nav
      className={
        bottom
          ? 'border-night-700 border-t bg-night-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm'
          : 'border-night-700 border-b'
      }
      aria-label="Main navigation"
    >
      <div className={bottom ? 'grid grid-cols-4' : 'flex gap-1'} role="tablist">
        {TABS.map(({ key, label, Icon }, index) => {
          const isActive = activeTab === key;
          const layout = bottom
            ? 'min-h-14 flex-col justify-center gap-1 py-2'
            : 'gap-2 border-b-2 px-4 py-2.5';
          const color = isActive
            ? 'border-sky-500 text-sky-400'
            : 'border-transparent text-gray-400 hover:text-gray-200';
          return (
            <button
              key={key}
              id={`tab-${variant}-${key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${key}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={event => navigate(event, index)}
              onClick={() => setActiveTab(key)}
              className={`flex items-center font-medium text-sm transition-colors ${layout} ${color}`}
            >
              <Icon className={bottom ? 'h-5 w-5' : 'h-4 w-4'} />
              <span className={bottom ? 'text-xs' : ''}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
