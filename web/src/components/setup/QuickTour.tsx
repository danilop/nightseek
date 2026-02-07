import { Camera, Focus, Star } from 'lucide-react';
import { useState } from 'react';

interface QuickTourProps {
  onComplete: () => void;
}

const TIPS = [
  {
    icon: Star,
    title: 'Smart Target Ratings',
    description:
      "The Targets tab shows tonight's best objects rated by altitude, moon interference, weather, and your telescope's field of view.",
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
      'Each object shows imaging windows, quality scores, and visibility details to help you plan the perfect session.',
    color: 'bg-emerald-500/20 text-emerald-400',
  },
] as const;

export default function QuickTour({ onComplete }: QuickTourProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const tip = TIPS[currentTip];
  const Icon = tip.icon;
  const isLast = currentTip === TIPS.length - 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="flex flex-col items-center text-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${tip.color}`}
        >
          <Icon className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">{tip.title}</h2>
        <p className="text-gray-400 leading-relaxed mb-8">{tip.description}</p>

        <div className="flex items-center gap-2 mb-8">
          {TIPS.map((_, i) => (
            <div
              key={TIPS[i].title}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentTip ? 'bg-sky-500' : 'bg-night-600'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onComplete}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setCurrentTip(prev => prev + 1);
              }
            }}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors font-medium"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
