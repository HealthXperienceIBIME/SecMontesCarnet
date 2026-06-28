// src/pages/CarnetPage.jsx
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

// ⚠️ REEMPLAZA CON TU LLAVE DE GEMINI REAL
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Función optimizada para obtener respuestas con Streaming (efecto máquina de escribir en tiempo real).
 * @param {string} prompt - El texto que se le envía a la IA
 * @param {function} onChunk - Callback que recibe cada fragmento de texto conforme llega
 */
async function geminiStream(prompt, onChunk) {
  // Usamos el endpoint "streamGenerateContent" para activar la transmisión en tiempo real
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_KEY}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } 
      })
    });

    if (!res.ok) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // La API de Google envía estructuras JSON separadas por comas/llaves en líneas o bloques.
      // Este bloque procesa los fragmentos de texto conforme van llegando de manera limpia.
      try {
        // Buscamos los bloques de texto generados por Gemini dentro del stream
        const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
        let match;
        let textChunk = '';
        
        while ((match = regex.exec(buffer)) !== null) {
          // Evaluamos el string para limpiar escapes como \n o \"
          try {
            textChunk += JSON.parse(`"${match[1]}"`);
          } catch {
            textChunk += match[1];
          }
        }
        
        if (textChunk) {
          onChunk(textChunk);
          // Limpiamos el buffer procesado para evitar duplicados en la siguiente iteración
          buffer = buffer.substring(buffer.lastIndexOf('}') + 1);
        }
      } catch (e) {
        // Si el JSON está incompleto en ese instante, espera al siguiente chunk
      }
    }
  } catch (error) {
    console.error("Error en Gemini Stream:", error);
  }
}

function getIMCTipo(imc) {
  if (!imc) return 'normal'
  if (imc < 18.5) return 'bajo-peso'
  if (imc <= 24.9) return 'normal'
  if (imc <= 29.9) return 'sobrepeso'
  return 'obesidad'
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
  const omitidas = p.pruebasOmitidas

  return (
    <div className="fade">
      {omitidas && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#f59e0b', textAlign: 'center' }}>
          ⏭️ Las pruebas físicas no fueron realizadas
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 12 }}>Marcas Deportivas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            ['Salto Cuerda', omitidas ? 'N/A' : (pr.saltoCuerda ?? '—'), 'reps / 15s'],
            ['Lanzamiento', omitidas ? 'N/A' : (pr.lanzamiento ?? '—'), 'metros'],
            ['Carrera 45m', omitidas ? 'N/A' : (pr.carrera ?? '—'), 'segundos'],
          ].map(([l, v, u]) => (
            <div key={l} className="card" style={{ textAlign: 'center', opacity: omitidas ? 0.5 : 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 8 }}>{l}</div>
              <div className="stat" style={{ fontSize: 22, color: omitidas ? 'var(--text3)' : 'var(--gold)' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{u}</div>
            </div>
          ))}
        </div>
      </div>

      {!omitidas && (
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
      )}
    </div>
  )
}

