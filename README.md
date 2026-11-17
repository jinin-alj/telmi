# Telmi

Students explain a topic **out loud, from memory**, to an AI classmate who doesn't understand it yet. A separate, strict checker compares the explanation with the teacher's own material and shows the student what they covered, missed or got wrong. Teachers see how each student is doing in each subject, so they know where to help.

> **WARNING: this app handles data about minors.** Never commit real student names, interview notes or recordings. Research material lives in `docs/`, which is gitignored on purpose. Never commit `.env`.

## Status

MVP feature-complete. Done:
- repository tooling and CI
- backend: accounts, classes and units, study sessions with the buddy and checker, the teacher dashboard and student progress
- mobile: sign-up and sign-in; the student experience (join a class, voice session with Pip, results, mascot); the teacher side (create classes, add units, class dashboard)

Each feature has its own branch, listed under "Roadmap".

## Repository layout

| Path | What it is |
| --- | --- |
| `backend/` | FastAPI API (Python 3.12) |
| `mobile/` | Expo app (React Native + TypeScript), runs on iOS, Android and web |
| `docker-compose.yml` | Local PostgreSQL |
| `.github/workflows/ci.yml` | Lint, format, type check, tests and dependency audit on every PR |
| `docs/` | Private research and rules, **gitignored** |

## Setup

