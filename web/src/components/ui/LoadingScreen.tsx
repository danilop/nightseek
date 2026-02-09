import NightSeekIcon from '@/components/ui/NightSeekIcon';

interface LoadingScreenProps {
  message: string;
  percent: number;
}

export default function LoadingScreen({ message, percent }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/95"
      role="status"
      aria-label="Loading forecast"
    >
      <div className="px-4 text-center">
        <div className="relative mx-auto mb-6 h-20 w-20">
          <div
            className="absolute inset-0 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"
            style={{ animationDuration: '1.5s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <NightSeekIcon className="h-12 w-12" />
          </div>
        </div>

        <p className="mb-2 text-lg text-white" aria-live="polite">
          {message}
        </p>

        <div className="mx-auto w-64">
          <div
            className="h-2 overflow-hidden rounded-full bg-night-800"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-gray-500 text-sm">{percent}%</p>
        </div>
      </div>
    </div>
  );
}
