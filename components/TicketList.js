import Link from 'next/link';
import { formattaData } from '../lib/useProfile';

const ETICHETTE_STATO = {
  aperto: 'Aperto',
  in_lavorazione: 'In lavorazione',
  risolto: 'Risolto',
};

const ETICHETTE_TIPO = {
  problema_generico: 'Problema generico',
  guasto_attrezzatura: 'Guasto attrezzatura',
};

export default function TicketList({ tickets, mostraStudio = false }) {
  if (!tickets || tickets.length === 0) {
    return <p style={{ color: '#6b7280' }}>Nessun ticket presente.</p>;
  }

  return (
    <div>
      {tickets.map(t => (
        <Link href={`/ticket/${t.id}`} key={t.id} className="ticket-item">
          {mostraStudio && t.studi && (
            <div className="badge-sede">🏢 {t.studi.nome}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: mostraStudio ? 8 : 0 }}>
            <div>
              <strong>{t.titolo}</strong>
              <div>
                <span className={`badge badge-${t.stato}`}>{ETICHETTE_STATO[t.stato]}</span>
                <span className="badge badge-tipo">{ETICHETTE_TIPO[t.tipo]}</span>
              </div>
            </div>
          </div>
          <div className="data-apertura">Aperto il {formattaData(t.creato_il)}</div>
        </Link>
      ))}
    </div>
  );
}
