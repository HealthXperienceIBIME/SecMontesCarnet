// src/pages/CarnetPage.jsx
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

const GEMINI_KEY = 'AQ.Ab8RN6LH-pjj99MuXxy5gY6Diu0WCdvr_S7gnJ96KscDrYbypw'

async function gemini(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1024 } })
  })
  const d = await res.json()
  return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function IMC_COLOR(v) {
  if (!v) return '#8ba3be'
  if (v < 18.5) return '#3b82f6'
  if (v <= 24.9) return '#00d4a0'
  if (v <= 29.9) return '#f59e0b'
  return '#ef4444'
}

// ── TAB: Resultados ──────────────────────────────────────────────────────────

function TabResultados({ p }) {
  const pr = p.pruebas || {}
  return (
    <div className="fade">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 12 }}>Marcas Deportivas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            ['Salto Cuerda', pr.saltoCuerda ?? '—', 'reps / 15s'],
            ['Lanzamiento', pr.lanzamiento ?? '—', 'metros'],
            ['Carrera 45m', pr.carrera ?? '—', 'segundos'],
          ].map(([l, v, u]) => (
            <div key={l} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 8 }}>{l}</div>
              <div className="stat" style={{ fontSize: 22, color: 'var(--gold)' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{u}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 12 }}>Análisis Físico</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            ['Velocidad', pr.velocidad ?? '—', 'm/s', 'v = 45m/tiempo', 'var(--teal)'],
            ['Aceleración', pr.aceleracion ?? '—', 'm/s²', 'a = v / t', 'var(--purple)'],
            ['Fuerza', pr.fuerza ?? '—', 'N', 'F = masa × a', 'var(--gold)'],
          ].map(([l, v, u, f, color]) => (
            <div key={l} className="card" style={{ borderColor: color + '40', background: color + '08' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{l === 'Velocidad' ? '⇒' : l === 'Aceleración' ? '⚡' : '💪'}</div>
              <div className="stat" style={{ fontSize: 22, color }}>{v}</div>
              <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{l}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{u}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{f}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TAB: Recomendaciones ─────────────────────────────────────────────────────

function TabRecomendaciones({ p }) {
  const text = p.recomendaciones || ''

  const renderMD = (t) => t.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      const icon = line.includes('JARRA') ? '💧' : line.includes('PLATO') ? '🥗' : line.includes('DIETA') ? '📅' : '✨'
      const colors = { '💧': 'var(--blue)', '🥗': 'var(--teal)', '📅': 'var(--purple)', '✨': 'var(--gold)' }
      return <h3 key={i} style={{ color: colors[icon], fontFamily:'Space Grotesk', fontSize:13, fontWeight:700, marginTop:20, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>{icon} {line.replace('## ','')}</h3>
    }
    const parts = line.split(/\*\*(.*?)\*\*/g)
    if (!line.trim()) return <div key={i} style={{ height: 5 }} />
    return <p key={i} style={{ marginBottom:5, color:'var(--text2)', lineHeight:1.7, fontSize:13 }}>
      {parts.map((pp,j) => j%2===1 ? <strong key={j} style={{color:'var(--text)'}}>{pp}</strong> : pp)}
    </p>
  })

  if (!text) return <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Las recomendaciones aún no han sido generadas en la estación IA.</div>

  return <div className="fade" style={{ lineHeight:1.8 }}>{renderMD(text)}</div>
}

// ── TAB: Asesor IA ────────────────────────────────────────────────────────────

function TabAsesorIA({ p }) {
  const [msgs, setMsgs] = useState([
    { role: 'ai', text: `¡Hola ${p.nombre}! 👋 Soy tu asesor de salud con IA. Conozco tus datos físicos y puedo darte recomendaciones personalizadas basadas en el Plato del Buen Comer, la Jarra del Buen Beber y consejos de entrenamiento. ¿En qué puedo ayudarte?` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    const context = `Eres un asesor de salud y nutrición amigable para adolescentes. El participante se llama ${p.nombre}, tiene ${p.edad} años, sexo ${p.sexo}, peso ${p.peso}kg, altura ${p.altura}m, IMC ${p.imc ?? 'N/A'}. Pruebas: salto ${p.pruebas?.saltoCuerda ?? 0} reps, lanzamiento ${p.pruebas?.lanzamiento ?? 0}m, carrera ${p.pruebas?.carrera ?? 0}s. Responde en español, de forma amigable, breve y motivadora. Pregunta del usuario: ${q}`
    const ans = await gemini(context)
    setMsgs(prev => [...prev, { role: 'ai', text: ans }])
    setLoading(false)
  }

  return (
    <div className="fade" style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
      <div style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 13, marginBottom: 2 }}>💬 Asesor IA de Salud</div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>Basado en Plato del Buen Comer y Jarra del Buen Beber</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'ai' && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--teal-dim)', border: '1px solid var(--teal)', display:'flex',alignItems:'center',justifyContent:'center', marginRight: 8, flexShrink: 0, fontSize: 14 }}>💚</div>}
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role === 'user' ? 'var(--teal-dim)' : 'var(--bg-secondary)',
              border: `1px solid ${m.role === 'user' ? 'var(--teal)' : 'var(--border)'}`,
              fontSize: 13, lineHeight: 1.6, color: 'var(--text)'
            }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ display:'flex',gap:8,alignItems:'center' }}><div style={{ width:28,height:28,borderRadius:'50%',background:'var(--teal-dim)',border:'1px solid var(--teal)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>💚</div><span className="spin" /></div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Pregunta sobre tu salud..." />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ width: 44, height: 40, borderRadius: 8, background: 'var(--teal)', color: '#080d14', flexShrink: 0, fontSize: 18, display:'flex',alignItems:'center',justifyContent:'center' }}>
          ➤
        </button>
      </div>
    </div>
  )
}

// ── TAB: Simular ─────────────────────────────────────────────────────────────

function TabSimular({ p }) {
  const [peso, setPeso] = useState(p.peso || 60)
  const [altura, setAltura] = useState(p.altura || 1.6)
  const [deltaPeso, setDeltaPeso] = useState(0)
  const [deltaT, setDeltaT] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState('')

  const newIMC = peso / (altura * altura)
  const imcOk = newIMC >= 18.5 && newIMC <= 24.9
  const imcColor = newIMC < 18.5 ? 'var(--blue)' : newIMC <= 24.9 ? 'var(--teal)' : newIMC <= 29.9 ? 'var(--gold)' : 'var(--danger)'
  const imcLabel = newIMC < 18.5 ? 'Bajo peso' : newIMC <= 24.9 ? 'Normal' : newIMC <= 29.9 ? 'Sobrepeso' : 'Obesidad'

  const simCarrera = Math.max(0.1, (p.pruebas?.carrera || 10) + deltaT)
  const simPeso = (p.peso || 60) + deltaPeso
  const simV = 45 / simCarrera
  const simA = simV / simCarrera
  const simF = simPeso * simA

  const handleAnalyze = async () => {
    setAnalyzing(true)
    const ans = await gemini(`El usuario ${p.nombre} simula cambiar su peso de ${p.peso}kg a ${simPeso}kg y su tiempo de 45m de ${p.pruebas?.carrera ?? '—'}s a ${simCarrera}s. Nuevo IMC: ${newIMC.toFixed(2)}. Nueva velocidad: ${simV.toFixed(2)}m/s, aceleración: ${simA.toFixed(2)}m/s², fuerza: ${simF.toFixed(2)}N. Analiza brevemente si estos cambios son saludables y cómo mejorar en 2-3 oraciones.`)
    setAnalysis(ans)
    setAnalyzing(false)
  }

  const Slider = ({ label, value, min, max, step, onChange, current }) => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
        <span style={{ color:'var(--text2)' }}>{label}</span>
        <span className="stat" style={{ color:'var(--teal)', fontSize:13 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}
        style={{ width:'100%', padding:0, height:6, background:`linear-gradient(to right,var(--teal) 0%,var(--teal) ${(value-min)/(max-min)*100}%,var(--border) ${(value-min)/(max-min)*100}%,var(--border) 100%)`, borderRadius:3, appearance:'none', cursor:'pointer' }} />
      {current !== undefined && <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>Actual: {current}</div>}
    </div>
  )

  return (
    <div className="fade">
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight:700, color:'var(--teal)', marginBottom:14, fontSize:13 }}>⚖️ SIMULAR PESO Y ALTURA</div>
        <p style={{ color:'var(--text2)', fontSize:12, marginBottom:16 }}>Ajusta tu peso y altura para calcular un nuevo IMC.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
          <Slider label="Peso" value={peso} min={30} max={150} step={0.5} onChange={setPeso} current={`${p.peso} kg`} />
          <Slider label="Altura" value={altura} min={1.0} max={2.2} step={0.01} onChange={setAltura} current={`${p.altura} m`} />
        </div>
        <div style={{ padding:16, background: imcOk ? 'var(--teal-dim)' : 'var(--gold-dim)', border:`1px solid ${imcColor}`, borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="stat" style={{ fontSize:28, color:imcColor }}>{newIMC.toFixed(2)}</div>
            <div style={{ color:imcColor, fontWeight:600, fontSize:13 }}>{imcLabel}</div>
          </div>
          {imcOk && <span style={{ color:'var(--teal)', fontSize:13, fontWeight:600 }}>✓ Saludable</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight:700, color:'var(--purple)', marginBottom:14, fontSize:13 }}>✨ SIMULAR RENDIMIENTO</div>
        <p style={{ color:'var(--text2)', fontSize:12, marginBottom:16 }}>Ajusta los parámetros para ver cómo cambiarían tus métricas.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <Slider label="Cambio de peso" value={deltaPeso} min={-20} max={20} step={0.5} onChange={setDeltaPeso} />
          <Slider label="Cambio de tiempo" value={deltaT} min={-10} max={10} step={0.1} onChange={setDeltaT} />
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Métrica','Actual','→','Simulado'].map(h => <th key={h} style={{ padding:'8px 0', textAlign: h==='Simulado'?'right':'left', color:'var(--text2)', fontWeight:600, fontSize:11 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ['Velocidad', `${p.pruebas?.velocidad ?? '—'}`, `${simV.toFixed(2)} m/s`],
              ['Aceleración', `${p.pruebas?.aceleracion ?? '—'}`, `${simA.toFixed(2)} m/s²`],
              ['Fuerza', `${p.pruebas?.fuerza ?? '—'}`, `${simF.toFixed(2)} N`],
              ['IMC', `${p.imc?.toFixed(2) ?? '—'}`, newIMC.toFixed(2)],
            ].map(([m,a,s]) => (
              <tr key={m} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 0', color:'var(--text2)' }}>{m}</td>
                <td style={{ padding:'10px 0', fontWeight:600 }}>{a}</td>
                <td style={{ padding:'10px 0', color:'var(--text3)' }}>—</td>
                <td style={{ padding:'10px 0', textAlign:'right', fontWeight:700, color:'var(--teal)' }}>{s}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={handleAnalyze} disabled={analyzing}
        style={{ width:'100%', padding:14, background:'linear-gradient(90deg,#00d4a0,#8b5cf6)', color:'#fff', borderRadius:10, fontSize:14, display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}>
        {analyzing ? <><span className="spin" style={{width:16,height:16}} /> Analizando...</> : '✨ Analizar cambios con IA'}
      </button>
      {analysis && <div className="card" style={{ marginTop:14, borderColor:'var(--teal)', fontSize:13, color:'var(--text2)', lineHeight:1.7 }}>{analysis}</div>}
    </div>
  )
}

// ── Main Carnet Page ──────────────────────────────────────────────────────────

export default function CarnetPage() {
  const { qrId } = useParams()
  const id = qrId?.toUpperCase()
  const [participant, setParticipant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resultados')

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'participants', id))
      setParticipant(snap.exists() ? { id: snap.id, ...snap.data() } : false)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <span className="spin" style={{ width:32, height:32, borderWidth:3 }} />
    </div>
  )

  if (!participant) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <div style={{ fontSize:60, marginBottom:20 }}>🔍</div>
      <h2 style={{ fontFamily:'Space Grotesk', color:'var(--teal)', marginBottom:10 }}>Carnet no encontrado</h2>
      <p style={{ color:'var(--text2)', textAlign:'center' }}>El código {id} no tiene datos registrados.</p>
    </div>
  )

  const p = participant
  const TABS = [
    { key:'resultados', label:'Resultados', icon:'📊' },
    { key:'recomendaciones', label:'Recomendaciones', icon:'🥗' },
    { key:'asesor', label:'Asesor IA', icon:'💬' },
    { key:'simular', label:'Simular', icon:'⚖️' },
  ]

  return (
    <div className="grid-bg" style={{ minHeight:'100vh', padding:'20px 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
       <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <img src="/SecMontesCarnet/logo-hx.png" alt="HealthXperience" style={{ height: 36, objectFit: 'contain' }} />
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, color:'var(--text3)', textTransform:'uppercase' }}>Carnet Digital</span>
          <img src="/SecMontesCarnet/logo-ibime.png" alt="IBIME" style={{ height: 32, objectFit: 'contain' }} />
       </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#00d4a0,#8b5cf6)', display:'flex',alignItems:'center',justifyContent:'center', fontSize:16 }}>💚</div>
            <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:13, color:'var(--teal)', letterSpacing:1 }}>HEALTHXPERIENCE</span>
          </div>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, color:'var(--text3)', textTransform:'uppercase' }}>Carnet Digital</span>
        </div>

        {/* Profile card */}
        <div className="card fade" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ width:50, height:50, borderRadius:14, background:'linear-gradient(135deg,#00d4a0,#8b5cf6)', display:'flex',alignItems:'center',justifyContent:'center', fontWeight:700, fontSize:20, flexShrink:0 }}>
              {p.nombre?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:18 }}>{p.nombre}</div>
              <div style={{ color:'var(--text2)', fontSize:12 }}>{p.edad} años · {p.sexo}</div>
              <div style={{ color:'var(--text3)', fontSize:11 }}>QR: {p.id} · Grupo: {p.grupo}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
            {[
              ['Peso', `${p.peso} kg`, 'var(--text)'],
              ['Altura', `${p.altura} m`, 'var(--text)'],
              ['IMC', p.imc?.toFixed(2) ?? '—', IMC_COLOR(p.imc)],
              ['Grasa', p.grasa ? `${p.grasa}%` : '—', 'var(--gold)'],
              ['Músculo', p.musculo ? `${p.musculo}kg` : '—', 'var(--teal)'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{l}</div>
                <div className="stat" style={{ fontSize:15, color:c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="card">
          {tab === 'resultados' && <TabResultados p={p} />}
          {tab === 'recomendaciones' && <TabRecomendaciones p={p} />}
          {tab === 'asesor' && <TabAsesorIA p={p} />}
          {tab === 'simular' && <TabSimular p={p} />}
        </div>

        <div style={{ textAlign:'center', marginTop:24, color:'var(--text3)', fontSize:11 }}>
          HEALTHXPERIENCE · IBIME 2026
        </div>
      </div>
    </div>
  )
}
