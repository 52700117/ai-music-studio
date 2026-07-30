/**
 * 代码编辑弹窗：查看 / 保存源文件
 */
import { useEffect, useState } from 'react'
import { X, Save, FileCode } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { api } from '@/lib'

export default function CodeEditorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<{ path: string; name: string }[]>([])
  const [curPath, setCurPath] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      api.adminCodeFiles().then((r) => setFiles(r.files)).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (curPath) {
      api.adminCodeRead(curPath).then((r) => setContent(r.content)).catch(() => {})
    }
  }, [curPath])

  const save = async () => {
    if (!curPath) return
    setSaving(true)
    try {
      await api.adminCodeSave(curPath, content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      alert(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="flex flex-col h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-coral" />
            <h3 className="font-semibold">代码编辑器</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* 文件列表 */}
          <div className="w-56 border-r border-line overflow-y-auto bg-cream/30">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => setCurPath(f.path)}
                className={`w-full text-left px-3 py-2 text-xs font-mono truncate hover:bg-cream ${
                  curPath === f.path ? 'bg-coral-50 text-coral font-medium' : 'text-muted'
                }`}
              >
                {f.path}
              </button>
            ))}
          </div>
          {/* 编辑区 */}
          <div className="flex-1 flex flex-col">
            {curPath ? (
              <>
                <div className="px-3 py-2 border-b border-line text-xs text-muted font-mono">{curPath}</div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 p-3 font-mono text-xs resize-none focus:outline-none bg-paper"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-line">
                  {saved ? <span className="text-sm text-forest">已保存</span> : <span className="text-xs text-muted">修改后点击保存</span>}
                  <Button size="sm" onClick={save} loading={saving}>
                    <Save size={13} /> 保存
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted text-sm">从左侧选择一个文件</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
