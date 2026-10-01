export default function Navbar({ titolo, nome, onLogout, azioneExtra }) {
  return (
    <div className="navbar">
      <div className="navbar-brand">
        <img src="/logo.png" alt="TO Smile" />
        <div className="titolo">
          {titolo}
          <small>TO Smile</small>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {azioneExtra}
        <span style={{ fontSize: 14, color: '#6b7280' }}>{nome}</span>
        <button className="btn btn-secondary" onClick={onLogout}>Esci</button>
      </div>
    </div>
  );
}
