import { withApi } from '../../lib/handler.js';
import { ok, fail, ApiError } from '../../lib/respond.js';
import { requireOwnedProject } from '../../lib/auth.js';
import { serviceClient } from '../../lib/supabase.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { user, project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    const [{ data: sections }, { data: documents }] = await Promise.all([
      supabase
        .from('book_sections')
        .select('*')
        .eq('project_id', project.id)
        .order('position', { ascending: true }),
      supabase
        .from('book_documents')
        .select('id, section_id, title, document_type, revision, word_count, position, updated_at')
        .eq('project_id', project.id)
        .order('position', { ascending: true })
    ]);

    return ok(res, {
      project,
      structure: {
        sections: sections || [],
        documents: documents || []
      }
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const updates = {};
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 200);
    if (typeof body.subtitle === 'string') updates.subtitle = body.subtitle.trim().slice(0, 200);
    if (typeof body.author_name === 'string' && body.author_name.trim()) updates.author_name = body.author_name.trim().slice(0, 120);
    if (typeof body.description === 'string') updates.description = body.description.trim().slice(0, 2000);
    if (typeof body.status === 'string') updates.status = body.status;
    if (typeof body.target_word_count === 'number') updates.target_word_count = Math.max(0, body.target_word_count);
    if (body.settings && typeof body.settings === 'object') updates.settings = body.settings;

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No valid fields to update');
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', project.id)
      .eq('owner_id', user.id)
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { project: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', project.id)
      .eq('owner_id', user.id);

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
