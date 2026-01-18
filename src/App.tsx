import { Routes, Route } from 'react-router-dom'
import { Store } from '@/component/Store'
import { Admin } from '@/component/Admin'
import { Toaster } from 'sonner'

export function App() {
  return (
    <>
    <Toaster/>
      <Routes>
        <Route path="/" element={<Store />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  )
}