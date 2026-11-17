import { BookOpenText, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DiaryList() {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">JOURNAL</p>
          <h2>日记</h2>
        </div>
        <Button size="sm" disabled title="新建日记将在下一阶段开放">
          新建
        </Button>
      </div>
      <div className="panel-placeholder">
        <CalendarDays aria-hidden="true" />
        <p>还没有可显示的日期</p>
        <span>选择日记文件夹后，这里会按日期列出条目。</span>
      </div>
    </>
  )
}

export function DiaryDetail() {
  return (
    <>
      <div className="empty-state">
        <div className="empty-state-icon">
          <BookOpenText aria-hidden="true" />
        </div>
        <p className="eyebrow">YOUR SPACE TO WRITE</p>
        <h2>每天，留下一点记录</h2>
        <p>写作与本地文件功能正在准备中。</p>
      </div>
    </>
  )
}
