// src/pages/NotFound.jsx
export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <div style={{ fontSize:60, marginBottom:20 }}>🔍</div>
      <h2 style={{ fontFamily:'Space Grotesk', color:'var(--teal)', marginBottom:10 }}>Página no encontrada</h2>
      <p style={{ color:'var(--text2)', textAlign:'center' }}>El carnet que buscas no existe.</p>
    </div>
  )
}
