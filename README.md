# Re-EL Scribbler

Re-EL Scribbler is a professional book writing, document composition, and publishing platform. Write freely. Organise intelligently. Design beautifully. Publish confidently.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Vercel Serverless Functions (max 12)
- **Database/Auth/Storage**: Supabase
- **PDF Generation**: pdf-lib
- **Rich Text**: ProseMirror/Tiptap compatible structure (planned)
- **Local Storage**: IndexedDB (Dexie.js)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env.local`:
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

## Project Structure

See the complete specification in `/home/akani/Documents/scribbler/Re EL Scribbler Complete.md`

## License

Proprietary - Re-EL Branding & Technologies
