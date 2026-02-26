import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('ErrorBoundary caught:', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="text-4xl">🌿</div>
            <h2 className="text-lg font-bold text-foreground">Что-то пошло не так</h2>
            <p className="text-sm text-muted-foreground">
              Попробуйте перезагрузить страницу
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-xl font-semibold bg-primary text-primary-foreground"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
