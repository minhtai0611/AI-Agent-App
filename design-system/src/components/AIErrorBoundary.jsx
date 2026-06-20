import { Component } from 'react'

/**
 * Error boundary for AI-powered sections.
 * Renders a subtle fallback message instead of crashing the page.
 *
 * @example
 * <AIErrorBoundary>
 *   <AIInsights result={result} />
 * </AIErrorBoundary>
 */
export default class AIErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[AIErrorBoundary] caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-8 font-sans text-sm text-faint">
          Phân tích AI không khả dụng
        </div>
      )
    }
    return this.props.children
  }
}
