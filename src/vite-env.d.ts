/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
  /** "0": the example with no set check-in rhythm (FARO_DEMO_RHYTHM, FT1). */
  readonly VITE_DEMO_RHYTHM?: string;
}
