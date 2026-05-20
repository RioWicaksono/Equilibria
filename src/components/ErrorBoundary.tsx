import React, { useState, useEffect, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export function ErrorBoundary({ children, fallback, onError, componentName }: Props) {
  const [state, setState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorInfo: null,
  });

  useEffect(() => {
    // This is a controlled error boundary
  }, []);

  const handleReload = () => {
    setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  const handleGoHome = () => {
    setState({ hasError: false, error: null, errorInfo: null });
  };

  if (state.hasError) {
    if (fallback) return fallback;

    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-stone-900 shadow-[8px_8px_0_0_rgba(28,25,23,1)] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 border border-amber-200 flex items-center justify-center rounded-sm">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-stone-900">
                {componentName || 'Component'} Error
              </h2>
              <p className="text-xs text-stone-500 font-mono">Something went wrong</p>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 p-4 mb-6">
            <p className="text-xs font-mono text-stone-600 mb-2">
              {state.error?.message || 'An unexpected error occurred.'}
            </p>
            {import.meta.env.DEV && state.errorInfo && (
              <details className="mt-3">
                <summary className="text-[10px] font-bold uppercase tracking-widest text-stone-400 cursor-pointer">
                  Technical Details
                </summary>
                <pre className="mt-2 text-[10px] text-red-500 font-mono overflow-x-auto whitespace-pre-wrap">
                  {state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 transition-colors border border-stone-900 rounded-none text-xs font-bold uppercase tracking-widest font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </button>
            <Link
              to="/"
              onClick={handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-stone-900 hover:bg-stone-50 transition-colors border border-stone-300 rounded-none text-xs font-bold uppercase tracking-widest font-mono"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * Simple functional wrapper for error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    componentName?: string;
  }
) {
  return function WrappedWithErrorBoundary(props: P) {
    return (
      <ErrorBoundary
        componentName={options?.componentName || Component.name}
        onError={options?.onError}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Page-level error boundary (for entire route errors)
 */
export function PageErrorFallback() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border-2 border-stone-900 shadow-[8px_8px_0_0_rgba(28,25,23,1)] p-8 text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-200 flex items-center justify-center rounded-sm mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="font-mono font-bold text-lg uppercase tracking-widest text-stone-900 mb-2">
          Page Crashed
        </h1>
        <p className="text-sm text-stone-500 font-mono mb-6">
          This page encountered an error and couldn't load properly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-stone-50 hover:bg-stone-800 transition-colors border border-stone-900 rounded-none text-xs font-bold uppercase tracking-widest font-mono"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-stone-900 hover:bg-stone-50 transition-colors border border-stone-300 rounded-none text-xs font-bold uppercase tracking-widest font-mono"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}