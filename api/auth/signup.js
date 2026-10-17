import { withApi } from '../../lib/handler.js';
import { ok, fail, ApiError } from '../../lib/respond.js';
import { serviceClient } from '../../lib/supabase.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default withApi(async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const { email, password, display_name } = req.body || {};

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid email address');
  }
  if (!password || String(password).length < 8) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
  }
  if (!display_name || !String(display_name).trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Display name is required');
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(display_name).trim().slice(0, 80);
  const supabase = serviceClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: { display_name: cleanName }
  });

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('already') || message.includes('exists')) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }
    throw new ApiError(400, 'VALIDATION_ERROR', error.message || 'Could not create account');
  }

  await supabase
    .from('profiles')
    .insert({ id: data.user.id, display_name: cleanName })
    .select('id')
    .maybeSingle();

  const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: String(password)
  });

  if (signInError || !session?.session) {
    throw new ApiError(500, 'INTERNAL', 'Account created but sign-in failed. Please sign in manually.');
  }

  return ok(res, {
    user: { id: data.user.id, email: cleanEmail, display_name: cleanName },
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_in: session.session.expires_in
  }, 201);
});
