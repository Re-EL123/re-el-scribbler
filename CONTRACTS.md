# Internal Module Contracts (Re-EL Scribbler)

All frontend modules are native ES modules, relative imports, no build step.
Vendored UMD libs are loaded via classic `<script>` tags in HTML and accessed as globals:
`window.supabase`, `window.DOMPurify`, `window.PDFLib`, `window.JSZip`, `window.Sortable`, `window.lucide`.

Backend: Node ESM (`"type": "module"`), 10 API entry points under `/api`, shared code under `/lib`.

## Event bus (`js/core/event-bus.js`)
```js
export const bus = { on(evt, fn), off(evt, fn), emit(evt, payload) }
```
Known events: `doc:changed`, `doc:saved-local`, `doc:saved-cloud`, `save:status`, `selection:changed`,
`project:opened`, `structure:changed`, `stats:updated`, `notify`, `navigate`.

## Store (`js/core/state-manager.js`)
```js
export const store = {
  get(path), set(path, value), update(path, fn),
  subscribe(pathOrFn, cb) -> unsubscribe, snapshot()
}
```
Root state: `{ route, user, project, structure, activeSectionId, activeDoc, saveStatus, stats, prefs }`

## Notifications (`js/core/notifications.js`)
```js
export function notify({ type: 'info'|'success'|'warn'|'error', title, message, timeout, actions })
```

## Router (`js/core/router.js`)
```js
export function navigate(url), currentRoute(), initRouter(onChange)
```

## Utils
```js
// js/utils/validation.js
export function validateEmail(v), validatePassword(v), validateProjectInput(input),
  validateDocument(doc), validateExportSettings(s)  // -> { ok, errors: string[] }
// js/utils/sanitisation.js
export function sanitizeHtml(html), sanitizeDoc(doc)   // whitelist, strips scripts/handlers
// js/utils/date-utils.js
export function formatDate(iso), formatRelative(iso), nowIso()
// js/utils/file-utils.js
export function formatBytes(n), downloadBlob(blob, name), readFileAsText(file),
  readFileAsDataURL(file), imageDimensions(file) // -> {width,height}
```

## Document model (`js/editor/document-schema.js`) — SOURCE OF TRUTH
```js
export const NODE = { DOC, PARAGRAPH, HEADING, BULLETS, ORDERED, ITEM, QUOTE, CODE, HR, IMAGE, TABLE, PAGEBREAK, CITATION, FOOTNOTEREF, TEXTBOX }
export function createDoc(blocks = []), createBlock(type, attrs, content), text(s, marks)
export function emptyDoc(), isValidDoc(doc), sanitizeDocNode(node)
export function docToHTML(doc), htmlToDoc(html), docToPlainText(doc)
export function countWords(docOrHtmlOrString), walkDoc(doc, visit)
export function extractHeadings(docOrDocs) // [{level, text, sectionId, position}]
```
Doc shape: `{ type:'doc', content:[ ...blocks ] }`.
Marks: `bold italic underline strike code link{href} sub sup color{value} highlight{value}`.
Heading attrs: `{ level: 1..4, textAlign }`. Paragraph attrs: `{ textAlign, lineHeight, spacingAfter, indent }`.
Image attrs: `{ src, alt, caption, width, height, align, wrap, assetId }`.

## Page layout (`js/editor/page-layout.js`)
```js
export const PAGE_PRESETS = { a4:{w:595.28,h:841.89}, a5:{...}, 'us-letter':{...}, 'us-trade':{...}, square:{...} } // points (1in=72pt)
export function resolvePageSpec(settings) -> { width, height, margins:{top,right,bottom,left}, orientation, unit }
export function mmToPt(inchesOrMm), ptToMm, ptToIn, formatDim(pt, unit)
```

## Pagination (`js/editor/pagination.js`)
```js
export function paginate(doc, pageSpec, measureFn) -> { pageCount, breaks:[{blockIndex, offset}] , pages:[{heightUsed}] }
export function renderPageMarkers(container, breaks)
```
`measureFn(text, style)` returns px/pt width; layout engine must not depend on DOM when `measureFn` is provided.

## Page numbering (`js/pages/page-numbering.js`)
```js
export function formatNumber(n, style) // 'arabic'|'roman-lc'|'roman-uc'|'none'
export function computePageNumbers(sections, opts) // -> [{ sectionId, docId, printed }]
```
Independent of internal IDs (spec §9.3, §5).

## Formatting (`js/editor/formatting.js`)
```js
export function applyMark(mark, attrs), setBlockType(type, attrs), toggleList(type),
  setAlignment(a), indent(delta), clearFormatting(), insertLink(href), exec(cmd, value)
export function queryActive() // -> { marks:Set, blockType, align }
```

## Undo (`js/editor/undo-manager.js`)
```js
export const undoMgr = { push(label, snapshotFn), undo(), redo(), canUndo(), canRedo(), onChange(fn) }
```

## Selection (`js/editor/selection-manager.js`)
```js
export function getSelectionInfo(root), saveSelection(root), restoreSelection(root),
  selectNode(el), selectedText()
```

