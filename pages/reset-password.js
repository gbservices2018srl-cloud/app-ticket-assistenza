import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase intercetta automaticamente il token dal link nell'URL
    // e crea una sessione temporanea di tipo "recovery"
    const { data: listener } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setPronto(true);
      }
    });

    // Se la sessione è già presente al caricamento (capita spesso)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrore('');
    setSalvando(true);

    const { error } = await supabase.auth.updateUser({ password: nuovaPassword });

    setSalvando(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    setSuccesso('Password aggiornata con successo. Ora puoi accedere con la nuova password.');
    setTimeout(() => router.push('/'), 2500);
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Imposta nuova password</h1>

        {!pronto && !successo && (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Apri questa pagina dal link ricevuto via email per impostare la nuova password.
          </p>
        )}

        {errore && <div className="errore">{errore}</div>}
        {successo && <div className="successo">{successo}</div>}

        {pronto && !successo && (
          <form onSubmit={handleSubmit}>
            <label>Nuova password</label>
            <input
              type="password"
              value={nuovaPassword}
              onChange={e => setNuovaPassword(e.target.value)}
              required
              minLength={6}
            />
            <button className="btn" type="submit" disabled={salvando} style={{ width: '100%' }}>
              {salvando ? 'Salvataggio…' : 'Salva nuova password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
