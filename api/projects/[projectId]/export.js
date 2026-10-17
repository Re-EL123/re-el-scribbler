import { withApi } from '../../../lib/handler.js';
import { ok, fail, ApiError } from '../../../lib/respond.js';
import { requireOwnedProject } from '../../../lib/auth.js';

export default withApi(async (req, res) => {
  const projectId = req.query.projectId;
  const { user, project, supabase } = await requireOwnedProject(req, projectId);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const format = String((req.body && req.body.format) || req.query.format || 'html');

  const [{ data: sections }, { data: documents }] = await Promise.all([
    supabase
      .from('book_sections')
      .select('*')
      .eq('project_id', project.id)
      .order('position', { ascending: true }),
    supabase
      .from('book_documents')
      .select('*')
      .eq('project_id', project.id)
      .order('position', { ascending: true })
  ]);

  const orderedDocs = (documents || []).map((doc) => ({
    id: doc.id,
    section_id: doc.section_id,
    title: doc.title,
    revision: doc.revision,
    word_count: doc.word_count,
    html: (doc.content_json && doc.content_json.html) || ''
  }));

  if (req.method === 'POST') {
    await supabase
      .from('export_jobs')
      .insert({
        project_id: project.id,
        format,
        status: 'completed',
        source_revision: project.revision,
        settings: {},
        completed_at: new Date().toISOString()
      });
  }

  return ok(res, {
    export: {
      format,
      project: {
        id: project.id,
        title: project.title,
        subtitle: project.subtitle,
        author_name: project.author_name,
        language: project.language,
        word_count: project.word_count
      },
      sections: sections || [],
      documents: orderedDocs,
      generated_at: new Date().toISOString()
    }
  });
});
