import { Button } from '@/components/ui/button'
import type { SettingsContentProps } from './settingsTypes'
import { BookOpenText } from 'lucide-react'
export function HelpSettings({ onOpenHelp }: SettingsContentProps) {
  return (
    <>
      <div className="settings-card">
        <div>
          <h3>帮助</h3>
          <p>查看写作、标签、附件、备份和更新等使用说明。</p>
        </div>
        <Button variant="outline" onClick={() => onOpenHelp()}>
          <BookOpenText aria-hidden="true" />
          打开使用说明
        </Button>
      </div>
    </>
  )
}
