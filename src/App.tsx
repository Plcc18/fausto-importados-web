import { Routes, Route } from 'react-router-dom'
import { Store } from '@/component/Store'
import { Admin } from '@/component/Admin'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Store />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}