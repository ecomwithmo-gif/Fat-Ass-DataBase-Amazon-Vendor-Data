import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-8 m-4 border border-red-500 rounded-lg bg-red-50 text-red-900 font-mono text-sm overflow-auto">
          <h2 className="text-xl font-bold mb-4">Something went wrong.</h2>
          <div className="mb-4">
            <h3 className="font-semibold">Error:</h3>
            <p>{this.state.error && this.state.error.toString()}</p>
          </div>
          <div>
            <h3 className="font-semibold">Component Stack:</h3>
            <pre className="whitespace-pre-wrap bg-white p-4 border rounded mt-2 text-xs">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
