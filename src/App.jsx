// src/App.jsx - Carnet Portal
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CarnetPage from './pages/CarnetPage'
import NotFound from './pages/NotFound'
import './index.css'

export default function App() {
  return (
   <BrowserRouter basename="/SecMontesCarnet">
      <Routes>
        <Route path="/" element={<Navigate to="/HX-IBIME-001" />} />
        <Route path="/:qrId" element={<CarnetPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
