import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly failed: boolean
}

/** Catches render failures; use cases handle asynchronous DiaryError separately. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Diary UI failed', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <main role="alert">页面显示遇到问题。请重新启动应用；日记文件不会因此被修改。</main>
    }
    return this.props.children
  }
}
