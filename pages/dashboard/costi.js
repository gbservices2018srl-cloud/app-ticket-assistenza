import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';

function primoGiornoMese() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function oggi() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardCosti() {
  const { profile, loading, logout } = useProfile();
  const router = useRouter();

  const [aziende, setAziende] = useState([]); // solo per super admin
  const [aziendaSelezionata, setAziendaSelezionata] = useState('');
  const [studi, setStudi] = useState([]);
  const [filtroSede, setFiltroSede] = useState('tutte');
  const [dataInizio, setDataInizio] = useState(primoGiornoMese());
  const [dataFine, setDataFine] = useState(oggi());
  const [costi, setCosti] = useState([]);
  const [caricandoCosti, setCaricandoCosti] = useState(true);
  const [errore, setErrore] = useState('');

  const isSuperAdmin = profile?.ruolo === 'super_admin';

  useEffect(() => {
    if (!profile) return;
    if (profile.ruolo !== 'super_admin' && profile.ruolo !== 'admin_azienda') {
      router.push('/');
      return;
    }
    if (isSuperAdmin) {
      caricaAziende();
    } else {
      caricaStudi(profile.azienda_id);
    }
  }, [profile]);

  useEffect(() => {
    if (isSuperAdmin && aziendaSelezionata) caricaStudi(aziendaSelezionata);
  }, [aziendaSelezionata]);

  useEffect(() => {
    if (!profile) return;
    const aziendaTarget = isSuperAdmin ? aziendaSelezionata : profile.azienda_id;
    if (!aziendaTarget) {
      setCosti([]);
      setCaricandoCosti(false);
      return;
    }
    caricaCosti(aziendaTarget);
  }, [profile, aziendaSelezionata, filtroSede, dataInizio, dataFine]);

  async function caricaAziende() {
    const { data } = await supabase.from('aziende').select('*').order('nome', { ascending: true });
    setAziende(data || []);
    if (data && data.length > 0) setAziendaSelezionata(data[0].id);
  }

  async function caricaStudi(aziendaId) {
    const { data } = await supabase
      .from('studi')
      .select('*')
      .eq('azienda_id', aziendaId)
      .order('nome', { ascending: true });
    setStudi(data || []);
  }

  async function caricaCosti(aziendaId) {
    setCaricandoCosti(true);
    setErrore('');

    let query = supabase
      .from('ticket_costi')
      .select('*')
      .eq('azienda_id', aziendaId)
      .gte('data_costo', dataInizio)
      .lte('data_costo', dataFine)
      .order('data_costo', { ascending: false });

    if (filtroSede !== 'tutte') query = query.eq('studio_id', filtroSede);

    const { data, error } = await query;

    if (error) {
      setErrore(error.message);
      setCaricandoCosti(false);
      return;
    }

    setCosti(data || []);
    setCaricandoCosti(false);
  }

  if (loading || !profile) return <div className="container">Caricamento…</div>;

  const totaleGenerale = costi.reduce((tot, c) => tot + Number(c.importo), 0);

  // Raggruppa per sede
  const perSede = {};
  costi.forEach(c => {
    const chiave = c.studio_id || 'senza-sede';
    const nome = c.nome_studio || 'Sede eliminata / non specificata';
    if (!perSede[chiave]) perSede[chiave] = { nome, totale: 0, voci: [] };
    perSede[chiave].totale += Number(c.importo);
    perSede[chiave].voci.push(c);
  });
  const sediOrdinate = Object.values(perSede).sort((a, b) => b.totale - a.totale);

  return (
    <div>
      <Navbar titolo="Assistenza — Costi" nome={profile.nome} onLogout={logout} />
      <div className="container">
        {errore && <div className="errore">{errore}</div>}

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Filtri</h2>

          {isSuperAdmin && (
            <>
              <label>Azienda</label>
              <select value={aziendaSelezionata} onChange={e => { setAziendaSelezionata(e.target.value); setFiltroSede('tutte'); }}>
                {aziende.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </>
          )}

          <label>Sede</label>
          <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="tutte">Tutte le sedi</option>
            {studi.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Dal</label>
              <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Al</label>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Totale nel periodo</h2>
          <p style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>€ {totaleGenerale.toFixed(2)}</p>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {costi.length} {costi.length === 1 ? 'voce registrata' : 'voci registrate'}
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Spesa per sede</h2>

          {caricandoCosti && <p>Caricamento…</p>}
          {!caricandoCosti && sediOrdinate.length === 0 && (
            <p style={{ color: '#6b7280' }}>Nessun costo registrato in questo periodo.</p>
          )}

          {!caricandoCosti && sediOrdinate.map((sede, i) => (
            <div key={i} style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>🏢 {sede.nome}</strong>
                <span style={{ fontWeight: 700 }}>€ {sede.totale.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {sede.voci.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '4px 0', borderTop: '1px solid #f3f4f6' }}>
                    <span>
                      {new Date(v.data_costo).toLocaleDateString('it-IT')}
                      {v.titolo_ticket && <> — {v.titolo_ticket}</>}
                      {v.descrizione && <> ({v.descrizione})</>}
                    </span>
                    <span>€ {Number(v.importo).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
