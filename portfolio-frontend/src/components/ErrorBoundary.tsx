import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Recover from stale dynamic-import chunks after a deploy: the old
    // index.html in memory references a hashed chunk that no longer exists
    // on S3, so CloudFront serves index.html (text/html) and the import
    // fails. Reloading once pulls the fresh index.html and new chunk hashes.
    // Guarded by sessionStorage so we never loop.
    const msg = error?.message || '';
    const isChunkLoadError =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Loading chunk [\d]+ failed/i.test(msg) ||
      /Importing a module script failed/i.test(msg);

    if (isChunkLoadError && typeof window !== 'undefined') {
      const RELOAD_KEY = 'chunk-reload-attempted';
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full">
            <CardHeader>
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                An unexpected error occurred. You can try refreshing the page.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={this.handleReset} variant="outline">
                Try again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
              >
                Refresh page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
