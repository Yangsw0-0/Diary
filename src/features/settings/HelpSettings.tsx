import { Button } from '@/components/ui/button'
import type { SettingsContentProps } from './settingsTypes'
import { BookOpenText } from 'lucide-react'
export function HelpSettings({ onOpenHelp }: SettingsContentProps) {
  return (
    <>
      <div className="settings-card">
        <div>
          <h3>帮助</h3>
          <p>查看日记、标签、节点、词云、触控板操作与备份说明。</p>
        </div>
        <Button variant="outline" onClick={() => onOpenHelp()}>
          <BookOpenText aria-hidden="true" />
          打开使用说明
        </Button>
      </div>
    </>
  )
}
