# DAFS Lesson Note AI

Production-ready teacher lesson-note application for DESTINY ACHIEVERS FOUNDATION SCHOOL.

## Database: Neon PostgreSQL
This version is configured for **Neon PostgreSQL**. The application uses the standard PostgreSQL driver (`pg`), which connects directly to Neon using Neon's PostgreSQL connection string. No Render PostgreSQL database is required.

Set `NEON_DATABASE_URL` to the connection string copied from the Neon dashboard. The app also accepts `DATABASE_URL` as a backward-compatible fallback, but `NEON_DATABASE_URL` is preferred.

The application automatically creates its required tables (`users`, `notes`, and the session table used by the session store) when it starts.

## Real services used
- Neon PostgreSQL for teacher accounts, sessions and saved lesson notes.
- Google Gemini API for lesson-note and examination generation.
- Optional Google OAuth only when the school administrator supplies real Google OAuth credentials.
- Server-side role enforcement for Teacher and Principal/Admin access.

## Required deployment environment variables
- `NODE_ENV=production`
- `NEON_DATABASE_URL` — your Neon pooled PostgreSQL connection string
- `SESSION_SECRET` — a long random secret
- `GEMINI_API_KEY` — your Gemini API key from Google AI Studio
- `GEMINI_MODEL` — defaults to `gemini-3.8-flash`
- `GEMINI_FALLBACK_MODEL` — defaults to `gemini-2.5-flash-lite`
- `ADMIN_EMAIL` — the Principal/Admin email
- `ADMIN_PASSWORD` — the Principal/Admin password
- `ADMIN_NAME` — the Principal/Admin display name

Optional Google Sign-In:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

Do not put real secrets in GitHub or in this ZIP.

## Neon setup
1. Create a project in Neon.
2. Create/select the production branch and database.
3. In Neon, open **Connect**.
4. Select the Node.js/Postgres connection details and copy the **pooled connection string** when available.
5. Add that complete connection string to your deployment platform as `NEON_DATABASE_URL`.
6. Keep the connection string private.

The connection string commonly begins with `postgresql://` and contains your Neon host and credentials. Do not manually edit it unless you know exactly why.

## Render hosting + Neon database
Render is only the web host in this setup. **Do not create a Render PostgreSQL database.**

Create a Render Web Service from this repository and set:
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/healthz`

Then add the environment variables listed above. The included `render.yaml` does not provision a Render database; it asks for `NEON_DATABASE_URL` instead.

## Local setup
1. Install Node.js.
2. Run `npm install`.
3. Create `.env` from `.env.example` and fill in real values.
4. Run `npm start`.
5. Open the URL shown by the server.

## Important curriculum note
The application contains the school's class, term and subject selections. It does not fabricate a Lagos State weekly scheme-of-work mapping. Teachers should use the school's verified current scheme of work for the exact weekly sequence and references.


## Lagos State scheme-driven lesson generation
The lesson generator provides Week 1–12 for KG 1, KG 2, Nursery 1, Nursery 2 and Primary 1–5 class, term and subject selection. For First Term, matching entries from the uploaded school scheme are loaded first. Volume 1 is mapped to KG 1, Volume 2 to KG 2, Volume 3 to Nursery 1 and Volume 4 to Nursery 2; the separately labelled Primary 1–Primary 5 tables map to their named classes. For other terms, matching entries in `data/lagos_scheme.json` are loaded into the editable fields. When an exact entry is not present, the teacher can enter the school's verified scheme topic and scheme-based learning objectives manually. The AI is instructed not to invent or falsely label missing curriculum information as an official Lagos State entry.

**Current data limitation:** this package contains the uploaded First Term school scheme mapped to KG 1, KG 2, Nursery 1, Nursery 2 and Primary 1–5, plus the older reference entries in `lagos_scheme.json`; it is not a complete three-term, all-subject, Week 1–12 Lagos State curriculum database. To have automatic official topics/objectives for every week, replace or extend this catalog with the school's current verified scheme documents.


## Current lesson-note subjects
The curriculum catalog includes Security Education and History in addition to the existing DAFS subjects. Security Education was already present in the catalog; History was added in this revision. Subjects are served by `/api/curriculum` and therefore populate the generator from the backend catalog. No unverified Lagos State scheme entries are fabricated for the newly added subjects; teachers can supply the school's verified topic/objectives when an exact scheme entry is not in the catalog.

## Examination Generator

The portal now includes `exam.html` / `exam.js`. Teachers can choose a Basic class, term and one or more subjects, load their saved weekly lesson notes, keep all matching saved weeks selected, and generate each subject from its own saved weekly content so one subject cannot crowd another subject out of the AI source context. Principal/Admin accounts can use the same generator with school-wide saved notes.

The examination preview follows the supplied DAFS sample layout: school logo at the upper left, school name and examination title centered, subject line, Name/Date line, objective multiple-choice sections with A-D options, and a separate THEORY section. The generated paper can be downloaded as a Microsoft Word `.docx` file.

The server uses the `docx` npm package for Word document creation. Render will install it from `package.json` during deployment.

### Examination Generator defaults
- Objective questions per subject: **20**
- Theory questions per subject: **4**
These are the default values shown on the Examination Generator page and can still be changed within the allowed ranges.


## Professional production safeguards
- Server-side role guards protect Principal/Admin pages and APIs; teachers cannot elevate themselves to admin.
- First Term uploaded scheme topics are authoritative for KG 1, KG 2, Nursery 1, Nursery 2 and Primary 1–5, with exact source identity preserved when a parallel scheme entry is selected.
- First Term entries without explicit objectives no longer block generation; the AI creates objectives from the exact uploaded topic.
- Authentication and AI generation have lightweight abuse/double-submit protection.
- Security headers include CSP, HSTS in production, frame protection, MIME sniffing protection, and a restrictive Permissions Policy.
- Principal note bodies are loaded only when the Principal opens a note, keeping the administration overview fast as the library grows.
- Examination generation is protected against concurrent duplicate requests and validates subjects against the selected class/term.
- The project is statically audited with JavaScript syntax checks, JSON validation, HTML asset/ID checks, curriculum integrity checks and project-specific quality checks.

### Current curriculum scope
The school-uploaded First Term material is authoritative for the nine supported classes. Volume 1 maps to KG 1, Volume 2 to KG 2, Volume 3 to Nursery 1, Volume 4 to Nursery 2, and the labelled Primary 1–5 tables map to their respective classes. Second and Third Term remain available through the existing catalog until the school supplies their official schemes.
