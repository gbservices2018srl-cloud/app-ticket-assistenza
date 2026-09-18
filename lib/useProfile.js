import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useRouter } from 'next/router';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let attivo = true;

    async function carica() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (attivo) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (attivo) {
        if (!error) setProfile(data);
        setLoading(false);
      }
    }

    carica();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      carica();
    });

    return () => {
      attivo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return { profile, loading, logout };
}

export function formattaData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
