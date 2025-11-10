import React, { Component, ReactNode } from 'react';
import { ErrorState } from './ExamStates';

interface Props {
  children: ReactNode;
  onError?: () => void;
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
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error details:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          message={`Something went wrong: ${this.state.error?.message || 'Unknown error'}`}
          onBack={() => {
            this.setState({ hasError: false, error: null });
            this.props.onError?.();
          }}
        />
      );
    }

    return this.props.children;
  }
}
