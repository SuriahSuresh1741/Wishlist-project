import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  const results = {};

  // Test 1: can we reach Supabase at all?
  try {
    const { error } = await supabase.from('wishes').select('id').limit(1);
    results.table = error ? `ERROR: ${error.message}` : 'OK — wishes table exists';
  } catch (e) {
    results.table = `EXCEPTION: ${e.message}`;
  }

  // Test 2: does the uploads storage bucket exist?
  try {
    const { data, error } = await supabase.storage.getBucket('uploads');
    results.storage = error ? `ERROR: ${error.message}` : `OK — bucket "${data.name}" found`;
  } catch (e) {
    results.storage = `EXCEPTION: ${e.message}`;
  }

  // Show what env vars are loaded (masked)
  results.env = {
    SUPABASE_URL: process.env.SUPABASE_URL || '(not set)',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `set (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`
      : '(not set)',
  };

  res.status(200).json(results);
}
