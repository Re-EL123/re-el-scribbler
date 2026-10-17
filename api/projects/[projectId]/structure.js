import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

const SECTION_TYPES = ['chapter', 'front_matter', 'back_matter', 'part', 'appendix'];

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('book_sections')
      .select('*')
      .eq('project_id', project.id)
      .order('position', { ascending: true });
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { sections: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) throw new ApiError(400, 'VALIDATION_ERROR', 'Section title is required');
    const sectionType = SECTION_TYPES.includes(body.section_type) ? body.section_type : 'chapter';

    let position = body.position;
    if (typeof position !== 'number') {
      const { count } = await supabase
        .from('book_sections')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('section_type', sectionType);
      position = count || 0;
    }

    const { data, error } = await supabase
      .from('book_sections')
      .insert({
        project_id: project.id,
        parent_id: body.parent_id || null,
        title: title.slice(0, 200),
        section_type: sectionType,
        position,
        numbering_settings: {}
      })
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { section: data }, 201);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const sectionId = body.id;
    if (!sectionId) throw new ApiError(400, 'VALIDATION_ERROR', 'Section id is required');

    const updates = {};
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 200);
    if (typeof body.position === 'number') updates.position = body.position;
    if (SECTION_TYPES.includes(body.section_type)) updates.section_type = body.section_type;

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No valid fields to update');
    }

    const { data, error } = await supabase
      .from('book_sections')
      .update(updates)
      .eq('id', sectionId)
      .eq('project_id', project.id)
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { section: data });
  }

  if (req.method === 'DELETE') {
    const sectionId = req.query.id;
    if (!sectionId) throw new ApiError(400, 'VALIDATION_ERROR', 'Section id is required');
    const { error } = await supabase
      .from('book_sections')
      .delete()
      .eq('id', sectionId)
      .eq('project_id', project.id);
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
