export const SUPABASE_URL="https://jxebbwfofurrpchxzlqd.supabase.co";
export const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4ZWJid2ZvZnVycnBjaHh6bHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MDk4MzksImV4cCI6MjA3MzA4NTgzOX0.9tNHoDIUuMTmbI_ktmEjroMr7HE9t1F9CWh6HamleBk";
export const LIFF_ID="2006490627-nERN5a26";
export const PUBLIC_URL="https://infobwd.github.io/APPWD/";
export const BRAND_TITLE="APPWD"; export const BRAND_LOGO_URL="";
export const SCHOOL_LAT=14.221816, SCHOOL_LNG=99.472859, SCHOOL_RADIUS_METERS=100;
export const CHECKIN_START="07:30"; export const CHECKIN_ON_TIME_UNTIL="08:00";
export const SUMMARY_DEFAULT_RANGE_DAYS=30; export const SLIDER_AUTO_MS=4000;
export const DEFAULT_FONT_SCALE=1, DEFAULT_ICON_SCALE=1, DEFAULT_THEME="light";
export function getSetting(key, fallback){ try{const m=JSON.parse(localStorage.getItem('APPWD_SETTINGS')||'{}'); return (m && key in m) ? m[key] : fallback; }catch(e){ return fallback; } }
export function setLocalSettings(obj){ try{localStorage.setItem('APPWD_SETTINGS', JSON.stringify(obj||{})); }catch(e){} }
try{ localStorage.setItem("APPWD_PUBLIC_URL", PUBLIC_URL.endsWith('/')?PUBLIC_URL:(PUBLIC_URL+'/')); }catch(e){}

// === DEV/PROD toggle ===
export const APP_VERSION = (typeof globalThis !== 'undefined' && 'APP_VERSION' in globalThis) ? globalThis.APP_VERSION : 'v5.6.1';
export const DEFAULT_ENABLE_SW = (typeof globalThis !== 'undefined' && 'DEFAULT_ENABLE_SW' in globalThis) ? globalThis.DEFAULT_ENABLE_SW : false;
export function getEnableSW(){ const v = localStorage.getItem('APPWD_ENABLE_SW'); return v ? v === '1' : DEFAULT_ENABLE_SW; }
export function setEnableSW(flag){ localStorage.setItem('APPWD_ENABLE_SW', flag ? '1' : '0'); }