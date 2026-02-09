import { Coffee, Heart } from 'lucide-react';
import { version as APP_VERSION } from '../../../package.json';

interface AppFooterProps {
  className?: string;
}

export default function AppFooter({ className = '' }: AppFooterProps) {
  return (
    <div className={`flex items-center justify-center gap-1.5 text-gray-500 text-xs ${className}`}>
      <span>v{APP_VERSION}</span>
      <span>·</span>
      <a
        href="https://buymeacoffee.com/danilop"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded p-1 transition-colors hover:text-amber-400"
      >
        Built with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> by Danilo Poccia
        <Coffee className="ml-0.5 h-3.5 w-3.5" />
      </a>
    </div>
  );
}
