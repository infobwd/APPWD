import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function signInEmail(email) {
  // Magic link (OTP) sign-in
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/'
    }
  });
  if (error) throw error;
  return true;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function signedUrl(bucket, path, expires = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
  if (error) return null;
  return data.signedUrl;
}
