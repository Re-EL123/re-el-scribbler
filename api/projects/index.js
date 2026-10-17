import { withApi } from '../../lib/handler.js';
import { ok, fail, ApiError } from '../../lib/respond.js';
import { requireUser } from '../../lib/auth.js';
import { serviceClient } from '../../lib/supabase.js';

const PAGE_PRESETS = {
  a4: { width: 595.28, height: 841.89 },
  a5: { width: 419.53, height: 595.28 },
  'us-letter': { width: 612, height: 792 },
  'us-trade': { width: 432, height: 648 },
  custom: { width: 432, height: 648 }
};

function emptyDocHtml(title) {
  return `<h1>${title}</h1><p>Start writing your book here...</p>`;
}

export default withApi(async (req, res) => {
  const user = await requireUser(req);
  const supabase = serviceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw new ApiError(500, 'INTERNAL', error.message);
    return ok(res, { projects: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const authorName = String(body.author_name || '').trim();

    if (!title) throw new ApiError(400, 'VALIDATION_ERROR', 'Book title is required');
    if (!authorName) throw new ApiError(400, 'VALIDATION_ERROR', 'Author name is required');

    const pageSize = PAGE_PRESETS[body.page_size] ? body.page_size : 'us-trade';
    const settings = {
      page_size: pageSize,
      page_dimensions: PAGE_PRESETS[pageSize],
      template: body.template || 'blank'
    };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        title: title.slice(0, 200),
        author_name: authorName.slice(0, 120),
        subtitle: body.subtitle ? String(body.subtitle).trim().slice(0, 200) : null,
        description: body.description ? String(body.description).trim().slice(0, 2000) : null,
        language: body.language || 'en',
        category: body.category || 'novel',
        status: 'in_progress',
        settings
      })
      .select('*')
      .single();

    if (projectError) throw new ApiError(500, 'INTERNAL', projectError.message);

    const { data: section, error: sectionError } = await supabase
      .from('book_sections')
      .insert({
        project_id: project.id,
        parent_id: null,
        title: 'Chapter 1',
        section_type: 'chapter',
        position: 0,
        numbering_settings: {}
      })
      .select('*')
      .single();

    if (sectionError) throw new ApiError(500, 'INTERNAL', sectionError.message);

    const now = new Date().toISOString();
    const { data: document, error: docError } = await supabase
      .from('book_documents')
      .insert({
        project_id: project.id,
        section_id: section.id,
        title: 'Chapter 1',
        document_type: 'flow',
        content_json: { format: 'html', html: emptyDocHtml('Chapter 1'), updated_at: now },
        layout_json: {},
        revision: 1,
        word_count: 5,
        position: 0
      })
      .select('id, title, section_id, revision, word_count')
      .single();

    if (docError) throw new ApiError(500, 'INTERNAL', docError.message);

    return ok(res, { project, structure: { sections: [section], documents: [document] } }, 201);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
});
