import type { ReactNode } from 'react';
import { Component } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="mb-2 font-bold text-white text-xl">Something went wrong</h2>
            <p className="mb-4 text-gray-400 text-sm">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {this.state.error && (
              <p className="mb-4 rounded bg-night-800 p-2 font-mono text-red-400 text-xs">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-sky-500"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
