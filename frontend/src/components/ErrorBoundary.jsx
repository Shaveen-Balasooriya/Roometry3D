import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      const fallbackMessage = this.props.fallbackMessage || "Something went wrong rendering this component.";
      return (
        <div style={{ padding: '20px', color: 'var(--error)', background: 'var(--surface-lighter)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <p>⚠️ {fallbackMessage}</p>
          {this.state.error && <p style={{ fontSize: '0.8em', opacity: 0.7 }}>{this.state.error.message}</p>}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
