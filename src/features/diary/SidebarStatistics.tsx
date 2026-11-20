import type { DiaryStatisticsSnapshot } from '@/application/DiaryStatistics'

const number = new Intl.NumberFormat('zh-CN')

interface Props {
  readonly statistics: DiaryStatisticsSnapshot
  readonly loading: boolean
  readonly unavailable: boolean
  readonly failedFiles: number
}

export function SidebarStatistics({ statistics, loading, unavailable, failedFiles }: Props) {
  return (
    <section className="sidebar-statistics" aria-label="写作统计">
      {loading ? (
        <span className="sidebar-statistics-loading">正在统计日记…</span>
      ) : unavailable ? (
        <span className="sidebar-statistics-loading">暂时无法统计日记</span>
      ) : (
        <>
          <span className="sidebar-statistics-label">您已经记录了</span>
          <strong className="sidebar-statistics-days">
            {number.format(statistics.days)} <small>天</small>
          </strong>
          <span className="sidebar-statistics-characters">
            写下 <b>{number.format(statistics.characters)}</b> 字
          </span>
          {failedFiles + statistics.skipped > 0 && (
            <span className="sidebar-statistics-warning">
              {number.format(failedFiles + statistics.skipped)} 个文件未完整计入
            </span>
          )}
        </>
      )}
    </section>
  )
}
