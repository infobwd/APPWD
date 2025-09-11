// Rename this file to config.js and fill in your Supabase project credentials.
export const SUPABASE_URL = "https://jxebbwfofurrpchxzlqd.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4ZWJid2ZvZnVycnBjaHh6bHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MDk4MzksImV4cCI6MjA3MzA4NTgzOX0.9tNHoDIUuMTmbI_ktmEjroMr7HE9t1F9CWh6HamleBk";
export const LIFF_ID = "2006490627-nERN5a26";
export const PUBLIC_BASE = "/APPWD/";
export const PUBLIC_URL  = "https://infobwd.github.io/APPWD/";
// persist PUBLIC_URL for early canonical script
try{ localStorage.setItem("APPWD_PUBLIC_URL", PUBLIC_URL); }catch(e){}
// After setting, commit to GitHub (anon key is safe for client use with RLS).
// For GitHub Pages, ensure your redirect URL is allowed in Supabase Auth settings.
