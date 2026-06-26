import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import CarnetPage from './pages/CarnetPage'
import NotFound from './pages/NotFound'
import './index.css'

function RedirectHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    const redirect = sessionStorage.getItem('redirect')
    if (redirect) {
      sessionStorage.removeItem('redirect')
      navigate(redirect, { replace: true })
    }
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename="/SecMontesCarnet">
      <RedirectHandler />
      <Routes>
        <Route path="/" element={<Navigate to="/HX-IBIME-001" />} />
        <Route path="/:qrId" element={<CarnetPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
