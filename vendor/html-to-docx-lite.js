// Simple HTML->DOCX-ish approach: use Blob with Office Open XML minimal? Easier: generate via data URI using html-docx-js legacy not installed
// Alternative: export as RTF-like simple; but better use a tiny implementation: construct download with plain text + basic? 
// We'll implement a minimal DOCX generator via zip? Or use pdf-lib + render? pdf-lib exists; also we can generate PDF via browser print? 
// Or create a simple DOCX file using Blob and Office XML (minimal)
export function htmlToDocxBlob(html, title='Document') {
  const safe = String(html||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const content = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${safe}</w:t></w:r></w:p></w:body></w:document>`;
  return new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
