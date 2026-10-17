import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

function countWords(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method === 'GET') {
    const docId = req.query.id;
    if (docId) {
      const { data, error } = await supabase
        .from('book_documents')
        .select('*')
        .eq('id', docId)
        .eq('project_id', project.id)
        .maybeSingle();
      if (error) throw new ApiError(500, 'INTERNAL', error.message);
      if (!data) throw new ApiError(404, 'NOT_FOUND', 'Document not found');
      return ok(res, { document: data });
    }

    const { data, error } = await supabase
      .from('book_documents')
      .select('id, section_id, title, document_type, revision, word_count, position, updated_at')
      .eq('project_id', project.id)
      .order('position', { ascending: true });
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { documents: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = String(body.title || 'Untitled').trim() || 'Untitled';
    let position = body.position;
    if (typeof position !== 'number') {
      const { count } = await supabase
        .from('book_documents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id);
      position = count || 0;
    }

    const html = `<h1>${title}</h1><p>Start writing here...</p>`;
    const { data, error } = await supabase
      .from('book_documents')
      .insert({
        project_id: project.id,
        section_id: body.section_id || null,
        title: title.slice(0, 200),
        document_type: body.document_type || 'flow',
        content_json: { format: 'html', html, updated_at: new Date().toISOString() },
        layout_json: {},
        revision: 1,
        word_count: countWords(html),
        position
      })
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { document: data }, 201);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const docId = body.id;
    if (!docId) throw new ApiError(400, 'VALIDATION_ERROR', 'Document id is required');

    const { data: existing, error: fetchError } = await supabase
      .from('book_documents')
      .select('id, revision, content_json')
      .eq('id', docId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (fetchError) throw new ApiError(500, 'INTERNAL', fetchError.message);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Document not found');

    if (body.expected_revision != null && body.expected_revision !== existing.revision) {
      throw new ApiError(409, 'REVISION_CONFLICT', 'This document was updated elsewhere. Reload to continue.');
    }

    const updates = {
      revision: existing.revision + 1,
      updated_at: new Date().toISOString()
    };
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 200);
    if (body.content_json && typeof body.content_json === 'object') {
      updates.content_json = body.content_json;
      updates.word_count = countWords(body.content_json.html);
    }
    if (Number.isInteger(body.position)) updates.position = body.position;
    if (body.section_id !== undefined) updates.section_id = body.section_id;
    if (body.layout_json && typeof body.layout_json === 'object') updates.layout_json = body.layout_json;

    const { data, error } = await supabase
      .from('book_documents')
      .update(updates)
      .eq('id', docId)
      .eq('project_id', project.id)
      .select('id, section_id, title, revision, word_count, updated_at')
      .single();

    if (error) throw new ApiError(500, 'INTERNAL', error.message);

    if (updates.word_count != null) {
      const { data: docs } = await supabase
        .from('book_documents')
        .select('word_count')
        .eq('project_id', project.id);
      const total = (docs || []).reduce((sum, d) => sum + (d.word_count || 0), 0);
      await supabase.from('projects').update({ word_count: total }).eq('id', project.id);
    }

    return ok(res, { document: data });
  }

  if (req.method === 'DELETE') {
    const docId = req.query.id;
    if (!docId) throw new ApiError(400, 'VALIDATION_ERROR', 'Document id is required');
    const { error } = await supabase
      .from('book_documents')
      .delete()
      .eq('id', docId)
      .eq('project_id', project.id);
    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { deleted: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
