const isVercelHost = /\.vercel\.app$/.test(location.hostname);
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

export const CONFIG = {
  name: 'Re-EL Scribbler',
  version: '0.1.0',
  API_BASE: isLocal || isVercelHost ? '/api' : 'https://re-el-scribbler.vercel.app/api',
  SUPABASE_URL: 'https://ptqinzavcrvnhqexkxik.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWluemF2Y3J2bmhxZXhreGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTIyNzAsImV4cCI6MjEwNzc4ODI3MH0.WQsIZtekkYg_yeUsPBreM260G8N3S9TO8PDrjmSx5vw'
};
