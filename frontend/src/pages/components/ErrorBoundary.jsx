import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Add telemetry data for model loading failures
    if (error.message && (
        error.message.includes('model') || 
        error.message.includes('texture') || 
        error.message.includes('load') || 
        error.message.includes('GLB') ||
        error.message.includes('GLTF') ||
        error.message.includes('OBJ')
      )) {
      console.info("Model Loading Error:", {
        message: error.message,
        component: this.props.componentName || 'Unknown',
        timestamp: new Date().toISOString()
      });
    }
  }
  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center', border: '1px dashed red', borderRadius: '8px', backgroundColor: 'rgba(255,0,0,0.05)', margin: '10px' }}>
          <h2>Something went wrong.</h2>
          <p>{this.state.error && this.state.error.toString()}</p>
          {this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '10px' }}>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          
          {this.state.retryCount < 2 && (
            <button 
              onClick={() => {
                this.setState(prevState => ({
                  hasError: false,
                  retryCount: prevState.retryCount + 1
                }));
                if (this.props.onRetry) {
                  this.props.onRetry();
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Try Again
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;