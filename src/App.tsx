import { useEffect, useRef, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Shell from '@/components/Shell'
import Onboarding from '@/components/Onboarding'
import Editor from '@/pages/Editor'
import Plaza from '@/pages/Plaza'
import Profile from '@/pages/Profile'
import Maintenance from '@/pages/Maintenance'
import DownloadPage from '@/pages/DownloadPage'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import { useStore } from '@/store/useStore'
import { clearAdminAuth, setAdminToken } from '@/lib'

function AppRoutes() {
  const { appActive, appChecked, checkAppStatus, initOnboarding, loadUser, loadPlaza } = useStore()
  const loc = useLocation()
  const isAdmin = loc.pathname.startsWith('/admin')

  // ========================================================================
  // 用户语义（严格按此执行）：
  //   ✅ 同一次打开后台页面：正常使用（不反复要求登录）
  //   ✅ 一旦关闭后台页面（关标签页 / 关浏览器）→ 再重新打开 → 必须重新登录
  //
  // 实现手段：
  //   1) 管理员 token 完全不落盘（只存内存变量 MEMORY_ADMIN_TOKEN）
  //      → 关页面/浏览器后内存被销毁，重开 token 必然为 null → 必须登录
  //   2) 打开后台时，先扫一次浏览器里旧版本遗留的 storage key，彻底清干净
  //      （防止缓存旧 localStorage 里的 token 绕过登录）
  //   3) adminAuthed 永远默认 false，只在用户输完密码后被设 true
  //      刷新/重开页面 → useState 重新初始化 false → 回到登录页
  //   4) 关闭页面前再清一次，确保关页时内存态也被清
  // ========================================================================

  // 2) 打开后台页面时，同步扫一次并清除历史遗留 storage（旧版本可能存在 localStorage 里的永久 token）
  // 只在每次「页面真正加载后」执行 1 次，避免同一次打开后台内的路由/渲染再清
  const legacyClearedRef = useRef(false)
  if (isAdmin && !legacyClearedRef.current) {
    legacyClearedRef.current = true
    try { clearAdminAuth() } catch { /* ignore */ }
  }

  // 3) 登录状态：永远默认未登录，仅在用户输完密码 -> onDone() 时才会被置 true
  //    页面刷新/重开 → React 重挂载 → useState 默认 false → 显示登录框（符合「关了再开必重登」）
  const [adminAuthed, setAdminAuthed] = useState<boolean>(false)

  // 4) 关页面前清一遍（双保险：关标签页/刷新/关浏览器 都触发）
  useEffect(() => {
    if (!isAdmin) return
    const onClose = () => {
      clearAdminAuth()
      setAdminAuthed(false)
    }
    window.addEventListener('beforeunload', onClose)
    return () => window.removeEventListener('beforeunload', onClose)
  }, [isAdmin])

  useEffect(() => {
    checkAppStatus()
    initOnboarding()
    loadUser()
    loadPlaza()
  }, [checkAppStatus, initOnboarding, loadUser, loadPlaza])

  // 管理后台路由（独立于前台，不套 Shell）
  if (isAdmin) {
    if (!adminAuthed) {
      return (
        <Routes>
          <Route path="/admin" element={<AdminLogin onDone={() => setAdminAuthed(true)} />} />
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        </Routes>
      )
    }
    return (
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminDashboard
              onLogout={() => {
                setAdminToken(null)
                clearAdminAuth()
                setAdminAuthed(false)
              }}
            />
          }
        />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      </Routes>
    )
  }

  if (!appChecked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-coral/20 border-t-coral animate-spin" />
          <div className="text-muted text-sm">正在唤醒音乐制作工具…</div>
        </div>
      </div>
    )
  }

  // 暂停状态：普通用户只能看维护页
  if (!appActive) {
    return (
      <Routes>
        <Route path="*" element={<Maintenance />} />
      </Routes>
    )
  }

  return (
    <>
      <Onboarding />
      <Shell>
        <Routes>
          <Route path="/" element={<Editor />} />
          <Route path="/plaza" element={<Plaza />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </>
  )
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}
