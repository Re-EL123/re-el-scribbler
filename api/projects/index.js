import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, projects: [] });
  }

  if (req.method === 'POST') {
    const { title, author_name } = req.body || {};
    if (!title || !author_name) {
      return res.status(400).json({ error: 'Title and author are required' });
    }
    return res.status(201).json({ success: true, project: { id: 'temp-id', title, author_name } });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end('Method Not Allowed');
}
