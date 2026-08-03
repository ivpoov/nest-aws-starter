import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface ErrorBoundaryPropsInterface {
  readonly children: ReactNode;
}

interface ErrorBoundaryStateInterface {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryPropsInterface,
  ErrorBoundaryStateInterface
> {
  public override state: ErrorBoundaryStateInterface = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryStateInterface {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled render error', error, info.componentStack);
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false });
  };

  public override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">Something went wrong.</p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-content"
        >
          Reload view
        </button>
      </div>
    );
  }
}