Requirements: Python 3.12, Node 24, Docker Desktop, and [Ollama](https://ollama.com) with the `llama3.1:8b` model.

```bash
cp .env.example .env          # then edit the values
docker compose up -d database # start PostgreSQL
ollama serve                  # in its own terminal
```

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head      # create or update the database tables
.venv/bin/uvicorn app.main:app --reload
```

Interactive API docs: http://localhost:8000/docs

Changing a model? Generate a migration, **read it**, then apply it:

```bash
.venv/bin/alembic revision --autogenerate -m "describe the change"
.venv/bin/alembic upgrade head
```

> Alembic does not drop Postgres enum types on downgrade. Add the drop by hand, as in the users migration.

Mobile (in another terminal). In the Claude desktop app, `.claude/launch.json` starts both servers from the browser pane.

```bash
cd mobile
npm install
npm run web
```

## Checks (same as CI)

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/mypy app tests && .venv/bin/pytest
cd mobile && npm run format:check && npm run lint && npm run typecheck && npm test
```

No change merges unless every check passes.

Backend tests use in-memory SQLite by default. To run them against Postgres like CI does, point them at a **separate** test database. The tests drop every table, so never use your dev database:

```bash
docker compose exec database psql -U study_buddy -c "CREATE DATABASE study_buddy_test;"
TEST_DATABASE_URL=postgresql+psycopg://study_buddy:<password>@localhost:5432/study_buddy_test .venv/bin/pytest
```

## Deploying (free setup)

Everything runs on free tiers and stays on without anyone's laptop.

```
Phone / laptop (PWA) -> Vercel (web app)
                     -> Render, Frankfurt (API) -> Neon (database)
                                                -> Groq (AI: gpt-oss-20b for Pip, gpt-oss-120b for grading)
```

> **TEACHERS ONLY until a school signs a data processing agreement.** Groq is a US service. Anyone with the link can create an account.

**Free-tier limits**
- **The API sleeps after 15 minutes idle** and takes up to a minute to wake. The app pings it on open and says "Waking up the server" if signing in is slow.
- **Grading has a daily token budget** (about 200K tokens a day on Groq's free tier), which is roughly 15–20 graded sessions a day. When it runs out, students see "Your buddy can't answer right now" and can finish the session later.

### Steps

1. **Database:** on neon.com, create a free project in **Frankfurt** and copy the connection string.
2. **AI key:** on console.groq.com, create an API key. Under **Data Controls**, turn on **Zero Data Retention**.
3. **Backend:** on render.com, choose **New → Blueprint** and pick this repo. Fill in `DATABASE_URL` (from Neon) and `AI_API_KEY` (from Groq), and leave `CORS_ORIGINS` empty for now. Check that `https://telmi-api.onrender.com/health` shows `{"status":"ok"}`.
4. **App:** on vercel.com, create a new project from this repo with **Root Directory** `mobile`, **Framework** Other, and the environment variable `EXPO_PUBLIC_API_URL` set to `https://telmi-api.onrender.com`. Deploy.
5. **Connect:** on Render, set `CORS_ORIGINS` to the Vercel address and save.
6. **Install:** open the Vercel address on a phone. On iPhone, use Share → Add to Home Screen; on Android, use Install app.

Render only deploys `main` after CI passes, and runs database migrations on every start. Supabase also works as the database: use its **Session pooler** string (port 5432). Free Supabase projects pause after a week without use.

**Other AI providers:** any OpenAI-compatible API works through `AI_BASE_URL`, `AI_BUDDY_MODEL` and `AI_CHECKER_MODEL`. If the checker model doesn't support JSON schemas, set `AI_CHECKER_JSON_SCHEMA=false`; for models that don't reason, set `AI_REASONING_EFFORT=` to empty.

**Running the AI on a laptop instead:** `backend/gateway/ai_gateway.py` puts a locked-down gateway in front of a local Ollama. It accepts only chat requests with the key in `GATEWAY_API_KEY`. Expose it with `cloudflared tunnel --url http://localhost:8787`, then set `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL` (the tunnel address) and `OLLAMA_API_KEY` on Render. The laptop has to stay on.

The PWA files are `mobile/public/manifest.json`, the icons, and the manifest link in `mobile/public/index.html`. There's no service worker on purpose; Expo warns it can stop people getting new versions.

## Architecture

- **Mobile app** talks to the backend over HTTPS with JSON. Speech is turned into text **by the device or browser**, so the backend only ever receives text and never stores audio. Pip's voice uses the device's text-to-speech. Both cost the backend nothing per user.
- **Backend** is stateless, so it can scale horizontally behind a load balancer. PostgreSQL stores users, classes, units and session results.
- **AI models** sit behind a small interface. Locally it's Ollama; deployed it's Groq (`app/ai/hosted_model.py`), with a fast model for Pip and a stronger one for grading.
- **Buddy and checker are separate prompts.** The friendly buddy never confirms anything the strict checker hasn't verified, which protects students from AI that agrees with wrong answers.

### Accounts and sign-in

- Accounts use a **username and a nickname only**: no email or real name, to keep data on minors minimal.
- Roles are `student` and `teacher`.
- Passwords are hashed with Argon2id. Failed logins give the same error and take the same time whether or not the username exists, so usernames can't be probed.
- Sign-in returns a short-lived **access token** (30 min), sent as `Authorization: Bearer <token>`, and a **refresh token** (30 days) used only at `/auth/refresh`. Both are signed JWTs, so the API keeps no session state and can scale horizontally.

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account (`username`, `display_name`, `password`, `role`) and sign in |
| `POST` | `/auth/login` | Sign in with `username` and `password` |
| `POST` | `/auth/refresh` | Trade a refresh token for a new token pair |
| `GET` | `/auth/me` | The signed-in user |
| `GET` | `/health` | Uptime check |

### Classes, units and study sessions

1. A **teacher** creates a class and gets a six-character join code. The code avoids 0/O and 1/I/L so it can be read aloud.
2. The teacher adds **units**: a title plus their own material (50–12,000 characters), pasted or uploaded from files (see "Uploading material" below). Students never receive the material through the API, so sessions stay closed-book.
3. A **student** joins with the code, picks a unit and starts a session. The buddy, Pip, greets them with a fixed line, so there's no wait.
4. Each time the student speaks, the buddy replies with one curious question. About once every three replies it says a plausible mistake for the student to correct. It never confirms whether the student is right.
5. On **finish**, the checker grades the whole conversation against the unit's **fixed key ideas** and returns:
   - a **gap map**: key ideas marked covered or missing
   - **misconceptions**, each with a correction, including any of the buddy's planted mistakes the student agreed with
   - one exam-style **application question**
   - one **next step**
6. The student answers the application question once, and the checker grades it as correct, partly correct or incorrect.

Sessions are capped at **15 minutes and 8 student turns** (`SESSION_MINUTES`, `MAX_STUDENT_TURNS`). The cap keeps sessions short, so the app doesn't become more screen time.

| Method | Path | Who | What it does |
| --- | --- | --- | --- |
| `POST` | `/classrooms` | teacher | Create a class |
| `GET` | `/classrooms` | both | Classes you own or joined |
| `POST` | `/classrooms/join` | student | Join with a code |
| `POST` | `/classrooms/{id}/material-text` | owner teacher | Read the text from an uploaded file (saves nothing) |
| `POST` | `/classrooms/{id}/units` | teacher | Add a unit with material |
| `GET` | `/classrooms/{id}/units` | members | List units (no material) |
| `POST` | `/sessions` | student | Start a session on a unit |
| `GET` | `/sessions/{id}` | student | Conversation and feedback |
| `POST` | `/sessions/{id}/turns` | student | Send what you said, get the buddy's reply |
| `POST` | `/sessions/{id}/finish` | student | Get the gap map, question and next step |
| `POST` | `/sessions/{id}/application-answer` | student | Answer the question, get it graded |
| `GET` | `/classrooms/{id}/dashboard` | owner teacher | Class and per-student results |
| `GET` | `/progress/me` | student | Own progress and mascot |

### Uploading material

Teachers can upload files instead of pasting (`app/services/material_files.py`). The backend only **reads the text and sends it back**; it never stores the file. The text lands in the material box, where the teacher checks and trims it, and the normal "add unit" request saves it like pasted text. So the 12,000-character limit, grading and the database are unchanged.

- **Types:** PDF, Word (`.docx`), PowerPoint (`.pptx`, including speaker notes), `.txt` and Markdown (`.md`, kept as written), in UTF-8 or the older Windows encoding. Old `.doc`/`.ppt` files must be saved as the new format first. Android labels Markdown files inconsistently, so check there that `.md` files can be picked.
- **Several files:** they're read one at a time and added after the existing text, in the order picked. A file that fails doesn't stop the others; each failure is listed with its reason.
- **Limits:** files up to 20 MB. Word and PowerPoint files that would unpack to over 200 MB are refused, as protection against zip bombs. At most 60,000 characters come back per file, so a teacher can pick what to keep from a long file; if it's cut, the app says so.
- **Errors:** wrong type → 415, too big → 413, damaged, password-protected or no text → 422 with a message the app shows as is.
- **Not read:** text inside images (scanned PDFs, photos of slides), Word headers and footers, and text boxes. Scans need OCR, which isn't built yet; teachers are asked to paste instead.

**Fixed key ideas.** The first time any session on a unit finishes, the model extracts 3–8 key ideas from the material. They're stored on the unit (`units.key_ideas`), and the row is locked during extraction so two students finishing at once can't get different lists. Every later session is graded on that same list, which is what makes results comparable across students. Adding a unit never waits on the model.

### Teacher dashboard and student progress

A student's standing on a unit is their **latest** finished session, so earlier struggles don't hold them back.

- **Per unit (class view):** how many students attempted it and their average coverage. For each key idea: how many students covered or missed it, how many misconceptions about it, and up to three **anonymous** examples. Misconceptions that don't match any idea are listed separately.
- **Per student:** sessions completed, latest coverage and missing ideas per unit, and an average across the units attempted.
- Students are **listed by name, never ranked**. There are no leaderboards, no streaks and no time-spent metrics; the research flagged ranking and labelling as harms.
- **Mascot:** grows one level per 5 distinct key ideas the student has explained correctly, across all their sessions. Time in the app doesn't count. The app decides what each level looks like.

Anything a user isn't allowed to see answers **404, not 403**, so outsiders can't tell whether a class or session exists.

### AI layer (`backend/app/ai/`)

- `chat_model.py`: the `ChatModel` interface. To use a hosted model, subclass it and return the new class from `get_chat_model()` in `app/dependencies.py`.
- `ollama_model.py`: the Ollama adapter. It raises Ollama's context window to 8,192 tokens, because the default is too small for material plus a conversation.
- `buddy.py`: the friendly buddy (temperature 0.7).
- `checker.py`: the strict checker (temperature 0). Its output is forced into a JSON schema, validated with Pydantic and retried once if malformed. If it fails twice, the app gets a 503 and the session stays open.
- `transcript.py`: student text is escaped and wrapped in `<student>` tags, so it can't close the tags and slip in instructions.
- `attribution.py`: **no student is blamed for words they didn't say.** Before feedback is saved, each misconception's "You said" quote is checked against the transcript. It's kept only if at least 60% of its words (of 3+ letters) appear in the **student's** turns, and it matches the student at least as well as the buddy. This drops the buddy's planted mistakes and anything the model invented. A student who repeats the buddy's wrong idea in their own words is still caught. A plain "yes" to the buddy's mistake is not caught; that's deliberate, because missing it is better than misquoting a child. The log records only how many items were dropped, never their text.

If the model fails, the app gets a **503 and nothing is saved**, so the student can simply retry.

### Mobile app (`mobile/src/`)

| Path | What it is |
| --- | --- |
| `app/` | Screens (Expo Router). `_layout.tsx` uses `Stack.Protected`, so signed-out users only reach sign-in and sign-up, and signed-in users only reach the app. |
| `api/client.ts` | JSON client: adds the access token, refreshes it once on a 401 and retries. Parallel 401s share one refresh. |
| `auth/auth-context.tsx` | Session state, sign-in, sign-up and sign-out. Restores a saved session on launch while the splash screen stays up. |
| `auth/token-storage.ts` / `.web.ts` | Where the refresh token lives (see below). |
| `auth/validation.ts` | The same username, password and nickname rules as the backend, so errors show before sending. |
| `components/` | Accessible text field, button, role picker and page wrapper. |
| `theme.ts` | Colours that meet WCAG 2.1 AA contrast, and the 44-point minimum touch size. |

### Student experience

- **Home** (`features/student/`): Pip's card (level and ideas understood), each class with its units, "Last time: 4 of 6 key ideas", the next step, and a join-by-code form. It reloads every time the screen comes back into view.
- **Session** (`app/session/[sessionId].tsx`, `features/session/`):
  - Pip's latest line is shown large and read aloud.
  - The student taps the microphone, explains, taps again, checks what was heard, fixes any mistakes in the transcript, then sends.
  - "Type instead" is always available, and becomes the default where speech recognition isn't supported.
  - Turns and minutes left are shown. The conversation is hidden unless asked for, to keep the screen quiet.
  - Language can be English or Español; it defaults from the device.
  - Pip's voice can be turned off, and speech stops when the student leaves the screen.
- **Results:**
  - "You explained X of Y key ideas"
  - each idea marked *Explained* or *Still to explain*, in words and not just colour
  - "Things to fix" (*You said / Actually*)
  - the next step, read aloud
  - the exam-style question, answered the same way and then graded
  - "Explain it again"
- **Speech layer** (`speech/`): screens never use the speech libraries directly. `use-speech-to-text.ts` wraps `expo-speech-recognition`, `text-to-speech.ts` wraps `expo-speech`, and `transcript.ts` holds the pure rule for joining phrases. `speech-module.ts` loads the recognition library **only if its native code is in the build**. Loading it without that code crashes the app, so builds without it (like Expo Go) get typing instead.

### Teacher experience

- **Home** (`features/teacher/teacher-home.tsx`): the teacher's classes, each with its join code in large spaced letters, and a "Create a class" form. Creating a class opens it straight away.
- **Class screen** (`app/classroom/[classroomId].tsx`):
  - the join code and number of students
  - a reminder that results come from AI and are not grades
  - **Units:** each card shows how many students explained it and the average share of key ideas. "Show key ideas" lists each idea with a bar ("3 of 8 students explained this"), its common mistakes, and up to three anonymous examples. "Add a unit" opens a form for a title and the teacher's material, with a live character count (50–12,000). "Upload a file" adds the text of one or more files to the box for the teacher to check before saving; saving waits until uploads finish.
  - **Students:** listed by name, never ranked. Each shows their latest result per unit ("4 of 6 key ideas") and the ideas still to explain.
- **Role guards:** `_layout.tsx` nests `Stack.Protected`, so only students reach `session/[sessionId]` and only teachers reach `classroom/[classroomId]`. The API enforces the same rules; the guards just keep people off screens they can't use.

> **PRIVACY: on the web, Chrome sends the audio to Google's servers to recognise it; Safari uses Apple's.** Telmi never receives or stores audio, but the browser vendor does process it. That is a GDPR consideration for minors: tell schools and families, and prefer on-device recognition in the native apps (the `requiresOnDeviceRecognition` option) before launch.

**Where voice works:** Chrome and Safari on desktop, and Chrome on Android. It doesn't work in Firefox or Brave, or in Chrome on iPhone; those users get the typing box. **In Expo Go, students type and Pip still speaks.** Expo Go doesn't include the speech recognition native code, so the app detects that and switches to typing. To talk on a phone, use a development build (`npx expo run:ios|android`, or `npx eas-cli@latest build --profile development`).

**Token storage.** The access token is kept **in memory only**. The refresh token goes in the device keychain on iOS and Android (`expo-secure-store`). On web it goes in `sessionStorage`, which survives a reload but is cleared when the tab closes. That's safer than `localStorage`, but any script running on the page could still read it. Before a public web launch, move it to an `HttpOnly` cookie set by the backend.

To point the app at another backend, set `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`).

## Inputs and outputs

- Input: a student's spoken explanation of a unit, and the teacher's material for that unit.
- Output: buddy follow-up questions, then a gap map (covered, missing, incorrect), one application question and one next step. Teachers get per-subject coverage and recurring misconceptions.

## Known limitations

- Ollama on a laptop serves only a few sessions at once and an 8B model makes a weak checker. Switch to a hosted model before real users.
- **Checker accuracy is unmeasured, and with `llama3.1:8b` it is not good enough for teachers yet.** Live tests separated a strong student (67%) from a weak one (17%) correctly. But the model also:
  - under-credited an idea the student did explain
  - flagged correct statements as misconceptions
  - once attributed the buddy's planted mistake to the student

  Before any teacher sees scores: switch to a stronger model, then have teachers grade 100–200 explanations and compare them with the checker's.
- Sessions graded before a unit had fixed key ideas are left out of idea-level tallies (they still count for coverage).
- The dashboard is computed on each request. That's fine for class-sized data; cache it if classes get very large.
- The first model call after Ollama starts takes about 15 seconds while the model loads. After that, buddy replies take about 1 second and the checker about 9 seconds on an M-series Mac.
- Model calls block a worker thread while they wait. That's fine for the MVP; at scale, run more workers or move these routes to async.
- Voice has been tested only by its code paths and unit tests; nobody has yet spoken into it end to end. Phones need an Expo development build.
- **The checker sometimes flags a correct statement as a misconception.** The attribution guard makes sure the quote is the student's, but it can't tell whether the statement is actually wrong. Simple word comparisons would also throw away real mistakes like "more energy" versus "less energy". A stronger model is the fix.
- Sessions finished before the attribution guard existed still contain any misattributed quotes; only new sessions are filtered.
- **No login rate limiting yet.** Add it at the gateway (or with Redis) before launch; see the `TODO` in `app/routers/auth.py`.
- **No password reset**, because accounts have no email. A teacher-led reset is a possible follow-up.
- **Tokens can't be revoked early.** A stolen refresh token works until it expires. A server-side denylist would fix this if needed.
- Anyone can sign up as a teacher. Teachers only see classes that students choose to join.
- Starlette prints a deprecation warning about `httpx` in tests. It is harmless; the suggested replacement has not been vetted yet.

## Maintenance

- CI runs `pip-audit` and `npm audit` for known vulnerabilities.
- `npm audit` currently reports issues inside the Expo CLI (build tooling, not shipped code). The audit step is non-blocking until Expo patches them.

## Roadmap (branches)

1. `chore/repo-setup`
2. `feat/backend-auth`
3. `feat/backend-study-sessions`
4. `feat/backend-teacher-dashboard`
5. `feat/mobile-auth`
6. `feat/mobile-study-session`
7. `feat/mobile-teacher-dashboard`
