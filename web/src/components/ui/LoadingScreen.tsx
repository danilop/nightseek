import { Telescope } from 'lucide-react';

interface LoadingScreenProps {
  message: string;
  percent: number;
}

export default function LoadingScreen({ message, percent }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-40 bg-night-950/95 flex items-center justify-center">
      <div className="text-center px-4">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full" />
          <div
            className="absolute inset-0 border-4 border-sky-500 rounded-full border-t-transparent animate-spin"
            style={{ animationDuration: '1.5s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Telescope className="w-8 h-8 text-sky-400" />
          </div>
        </div>

        <p className="text-lg text-white mb-2">{message}</p>

        <div className="w-64 mx-auto">
          <div className="h-2 bg-night-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">{percent}%</p>
        </div>
      </div>
    </div>
  );
}
