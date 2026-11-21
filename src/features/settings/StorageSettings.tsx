import { Button } from '@/components/ui/button'
import type { SettingsContentProps } from './settingsTypes'
import { FolderOpen } from 'lucide-react'
export function StorageSettings({ root, choosingRoot, onChooseRoot }: SettingsContentProps) {
  return (
    <>
      <div className="settings-card">
        <div>
          <h3>日记文件夹</h3>
          <p>日记正文与附件都保存在这个文件夹中。</p>
          <code>{root ?? '尚未选择'}</code>
        </div>
        <Button variant="outline" onClick={onChooseRoot} disabled={choosingRoot}>
          <FolderOpen aria-hidden="true" />
          {choosingRoot ? '正在选择…' : '更换文件夹'}
        </Button>
      </div>
    </>
  )
}
