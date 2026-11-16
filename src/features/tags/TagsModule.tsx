import { Tags } from 'lucide-react'

export function TagsModule() {
  return (
    <>
      <section className="module-list" aria-label="标签列表">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TOPICS</p>
            <h2>标签</h2>
          </div>
        </div>
        <div className="panel-placeholder">
          <Tags aria-hidden="true" />
          <p>还没有可显示的主题</p>
          <span>日记中的二级标题会汇集在这里。</span>
        </div>
      </section>
      <section className="module-content" aria-label="标签内容">
        <div className="empty-state">
          <div className="empty-state-icon"><Tags aria-hidden="true" /></div>
          <p className="eyebrow">FOLLOW YOUR THEMES</p>
          <h2>把同一个主题，放在一起看</h2>
          <p>标签聚合功能正在准备中。</p>
        </div>
      </section>
    </>
  )
}
