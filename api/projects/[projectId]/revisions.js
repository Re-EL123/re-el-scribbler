import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { user, project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    let query = supabase
      .from('project_revisions')
      .select('id, document_id, revision, label, created_by, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (req.query.document_id) query = query.eq('document_id', req.query.document_id);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { revisions: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const docId = body.document_id;
    if (!docId) throw new ApiError(400, 'VALIDATION_ERROR', 'Document id is required');

    const { data: doc, error: docError } = await supabase
      .from('book_documents')
      .select('id, revision, content_json')
      .eq('id', docId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (docError) throw new ApiError(500, 'INTERNAL', docError.message);
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document not found');

    const { data, error } = await supabase
      .from('project_revisions')
      .insert({
        project_id: project.id,
        document_id: docId,
        revision: doc.revision,
        snapshot: doc.content_json,
        label: body.label ? String(body.label).slice(0, 120) : null,
        created_by: user.id
      })
      .select('id, document_id, revision, label, created_at')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { revision: data }, 201);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
