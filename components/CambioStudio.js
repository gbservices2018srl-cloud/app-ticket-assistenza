import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Chi lavora in più studi (assegnati dal pannello accessi) sceglie qui lo studio su cui lavorare.
export default function CambioStudio() {
  const [studi, setStudi] = useState([]);
  const [cambio, setCambio] = useState(false);

  useEffect(() => {
    supabase.rpc('miei_studi').then(({ data }) => setStudi(data || []));
  }, []);

  if (studi.length < 2) return null;
  const attuale = (studi.find((s) => s.attuale) || studi[0]).studio_id;

  async function scegli(e) {
    setCambio(true);
    const { error } = await supabase.rpc('cambia_studio', { p_studio: e.target.value });
    if (error) { alert('Non è stato possibile cambiare studio: ' + error.message); setCambio(false); return; }
    window.location.reload();
  }

  return (
    <label style={{ fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
      Studio
      <select value={attuale} onChange={scegli} disabled={cambio} style={{ fontWeight: 700, width: 'auto', margin: 0 }}>
        {studi.map((s) => <option key={s.studio_id} value={s.studio_id}>{s.nome}</option>)}
      </select>
    </label>
  );
}
