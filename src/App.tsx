import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Shell from '@/components/Shell'
import Onboarding from '@/components/Onboarding'
import Editor from '@/pages/Editor'
import Plaza from '@/pages/Plaza'
import Profile from '@/pages/Profile'
import Maintenance from '@/pages/Maintenance'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import { useStore } from '@/store/useStore'
import { getAdminToken } from '@/lib'

function AppRoutes() {
  const { appActive, appChecked, checkAppStatus, initOnboarding, loadUser, loadPlaza } = useStore()
  const loc = useLocation()
  const isAdmin = loc.pathname.startsWith('/admin')
  const [adminAuthed, setAdminAuthed] = useState<boolean>(() => !!getAdminToken())

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
        <Route path="/admin" element={<AdminDashboard onLogout={() => setAdminAuthed(false)} />} />
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
