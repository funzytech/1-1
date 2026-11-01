import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#d9c4a2] text-[#2c1708] font-['Outfit',sans-serif]">
          <div className="max-w-md w-full p-6 rounded-3xl bg-white/80 backdrop-blur-md shadow-2xl border border-white/60 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-xs text-[#593e28] mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading the application.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-2xl bg-[#2c1708] text-white font-bold text-xs shadow-md hover:bg-black transition-all cursor-pointer"
            >
              Reload Website
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
