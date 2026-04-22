"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

/**
 * Tiny React ErrorBoundary so a broken sub-tree (e.g. one bad trail
 * that fails a field assumption the detail page made) doesn't nuke
 * the entire page with Next.js's opaque "Application error" overlay.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    // Surface to the browser console so we can still debug
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 text-center">
          <p className="text-[14px] text-text-secondary">
            이 섹션을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-[12px] text-primary underline"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
