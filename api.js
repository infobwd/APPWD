
import { SUPABASE_URL,SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
export async function currentUser(){ const { data:{ user } }=await supabase.auth.getUser(); return user||null; }
