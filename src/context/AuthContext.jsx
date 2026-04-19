import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      return;
    }
    try {
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();

      // ── Auto-provision: if no profiles row exists yet, create one now ──
      // This handles users who existed before the DB trigger was created,
      // or whose signup trigger failed for any reason.
      if (!profile) {
        const { data: created } = await supabase
          .from('profiles')
          .upsert({ id: sessionUser.id }, { onConflict: 'id' })
          .select()
          .maybeSingle();
        profile = created; // may still be null if RLS blocks it, that's ok
      }

      setUser({
        ...sessionUser,
        ...(profile || {})
      });
    } catch (e) {
      console.error('fetchProfile error:', e);
      setUser(sessionUser);
    }
  };


  const updateProfile = async (updates) => {
    if (!user?.id) return { error: 'No user session' };

    try {
      // Step 1: Upsert the data (creates row if missing, updates if present)
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, ...updates },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('updateProfile upsert error:', error);
        return { error };
      }

      // Step 2: Always re-fetch the full profile row so local state exactly
      // mirrors the DB — covers edge cases where upsert select() returns null
      const { data: fresh } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fresh) {
        setUser(prev => ({ ...prev, ...fresh }));
      }

      return { data: fresh, error: null };
    } catch (err) {
      console.error('updateProfile exception:', err);
      return { error: err };
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout to ensure app always eventually renders
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth initialization timed out, forcing recovery...");
        setLoading(false);
      }
    }, 5000);

    // Initial session check with singleton guard
    const init = async () => {
      try {
        // We do a single getSession but handle it carefully
        const { data: { session: initSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initSession);
          if (initSession?.user) {
            setUser(initSession.user);
            fetchProfile(initSession.user);
          }
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (e) {
        console.error("Auth init error:", e);
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log(`Auth Event (Subscription): ${event}`);
      setSession(newSession);

      if (newSession?.user) {
        setUser(newSession.user);
        fetchProfile(newSession.user);
      } else {
        setUser(null);
      }

      setLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, session, loading, updateProfile }}>
      {loading ? (
        <div className="loading-screen">
          <div className="loader"></div>
          <p>Initializing Pocket...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
