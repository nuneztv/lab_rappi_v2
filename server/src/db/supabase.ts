import { createClient, SupabaseClient } from "@supabase/supabase-js";

const options = { auth: { autoRefreshToken: false, persistSession: false } };

let auth: SupabaseClient | null = null;
let admin: SupabaseClient | null = null;

export function getAuth() {
  if (!auth) {
    auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, options);
  }
  return auth;
}

export function getAdmin() {
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
  }
  return admin;
}

export async function send(topic: string, event: string, data: object) {
  const channel = getAdmin().channel(topic, { config: { private: true } });
  const res = await channel.httpSend(event, data);
  await getAdmin().removeChannel(channel);
  if (!res.success) throw new Error(res.error);
}
