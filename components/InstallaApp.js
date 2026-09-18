import { useEffect, useState } from 'react';

export default function InstallaApp() {
  const [promptEvento, setPromptEvento] = useState(null);
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setPromptEvento(e);
      setVisibile(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installa() {
    if (!promptEvento) return;
    promptEvento.prompt();
    await promptEvento.userChoice;
    setVisibile(false);
    setPromptEvento(null);
  }

  if (!visibile) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#111827', color: 'white', padding: '10px 16px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 999, fontSize: 14,
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
    }}>
      <span>Installa l'app sul dispositivo per un accesso più rapido</span>
      <button
        onClick={installa}
        style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
      >
        Installa
      </button>
      <button
        onClick={() => setVisibile(false)}
        style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  );
}
