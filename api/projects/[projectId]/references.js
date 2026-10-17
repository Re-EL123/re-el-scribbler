import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('project_references')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { references: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) throw new ApiError(400, 'VALIDATION_ERROR', 'Reference title is required');

    const { data, error } = await supabase
      .from('project_references')
      .insert({
        project_id: project.id,
        authors: Array.isArray(body.authors) ? body.authors : [],
        title: title.slice(0, 300),
        publication_year: body.publication_year || null,
        publisher: body.publisher ? String(body.publisher).slice(0, 200) : null,
        citation_style: body.citation_style || 'apa',
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { reference: data }, 201);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const refId = body.id;
    if (!refId) throw new ApiError(400, 'VALIDATION_ERROR', 'Reference id is required');
    const updates = {};
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 300);
    if (Array.isArray(body.authors)) updates.authors = body.authors;
    if (body.publication_year !== undefined) updates.publication_year = body.publication_year;
    if (body.publisher !== undefined) updates.publisher = body.publisher ? String(body.publisher).slice(0, 200) : null;
    if (body.citation_style) updates.citation_style = body.citation_style;
    if (body.metadata && typeof body.metadata === 'object') updates.metadata = body.metadata;
    if (Object.keys(updates).length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await supabase
      .from('project_references')
      .update(updates)
      .eq('id', refId)
      .eq('project_id', project.id)
      .select('*')
      .single();
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { reference: data });
  }

  if (req.method === 'DELETE') {
    const refId = req.query.id;
    if (!refId) throw new ApiError(400, 'VALIDATION_ERROR', 'Reference id is required');
    const { error } = await supabase
      .from('project_references')
      .delete()
      .eq('id', refId)
      .eq('project_id', project.id);
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
