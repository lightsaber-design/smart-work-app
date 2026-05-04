import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 bg-background text-foreground">
          <p className="text-lg font-bold text-destructive">Error en la app</p>
          <p className="text-sm text-muted-foreground text-center break-all">
            {this.state.error.message}
          </p>
          <pre className="text-[10px] text-muted-foreground bg-muted rounded-xl p-3 w-full overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
