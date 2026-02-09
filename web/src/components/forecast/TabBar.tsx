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

  if (variant === 'bottom') {
    return (
      <nav
        className="border-night-700 border-t bg-night-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
        aria-label="Main navigation"
      >
        <div className="grid grid-cols-4" role="tablist">
          {TABS.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                id={`tab-${key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${key}`}
                onClick={() => setActiveTab(key)}
                className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-sky-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium text-[0.6rem]">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Desktop top tab bar
  return (
    <nav className="border-night-700 border-b" aria-label="Main navigation">
      <div className="flex gap-1" role="tablist">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              id={`tab-${key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${key}`}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-gray-400 hover:border-night-600 hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
