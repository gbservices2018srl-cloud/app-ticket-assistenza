// Documenti ufficiali di appgestione.it (revisionati dal DPO), in fondo a ogni pagina.
const stile = { color: 'inherit' };
export default function LinkLegali() {
  return (
    <footer style={{ textAlign: 'center', fontSize: 12.5, color: '#7A8084', padding: '22px 16px 90px', lineHeight: 1.7 }}>
      <a href="https://appgestione.it/privacy" target="_blank" rel="noopener noreferrer" style={stile}>Privacy Policy</a>{' · '}
      <a href="https://appgestione.it/cookie" target="_blank" rel="noopener noreferrer" style={stile}>Cookie Policy</a>{' · '}
      <a href="https://appgestione.it/termini" target="_blank" rel="noopener noreferrer" style={stile}>Termini e condizioni</a>
    </footer>
  );
}
