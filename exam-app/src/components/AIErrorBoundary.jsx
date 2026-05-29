import { Component } from 'react'

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
        <div className="flex items-center justify-center py-8 font-jakarta text-sm text-[#475569]">
          Phân tích AI không khả dụng
        </div>
      )
    }
    return this.props.children
  }
}
