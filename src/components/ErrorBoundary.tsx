import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

const CHUNK_RELOAD_KEY = "smart-work-chunk-reload-attempted";
const RECOVERABLE_TIMER_KEYS = ["time-entries", "calendar-events"];

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|importing a module script|loading chunk|chunkloaderror/i.test(message);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private readonly handleWindowError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || "Unhandled error");
    if (isChunkLoadError(error)) this.handleChunkRecovery(error);
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    if (isChunkLoadError(error)) this.handleError(error);
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crash:", error, info.componentStack);
    this.handleChunkRecovery(error);
  }

  private handleError(error: Error) {
    console.error("App runtime error:", error);
    this.handleChunkRecovery(error);
    this.setState({ error });
  }

  private handleChunkRecovery(error: Error) {
    if (!isChunkLoadError(error)) return;
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  }

  private resetTimerData = () => {
    // Limpia solo los datos que puede dejar bloqueado el temporizador.
    RECOVERABLE_TIMER_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const message = this.state.error.message || "Unknown error";

      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 bg-background text-foreground">
          <p className="text-lg font-bold text-destructive">Something went wrong</p>
          <p className="text-sm text-muted-foreground text-center break-all">
            Please reload the app and try again.
          </p>
          <details className="w-full max-w-sm rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">Error details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">{message}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Reload
          </button>
          <button
            onClick={this.resetTimerData}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Reset timer data
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
