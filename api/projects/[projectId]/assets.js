import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { user, project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('project_assets')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { assets: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const fileName = String(body.file_name || '').trim();
    if (!fileName) throw new ApiError(400, 'VALIDATION_ERROR', 'File name is required');

    const { data, error } = await supabase
      .from('project_assets')
      .insert({
        project_id: project.id,
        owner_id: user.id,
        storage_path: body.storage_path ? String(body.storage_path) : `assets/${project.id}/${fileName}`,
        file_name: fileName.slice(0, 300),
        mime_type: body.mime_type ? String(body.mime_type) : 'application/octet-stream',
        file_size: Number(body.file_size) || 0,
        width: Number(body.width) || null,
        height: Number(body.height) || null,
        alt_text: body.alt_text ? String(body.alt_text).slice(0, 500) : null,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { asset: data }, 201);
  }

  if (req.method === 'DELETE') {
    const assetId = req.query.id;
    if (!assetId) throw new ApiError(400, 'VALIDATION_ERROR', 'Asset id is required');
    const { error } = await supabase
      .from('project_assets')
      .delete()
      .eq('id', assetId)
      .eq('project_id', project.id);
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