// ── TAB: Recomendaciones ─────────────────────────────────────────────────────
function TabRecomendaciones({ p }) {
  const text = p.recomendaciones || ''
  const tipo = getIMCTipo(p.imc)
  const BASE = '/SecMontesCarnet'

  const SECTIONS = {
    'JARRA DEL BUEN BEBER': { icon: '💧', color: '#3b82f6', img: `${BASE}/jarra-${tipo}.png` },
    'PLATO DEL BUEN COMER': { icon: '🥗', color: '#00d4a0', img: `${BASE}/plato-${tipo}.png` },
    'DIETA SEMANAL': { icon: '📅', color: '#8b5cf6', img: null },
    'RECOMENDACIONES GENERALES': { icon: '✨', color: '#f59e0b', img: null },
  }

  if (!text) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
      Las recomendaciones aún no han sido generadas en la estación IA.
    </div>
  )

  const parsed = {}
  let current = null
  text.split('\n').forEach(line => {
    const heading = line.replace('## ', '').trim()
    if (SECTIONS[heading]) { current = heading; parsed[heading] = '' }
    else if (current) parsed[current] += line + '\n'
  })

  const renderLines = (content) => content.split('\n').filter(l => l.trim()).map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g)
    return (
      <p key={i} style={{ marginBottom: 6, color: 'var(--text2)', lineHeight: 1.7, fontSize: 13 }}>
        {parts.map((pp, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'var(--text)' }}>{pp}</strong> : pp)}
      </p>
    )
  })

  return (
    <div className="fade">
      {Object.entries(SECTIONS).map(([key, { icon, color, img }]) => (
        <div key={key} style={{ marginBottom: 18, background: color + '08', border: `1px solid ${color}25`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${color}20` }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 700, color, margin: 0 }}>{key}</h3>
          </div>

          {img && (
            <div style={{ padding: '16px 18px 0' }}>
              <img
                src={img}
                alt={key}
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10 }}
                onError={e => e.target.style.display = 'none'}
              />
            </div>
          )}

          <div style={{ padding: '12px 18px 16px' }}>
            {parsed[key] ? renderLines(parsed[key]) : <p style={{ color: 'var(--text3)', fontSize: 13 }}>Sin información</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TAB: Asesor IA (CON RENDIMIENTO VELOZ MEDIANTE STREAMING) ─────────────────
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
    // Agregamos la pregunta del usuario y creamos un mensaje vacío para la IA que llenaremos progresivamente
    setMsgs(prev => [...prev, { role: 'user', text: q }, { role: 'ai', text: '' }])
    setLoading(true)
    
    const context = `Eres un asesor de salud y nutrición amigable para adolescentes mexicanos. El participante se llama ${p.nombre}, tiene ${p.edad} años, sexo ${p.sexo}, peso ${p.peso}kg, altura ${p.altura}m, IMC ${p.imc ?? 'N/A'} (${p.imcStatus || 'Normal'}).${p.pruebas ? ` Pruebas: salto ${p.pruebas.saltoCuerda} reps, lanzamiento ${p.pruebas.lanzamiento}m, carrera ${p.pruebas.carrera}s.` : ' No realizó pruebas físicas.'} Responde en español de forma amigable, breve (máximo 3 líneas) y motivadora. Pregunta: ${q}`;
    
    // Llamamos a la nueva función de Streaming
    await geminiStream(context, (textAcumulado) => {
      setMsgs(prev => {
        const actualizados = [...prev];
        // Modificamos el último elemento (que pertenece a la IA) en tiempo real
        actualizados[actualizados.length - 1] = { role: 'ai', text: textAcumulado };
        return actualizados;
      });
      setLoading(false); // Desactivamos el spinner en cuanto empiezan a salir las letras
    });
    
    setLoading(false);
  }

  return (
    <div className="fade" style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
      <div style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 13, marginBottom: 2 }}>💬 Asesor IA de Salud</div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>Basado en Plato del Buen Comer y Jarra del Buen Beber</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {msgs.map((m, i) => {
          // No renderizar burbujas vacías que ocurran durante el primer milisegundo de carga
          if (m.role === 'ai' && !m.text && loading) return null;
          
          return (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'ai' && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--teal-dim)', border: '1px solid var(--teal)', display:'flex',alignItems:'center',justifyContent:'center', marginRight: 8, flexShrink: 0, fontSize: 14 }}>💚</div>}
              <div style={{
                maxWidth: '78%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? 'var(--teal-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${m.role === 'user' ? 'var(--teal)' : 'var(--border)'}`,
                fontSize: 13, lineHeight: 1.6, color: 'var(--text)'
              }}>{m.text}</div>
            </div>
          )
        })}
        {loading && !msgs[msgs.length - 1]?.text && (
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <div style={{ width:28,height:28,borderRadius:'50%',background:'var(--teal-dim)',border:'1px solid var(--teal)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>💚</div>
            <span className="spin" />
          </div>
        )}
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

// ── TAB: Simular (CON RESPUESTA VELOZ MEDIANTE STREAMING) ─────────────────────
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
    setAnalysis('') // Limpiamos análisis anterior
    
    const prompt = `El usuario ${p.nombre} simula cambiar su peso de ${p.peso}kg a ${simPeso}kg y su tiempo de 45m de ${p.pruebas?.carrera ?? '—'}s a ${simCarrera}s. Nuevo IMC: ${newIMC.toFixed(2)} (${imcLabel}). Nueva velocidad: ${simV.toFixed(2)}m/s, aceleración: ${simA.toFixed(2)}m/s², fuerza: ${simF.toFixed(2)}N. Analiza de manera súper breve si estos cambios son saludables y cómo mejorar. Responde en máximo 2 oraciones concisas en español.`;
    
    await geminiStream(prompt, (textAcumulado) => {
      setAnalysis(textAcumulado);
      setAnalyzing(false); // Apagamos animación de carga apenas empiece a responder
    });
    
    setAnalyzing(false)
  }

  const Slider = ({ label, value, min, max, step, onChange, current }) => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
        <span style={{ color:'var(--text2)' }}>{label}</span>
        <span className="stat" style={{ color:'var(--teal)', fontSize:13 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}
        style={{ width:'100%', padding:0, height:6, borderRadius:3, appearance:'none', cursor:'pointer',
          background:`linear-gradient(to right,var(--teal) 0%,var(--teal) ${(value-min)/(max-min)*100}%,var(--border) ${(value-min)/(max-min)*100}%,var(--border) 100%)`
        }} />
      {current !== undefined && <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>Actual: {current}</div>}
    </div>
  )

  return (
    <div className="fade">
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight:700, color:'var(--teal)', marginBottom:14, fontSize:13 }}>⚖️ SIMULAR PESO Y ALTURA</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
          <Slider label={`Peso (kg)`} value={peso} min={30} max={150} step={0.5} onChange={setPeso} current={`${p.peso} kg`} />
          <Slider label={`Altura (m)`} value={altura} min={1.0} max={2.2} step={0.01} onChange={setAltura} current={`${p.altura} m`} />
        </div>
        <div style={{ padding:16, background: imcOk ? 'var(--teal-dim)' : 'rgba(245,158,11,0.1)', border:`1px solid ${imcColor}`, borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="stat" style={{ fontSize:28, color:imcColor }}>{newIMC.toFixed(2)}</div>
            <div style={{ color:imcColor, fontWeight:600, fontSize:13 }}>{imcLabel}</div>
          </div>
          {imcOk && <span style={{ color:'var(--teal)', fontSize:13, fontWeight:600 }}>✓ Saludable</span>}
        </div>
      </div>

      {p.pruebas && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight:700, color:'var(--purple)', marginBottom:14, fontSize:13 }}>✨ SIMULAR RENDIMIENTO</div>
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
      )}

      <button onClick={handleAnalyze} disabled={analyzing}
        style={{ width:'100%', padding:14, background:'linear-gradient(90deg,#00d4a0,#8b5cf6)', color:'#fff', borderRadius:10, fontSize:14, display:'flex',alignItems:'center',justifyContent:'center',gap:10, border:'none', cursor:'pointer' }}>
        {analyzing ? <><span className="spin" style={{width:16,height:16}} /> Analizando...</> : '✨ Analizar cambios con IA'}
      </button>
      {analysis && (
        <div className="card" style={{ marginTop:14, borderColor:'var(--teal)', fontSize:13, color:'var(--text2)', lineHeight:1.7 }}>
          {analysis}
        </div>
      )}
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
              {p.presentacionLabel && (
                <div style={{ display:'inline-block', marginTop:4, background:'var(--teal-dim)', color:'var(--teal)', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600 }}>
                  📅 {p.presentacionLabel}
                </div>
              )}
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
