/**
 * 维护页：软件被管理员暂停时展示
 */
import { Music2, Wrench } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function Maintenance() {
  const { checkAppStatus } = useStore()

  return (
    <div className="min-h-screen w-screen bg-paper-grain flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="relative inline-flex mb-8">
          <span className="absolute inset-0 rounded-3xl bg-coral/20 animate-pulse-ring" />
          <div className="relative w-20 h-20 rounded-3xl bg-ink flex items-center justify-center">
            <Music2 className="text-coral" size={36} />
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-coral-50 text-coral text-xs font-semibold mb-4">
          <Wrench size={12} /> 维护中
        </div>
        <h1 className="font-display text-4xl font-semibold">音乐制作工具正在升级</h1>
        <p className="mt-4 text-muted leading-relaxed">
          管理员正在进行大更新，很快就会回来。<br />
          你的作品和数据都已安全保存，请稍后再试。
        </p>
        <button
          onClick={() => checkAppStatus()}
          className="mt-8 inline-flex items-center gap-2 px-6 h-11 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-black transition-colors"
        >
          重新检测状态
        </button>
      </div>
    </div>
  )
}
