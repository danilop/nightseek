import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
      <h3 className="mb-2 font-semibold text-lg text-white">Something went wrong</h3>
      <p className="mb-4 text-gray-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/30"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
