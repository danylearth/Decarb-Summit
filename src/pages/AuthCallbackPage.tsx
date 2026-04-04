import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * Handles OAuth and magic link redirects for PKCE flow.
 * Supabase redirects here with ?code=... after successful auth.
 * We exchange the code for a session, then redirect to the app.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const exchangedRef = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[AuthCallback] Code exchange failed:', error.message);
        }
      }

      // Navigate to root — auth state listener in UserContext handles the rest.
      // Replace so the callback URL (with code) isn't in browser history.
      navigate('/', { replace: true });
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