## Shortcuts (`js/editor/keyboard-shortcuts.js`)
```js
export function initShortcuts(map, root) // map: { 'mod+s': fn, ... }
```

## Document service (`js/editor/document-service.js`)
```js
export async function loadSectionDocs(projectId, sectionId) // -> Doc[]
export async function saveDoc({ projectId, docId, expectedRevision, content }) // -> {revision, savedAt}|throws ApiError
export function getCachedDoc(docId)
```

## Editor controller (`js/editor/editor-controller.js`)
```js
export async function initEditor(projectId) // boots navigator, toolbar, canvas, inspector, autosave
export function getActiveDoc(), getBookState()
```

## Persistence
```js
// js/persistence/indexeddb.js  (raw IDB, DB 'scribbler', stores: projects, docs, queue, meta)
export async function idbGet(store, key), idbPut(store, value), idbDelete(store, key),
  idbGetAll(store), idbByIndex(store, index, value), idbClear(store)
// js/persistence/autosave.js
export function initAutosave({ getDoc, saveLocal, saveCloud, onStatus }) // debounced 1.5s cloud / 300ms local
export function flushNow(), destroy()
// js/persistence/cloud-sync.js
export async function api(path, { method, body, token }) // fetch wrapper -> json; throws {code,message,status}
export function queuePush(job), flushQueue(), getQueueLength()
// js/persistence/conflict-resolution.js
export function detectConflict(local, remote), renderConflictDialog(opts) // -> Promise<'local'|'remote'|'both'>
// js/persistence/revision-history.js
export async function createRevision(projectId, label, snapshot), listRevisions(projectId), restoreRevision(id)
```

## Media
```js
// js/media/asset-manager.js
export async function listAssets(projectId), uploadAsset(projectId, file), deleteAsset(id), getAssetUrl(asset)
// js/media/image-editor.js
export function initImageEditor({ getSelection, onChange }), applyImageProps(el, props)
// js/media/drawing-engine.js
export function initDrawing(canvasEl, opts) -> { setTool, setStyle, serialize(), restore(data), undo, redo, destroy }
```
Stroke JSON: `{ type:'freehand'|'line'|'arrow'|'rect'|'ellipse'|'triangle'|'text', color, strokeWidth, opacity, fill, points:[{x,y}], ... }`

## Publishing
```js
// js/publishing/table-of-contents.js
export function generateTOC(book) -> [{level,title,page,sectionId}], renderTOC(entries, opts)
// js/publishing/references.js
export function formatCitation(ref, style, n), citationStyles(), insertCitationUI(projectId)
// js/publishing/bibliography.js
export function generateBibliography(refs, style) -> string[]
// js/publishing/pdf-export.js
export async function exportPdf({ book, docs, settings, mode, onProgress }) -> Blob
export async function exportBackup(book, docs, assets) -> Blob  // .scribbler.zip via JSZip
export async function importBackup(file) -> { book, docs }
// js/publishing/cover-designer.js
export function initCoverDesigner(root, project) -> { getDesign, setDesign }
```

## Writing
```js
// js/writing/spell-checker.js
export function initSpellcheck({ root, lang, dictionary }), scanBook(docs), ignoreWord(w), addWord(w)
// js/writing/writing-statistics.js
export function computeStats(docs, target) -> { words, chars, charsNoSpace, sentences, paragraphs, avgSentence, readingMinutes, target, progress }
// js/writing/writing-assistant.js
export async function requestAssist({ action, scope, text }) // POST /api/assistant
```

## Auth (`js/auth/auth-service.js`)
```js
export async function signIn(email, password), signUp(email, password, name), signOut(),
  getSession() // -> { user, token } | null  (guest mode returns { user:{id:'guest',...}, token:null })
export function isGuest(), getToken()
```
Guest mode: when `CONFIG.supabaseUrl` empty OR sign-in fails -> local guest session, everything in IndexedDB.

## Projects (`js/projects/project-service.js`)
```js
export async function listProjects({ filter, search }), createProject(input), updateProject(id, patch),
  deleteProject(id, { permanent }), restoreProject(id), duplicateProject(id)
```
Each falls back to IndexedDB when API unavailable (offline/local mode).

## API conventions
Request/response per spec §18.3. Error: `{ success:false, error:{ code, message } }`.
Codes: `UNAUTHENTICATED FORBIDDEN NOT_FOUND VALIDATION_ERROR REVISION_CONFLICT RATE_LIMITED PAYLOAD_TOO_LARGE INTERNAL AI_NOT_CONFIGURED`.
Status: 400/401/403/404/409/413/429/500.

## Backend lib
```js
// lib/errors.js  -> class ApiError(status, code, message), sendError(res, err)
// lib/auth.js    -> async authenticate(req) -> { userId, email } (Bearer JWT via supabase.auth.getUser)
// lib/authorization.js -> async requireProjectAccess(req, projectId, minRole) -> { userId, project }
// lib/supabase.js -> adminClient(), userClient(token)
// lib/validation.js -> zod schemas + parseBody(schema, body)
// lib/rate-limit.js -> rateLimit(key, {limit, windowMs}) -> boolean
// lib/services/*.js -> business logic per domain
```
