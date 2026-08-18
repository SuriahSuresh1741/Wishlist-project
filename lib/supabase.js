import { createClient } from "@supabase/supabase-js";

// Only imported in API routes — service role key is never sent to the browser
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default supabase;
