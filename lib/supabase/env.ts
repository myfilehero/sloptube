export const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export type SupabaseConfig = { url: string; key: string };

/**
 * Reads one setting from the real environment of the running server.
 *
 * It must stay a Reflect.get call. The bundler replaces every lookup of a
 * NEXT_PUBLIC_ name on process.env that it can follow with the value it sees
 * during `npm run build`. That includes process.env.NAME, process.env["NAME"]
 * and even `const env = process.env; env[NAME]` with NAME a constant. A build
 * made with a .env.local present then carries that URL and key in
 * .next/server and keeps using them wherever it is started. The bundler does
 * not look inside Reflect.get, so this read happens at request time.
 * tests/supabase-env.test.mjs keeps it this way.
 */
function readSetting(name: string): string | undefined {
  const value: unknown = Reflect.get(process.env, name);
  return typeof value === "string" ? value.trim() : undefined;
}

/**
 * Reads the Supabase settings on the server at request time, never frozen
 * into the build. The same Docker image can then run with whatever is in
 * /opt/sloptube/.env.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = readSetting(SUPABASE_URL_ENV);
  const key = readSetting(SUPABASE_KEY_ENV);
  if (!url || !key) return null;
  return { url, key };
}
