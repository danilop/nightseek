import { Camera, Focus, Star } from 'lucide-react';

interface QuickTourProps {
  onComplete: () => void;
}

const TIPS = [
  {
    icon: Star,
    title: 'Smart Target Ratings',
    description:
      "Tonight's best objects rated by altitude, moon interference, weather, and your telescope's field of view.",
    color: 'bg-amber-500/20 text-amber-400',
  },
  {
    icon: Focus,
    title: 'Star Field Previews',
    description:
      "Tap any deep sky object to see a real star field simulation showing how it fills your telescope's view.",
    color: 'bg-sky-500/20 text-sky-400',
  },
  {
    icon: Camera,
    title: 'Plan Your Session',
    description:
      'Imaging windows, quality scores, and visibility details to help you plan the perfect session.',
    color: 'bg-emerald-500/20 text-emerald-400',
  },
] as const;

export default function QuickTour({ onComplete }: QuickTourProps) {
  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <h2 className="mb-2 font-bold text-2xl text-white">Welcome to NightSeek</h2>
        <p className="text-gray-400">Here's what you can do</p>
      </div>

      <div className="mb-8 space-y-4">
        {TIPS.map(tip => {
          const Icon = tip.icon;
          return (
            <div key={tip.title} className="flex items-start gap-4 rounded-xl bg-night-800 p-4">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${tip.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-white">{tip.title}</h3>
                <p className="mt-1 text-gray-400 text-xs leading-relaxed">{tip.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="w-full rounded-xl bg-sky-600 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-500"
      >
        Get Started
      </button>
    </div>
  );
}
