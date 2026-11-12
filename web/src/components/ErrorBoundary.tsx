import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When this changes after an error, the boundary clears and retries rendering. */
  resetKey?: string | undefined;
}

interface State {
  hasError: boolean;
}

// Class component: React 18 has no hook for error boundaries (the one exception to "functional only").
export default class ErrorBoundary extends Component<Props, State> {
  override state: State ={ hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "60vh",
          padding: 24,
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "var(--text-2xl)",
            lineHeight: 1.1,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          This page broke
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "46ch", margin: 0 }}>
          Something went wrong while showing it. Reload to try again.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 12 }}>
          <button type="button" className="btn-key" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn-key btn-key--wall" href="/">
            Go home
          </a>
        </div>
      </div>
    );
  }
}
