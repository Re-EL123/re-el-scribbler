import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { user, project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    let query = supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });
    if (req.query.document_id) query = query.eq('document_id', req.query.document_id);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { comments: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const docId = body.document_id;
    const content = String(body.content || '').trim();
    if (!docId) throw new ApiError(400, 'VALIDATION_ERROR', 'Document id is required');
    if (!content) throw new ApiError(400, 'VALIDATION_ERROR', 'Comment content is required');

    const { data, error } = await supabase
      .from('project_comments')
      .insert({
        project_id: project.id,
        document_id: docId,
        author_id: user.id,
        content: content.slice(0, 4000),
        anchor_data: body.anchor_data && typeof body.anchor_data === 'object' ? body.anchor_data : {},
        status: 'open'
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { comment: data }, 201);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const commentId = body.id;
    if (!commentId) throw new ApiError(400, 'VALIDATION_ERROR', 'Comment id is required');
    const updates = {};
    if (typeof body.content === 'string' && body.content.trim()) updates.content = body.content.trim().slice(0, 4000);
    if (['open', 'resolved'].includes(body.status)) updates.status = body.status;
    if (Object.keys(updates).length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await supabase
      .from('project_comments')
      .update(updates)
      .eq('id', commentId)
      .eq('project_id', project.id)
      .select('*')
      .single();
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { comment: data });
  }

  if (req.method === 'DELETE') {
    const commentId = req.query.id;
    if (!commentId) throw new ApiError(400, 'VALIDATION_ERROR', 'Comment id is required');
    const { error } = await supabase
      .from('project_comments')
      .delete()
      .eq('id', commentId)
      .eq('project_id', project.id);
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
