import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';
import TicketList from '../../components/TicketList';

export default function DashboardStudio() {
  const { profile, loading, logout } = useProfile();
  const [tickets, setTickets] = useState([]);
  const [caricandoTickets, setCaricandoTickets] = useState(true);
  const [filtroStato, setFiltroStato] = useState('tutti');

  const [tipo, setTipo] = useState('problema_generico');
  const [titolo, setTitolo] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [foto, setFoto] = useState(null);
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');
  const [inviando, setInviando] = useState(false);

  useEffect(() => {
    if (profile) caricaTickets();
  }, [profile, filtroStato]);

  async function caricaTickets() {
    setCaricandoTickets(true);
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('studio_id', profile.studio_id)
      .order('creato_il', { ascending: false });

    if (filtroStato !== 'tutti') query = query.eq('stato', filtroStato);

    const { data } = await query;
    setTickets(data || []);
    setCaricandoTickets(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');

    if (!foto) {
      setErrore('È obbligatorio allegare una foto per aprire un ticket.');
      return;
    }

    setInviando(true);

    const { data: nuovoTicket, error: erroreTicket } = await supabase
      .from('tickets')
      .insert({
        studio_id: profile.studio_id,
        azienda_id: profile.azienda_id,
        creato_da: profile.id,
        tipo,
        titolo,
        descrizione,
      })
      .select()
      .single();

    if (erroreTicket) {
      setErrore('Errore durante la creazione del ticket: ' + erroreTicket.message);
      setInviando(false);
      return;
    }

    if (foto) {
      const percorso = `${nuovoTicket.id}/${Date.now()}_${foto.name}`;
      const { error: erroreUpload } = await supabase.storage
        .from('allegati-ticket')
        .upload(percorso, foto);

      if (erroreUpload) {
        setErrore('Ticket creato ma errore nel caricamento della foto: ' + erroreUpload.message);
        setInviando(false);
        return;
      }

      await supabase.from('ticket_allegati').insert({
        ticket_id: nuovoTicket.id,
        storage_path: percorso,
      });
    }

    setSuccesso('Ticket inviato con successo.');
    setTitolo('');
    setDescrizione('');
    setFoto(null);
    setTipo('problema_generico');
    e.target.reset();
    setInviando(false);
    caricaTickets();
  }

  if (loading || !profile) return <div className="container">Caricamento…</div>;

  return (
    <div>
      <Navbar titolo="Assistenza — Studio" nome={profile.nome} onLogout={logout} />
      <div className="container">
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Apri un nuovo ticket</h2>
          {errore && <div className="errore">{errore}</div>}
          {successo && <div className="successo">{successo}</div>}
          <form onSubmit={handleSubmit}>
            <label>Tipo di richiesta</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="problema_generico">Problema generico nello studio</option>
              <option value="guasto_attrezzatura">Guasto / malfunzionamento attrezzatura</option>
            </select>

            <label>Titolo</label>
            <input value={titolo} onChange={e => setTitolo(e.target.value)} required />

            <label>Descrizione</label>
            <textarea rows={4} value={descrizione} onChange={e => setDescrizione(e.target.value)} required />

            <label>Foto (obbligatoria)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setFoto(e.target.files[0])}
              required
            />

            <button className="btn" type="submit" disabled={inviando}>
              {inviando ? 'Invio in corso…' : 'Invia ticket'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>I tuoi ticket</h2>
          <div style={{ marginBottom: 12 }}>
            {[
              { valore: 'tutti', etichetta: 'Tutti' },
              { valore: 'aperto', etichetta: 'Aperti' },
              { valore: 'in_lavorazione', etichetta: 'In lavorazione' },
              { valore: 'risolto', etichetta: 'Risolti' },
            ].map(t => (
              <span
                key={t.valore}
                onClick={() => setFiltroStato(t.valore)}
                style={{
                  display: 'inline-block', padding: '8px 14px', borderRadius: 999, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', marginRight: 8, marginBottom: 8,
                  background: filtroStato === t.valore ? '#2563eb' : '#eef0f3',
                  color: filtroStato === t.valore ? 'white' : '#1a1a1a',
                }}
              >
                {t.etichetta}
              </span>
            ))}
          </div>
          {caricandoTickets ? <p>Caricamento…</p> : <TicketList tickets={tickets} />}
        </div>
      </div>
    </div>
  );
}
