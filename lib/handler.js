import { applyCors } from './cors.js';
import { ApiError, fail } from './respond.js';

export function withApi(fn) {
  return async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(res, err.status, err.code, err.message);
      }
      console.error('[api:error]', err);
      return fail(res, 500, 'INTERNAL', 'Something went wrong on our side');
    }
  };
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', `Allowed: ${allowed.join(', ')}`);
}
