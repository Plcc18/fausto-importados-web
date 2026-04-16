import { Routes, Route, Navigate } from 'react-router-dom'
import { Store } from '@/component/Store'
import { Admin } from '@/component/Admin'
import { AdminLogin } from '@/component/AdminLogin'
import { Toaster } from 'sonner'
import { Termos } from "./component/Termos"
import { Privacidade } from "./component/Privacidade"
import { Cookies } from "./component/Cookies"

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token")
  if (!token) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

export function App() {

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Store />} />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/cookies" element={<Cookies />} />
      </Routes>
    </>
  )
}