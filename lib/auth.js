import { ApiError } from './respond.js';
import { serviceClient } from './supabase.js';

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export async function requireUser(req) {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue');
  }
  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
  }
  const user = data.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const displayName =
      user.user_metadata?.display_name || user.email?.split('@')[0] || 'Writer';
    await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: displayName })
      .select('id')
      .maybeSingle();
  }

  return user;
}

export async function requireOwnedProject(req, projectId) {
  const user = await requireUser(req);
  if (!projectId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Project id is required');
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new ApiError(500, 'INTERNAL', error.message);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  return { user, project: data, supabase };
}
