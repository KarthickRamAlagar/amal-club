# AMAL Club — multi-role platform

Website + operations platform for **AMAL — Amrita Management & Leadership Club**, Amrita Vishwa Vidyapeetham, Bengaluru.

The site keeps the original crimson theme with dark and light modes. It runs entirely on free tiers:

| Piece | Service | Free tier |
|---|---|---|
| Sign-in (members: AMAL ID + password · participants: Google) | Firebase Auth (Spark) | ✔ |
| Database + security rules | Cloud Firestore (Spark) | ✔ 50k reads / 20k writes per day |
| Images (only the public URL is stored in Firestore) | Cloudinary | ✔ 25 credits/month, no card |
| Hosting + server API + daily job | Vercel Hobby | ✔ |
| AI text (primary → fallbacks) | Gemini → Groq → OpenRouter | ✔ free keys |
| AI images (primary → fallbacks) | Gemini → Cloudflare Workers AI → Pollinations | ✔ |
| Stock photos | Unsplash API | ✔ 50 requests/hour |

> Firebase **Storage** is not used: since late 2024 it needs the paid Blaze plan. Images go to Cloudinary instead.

---

## 1. What it does

### Roles

The hierarchy is **Faculty Admin (100) > President (80) > Vice President = Treasurer (70) > Team Lead (40) > Team Member (20)**. Participants sign in with Google and don't belong to a team.

| Can… | Admin | Club Reps (Pres / VP / Treasurer) | Team Lead | Member |
|---|---|---|---|---|
| Invite | Club Reps, Leads, Members | Leads, Members | Members of **own team** | – |
| Retain / Release (per team, per academic year) | everyone incl. Club Reps | Leads & Members | – | – |
| Create events | ✔ | ✔ | – | – |
| Edit an event | if rank ≥ creator | if rank ≥ creator | – | – |
| Disable event · confirm payments · CSV · event chat | ✔ | ✔ | ✔ | – (can view registrations) |
| Create forms | unlimited | 3/day, then code | Technical Lead: 3/day, others: code | code |
| Approve form requests | ✔ `ADMIN-AMAL-####` | ✔ `OB-AMAL-######` | Technical Lead `TTL-AMAL-####` | – |
| Media studio (Canva, Video Studio, uploads) | ✔ | ✔ | every Team Lead ✔ | Media & Design team ✔ (others: view) |
| Documentation desk (diary + reports) | ✔ | ✔ | Documentation Lead ✔ | Documentation team ✔ |

### Main flows

1. **Invite → join → onboarding.**
   - Admin enters a name and email and gets a one-time invite code to share by WhatsApp, email or copy.
   - The person opens `/join`, enters the code, chooses an **AMAL ID** and password, then completes **onboarding**: full name, year, department, college ID, contact, college email, photo, LinkedIn and a short description.
   - College ID must match `BL.…` and end with 4 digits.
   - Until onboarding is done they can browse the site but can't do anything.
2. **Club Tree on the landing page** shows Admin → Club Reps → Team Leads (name, year, email). Clicking anyone opens their member card. Team pages show lead → members.
3. **Retain / Release.** Each academic year, review one team at a time. Released members lose dashboard access, but their history and logs stay. Mistakes can be restored.
4. **Events.**
   - Created by Admin / Club Reps with:
     - name, short and full description, rules, venue, date
     - price and payment QR / UPI
     - online and on-spot intake, team size, prizes
     - sponsors (logo uploaded or from Unsplash)
     - banner (upload, Unsplash, or AI; AI is limited to **2 per person per month**)
   - Every action is logged with an actor card (photo, name, designation, email).
5. **Registration.**
   - The poster QR leads to `/form/<event>`, which opens the event page → **CLICK TO REGISTER** → Google sign-in → team details and photos.
   - Online registration closes at **11:50 PM IST the night before**. After that the page shows a "register on spot" card.
   - On-spot desk QR: `/events/<event>/chat?onspot=1` opens the details form inside the chat.
6. **Event chat** (WhatsApp-style, AMAL logo).
   - Members: Admin, Club Reps, all Team Leads, and every registered team.
   - Teams send payment details (UTR + screenshot). Staff press **Confirm & tag**, and the team is @-tagged in the chat.
   - Unverified teams are **auto-dropped after 5 hours**.
   - Staff can share live location, send addresses and tag teams.
7. **Disable event** (Admin / Club Reps / Leads): registration stops, the event moves to **Past events**, and its forms switch to "Event completed". The CSV download is logged with who downloaded it.
8. **Forms.**
   - AMAL's own builder, prefilled from the selected event.
   - People who need permission request it with a reason. Approvers allow (one-time code, valid 24h) or deny (reason required). The requester sees a decision card with the approver's photo, name, email, AMAL ID and designation.
   - If several approvers allow, the highest rank is credited.
   - The logs page has search, status filters (In use / Allowed / Denied / Event completed / Pending) and pagination.
9. **Media studio** (replaces the old AI poster studio).
   - **Canva:** each member connects their *own* Canva account once. They can create a new poster or video for an event at the right size (Instagram post / square / story, LinkedIn, A4 print, Reel, square or landscape video), see all their past Canva designs, and reopen any design. When they press **Return** in Canva they come back to AMAL. **Download & save to event** asks Canva for the file at the size and format they pick (PNG/JPG/PDF/GIF/MP4), gives them the download, and copies the same file to Cloudinary. Only that URL is stored, and the editable design stays in Canva. **Send event QR + logo to my Canva** puts the registration QR, the AMAL logo and the event banner into their Canva uploads.
   - **Video Studio** (`/dashboard/media/video`): an in-browser editor built on the open-source **ffmpeg.wasm**. You can add clips and photos, trim them, reorder them, fade between them, add a title + gold sub-line, a bottom caption, the round AMAL logo badge and background music, then export an MP4 for Reels (9:16), Instagram (4:5), square or landscape at 720p or 1080p. Clips never leave the device until the final video is saved. It also reads clips the browser itself can't play (e.g. iPhone HEVC).
   - **Upload:** finished files made in the free open-source desktop editors **Shotcut**, **Kdenlive** or **OpenShot** (or anywhere else). Videos can be up to 100 MB.
   - Everything saved shows up automatically in the event's **Posters & videos** section: on the public event page (if Public) and on the dashboard event page. Media can be hidden (team only) or removed, and every action is logged.
10. **Documentation desk** (`/dashboard/documentation`), for the Documentation & Report team, Club Reps and the Admin.
   - **Daily diary:** every event's history is built automatically and grouped by IST day: registrations, payment confirmations / drops, forms and responses, chat activity, media saved, edits (with who did it). The team adds their own notes per day (guests, highlights, issues). **AI day summary** writes a short summary from those facts only.
   - **Full context:** description, rules, key facts, every registration (team, leader, college, status), forms with response counts, posters/videos, AI planning cards and everyone involved.
   - **Report:** a Word-style editor that opens **pre-filled**. It includes the header table, overview, event details, rules, a live participation table, day-by-day highlights, a winners table, the media list, feedback, acknowledgements and signature blocks. It has headings, bold/italic/underline, colours, highlight, lists, quotes, tables (add/remove rows and columns), images and links. It autosaves to `/reports/{event}` and warns if a teammate saved a newer version. **AI draft** writes a section from the recorded facts. **Download as PDF** (print → Save as PDF, A4), **Word (.docx)**, HTML, Markdown or plain text.
11. **AI planning.**
    - At 12:05 AM IST on event day (after registration closes), or whenever staff click **Predict now**, the AI predicts seating, snacks, beverages and certificate counts. These show as cards on the event page.
    - If every AI provider is down, a built-in calculation fills the cards.
12. **Images** are compressed in the browser to WebP at quality 0.88 before upload.

---

## 2. Project structure

```
api/                      Vercel serverless functions (keys stay server-side)
  _lib/admin.js           Firebase Admin, token check, roles
  _lib/ai.js              multi-provider AI with fallback (text + image)
  _lib/predict.js         AI planning + deterministic baseline
  _lib/canva.js           Canva Connect: PKCE, encrypted tokens, refresh, API calls, size presets
  canva/[action].js       /api/canva/* — callback, status, connect, designs, create, open, return, export, assets
  ai/image.js             event banners (2/month)
  ai/text.js              Documentation AI: day summaries + report section drafts (15/day)
  ai/predict.js           "Predict now"
  unsplash.js             photo search proxy
  cron/expire.js          daily: 5h auto-drop + predictions for today's events
src/
  pages/public/           Home, About, Teams, TeamDetail, Events, EventDetail (+ Posters & videos), EventRegister, EventChat, PublicForm, Gallery
  pages/auth/             Login (AMAL ID), Join (invite code), Setup (first admin)
  pages/dashboard/        Overview, Onboarding/Profile, Members, YearReview, EventsManage, EventEditor, EventManage,
                          Registrations, Forms, FormEditor, FormResponses, MediaStudio, CanvaReturn, VideoStudio,
                          DocsHome, DocsEvent, Approvals, Logs
  components/ui/          shadcn-style primitives (Button, Card, Dialog, Tabs, Badge, Avatar, Table, Input)
  components/media/       CanvaPanel, CanvaSaveDialog, UploadMediaDialog, MediaGrid, EventSelect
  components/docs/        ReportEditor (TipTap)
  components/{layout,common,members,events,chat,forms}/
  services/               Firestore operations per domain (members, events, registrations, chat, requests, forms, media, reports, logs)
  lib/                    firebase, constants, permissions, utils, image, api, canva (client), videoEngine (ffmpeg.wasm),
                          reportTemplate (pre-filled report), reportExport (docx / PDF / HTML / Markdown / text)
  hooks/                  useData, useFirestore, useDossier (everything about one event, grouped by day)
  context/  styles/ (theme.css = original crimson theme, index.css = Tailwind tokens + report page)
public/fonts/             Manrope TTF (OFL) used for video titles
firestore.rules           the real security boundary (tested — see §6)
firestore.indexes.json
tests/                    rules suite (93 cases), Canva API test (21 checks), emulator seed
```

---

## 3. Setup (about 30 minutes)

### 3.1 Firebase
1. Create a project in the [Firebase console](https://console.firebase.google.com) and stay on the **Spark** (free) plan.
2. **Authentication → Sign-in method:** enable **Email/Password** and **Google**.
3. **Firestore Database → Create database** (production mode, region `asia-south1`).
4. **Project settings → Your apps → Web app:** copy the config into `.env` (see `.env.example`).
5. **Project settings → Service accounts → Generate new private key.** Keep this JSON for Vercel and never commit it.
6. Deploy the rules and indexes:
   ```bash
   npm install
   npx firebase-tools login
   npx firebase-tools use --add      # pick your project
   npm run rules:deploy
   ```

### 3.2 Cloudinary (images)
1. Sign up at [cloudinary.com](https://cloudinary.com) (free).
2. **Settings → Upload → Add upload preset:**
   - Signing mode: **Unsigned**
   - Folder: `amal`
   - Allowed formats: `jpg,png,webp,gif,pdf,mp4,mov,webm` (videos and PDFs are needed by the Media studio)
   - Max file size: leave empty (the free plan caps images at 10 MB and videos at 100 MB; the app checks this before uploading)
3. Put the cloud name and preset name in `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.

### 3.3 Free API keys (server-side, for Vercel)
- **Gemini:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`. This is the primary provider for text and images. If your key has no image quota, the image request falls back to the next provider automatically.
- **Groq:** [console.groq.com](https://console.groq.com) → `GROQ_API_KEY` (text fallback).
- **OpenRouter** (optional): [openrouter.ai](https://openrouter.ai) → `OPENROUTER_API_KEY`.
- **Cloudflare Workers AI:** Dashboard → AI → Workers AI → copy the account ID and create an API token → `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (image fallback).
- **Pollinations:** needs no key (last image fallback).
- **Unsplash:** [unsplash.com/developers](https://unsplash.com/developers) → New application → Access Key → `UNSPLASH_ACCESS_KEY`.

To change which provider is primary, reorder `AI_TEXT_PROVIDERS` and `AI_IMAGE_PROVIDERS`.

### 3.4 Canva (Media studio)
Canva's Connect API is free. Members sign in with their **own** Canva accounts (free or Pro).
1. Go to [canva.com/developers](https://www.canva.com/developers/) → **Your integrations → Create an integration**. Choose **Public** (a *private* integration needs Canva Enterprise).
2. **Scopes:** `design:meta:read`, `design:content:read`, `design:content:write`, `asset:read`, `asset:write`, `profile:read`.
3. **Authentication → Redirect URL:** `https://amal-club.vercel.app/api/canva/callback`. For local testing with `npx vercel dev`, also add `http://127.0.0.1:3000/api/canva/callback`.
4. **Return navigation:** turn it on, Return URL `https://amal-club.vercel.app/dashboard/media/canva-return`.
5. Copy the **Client ID** and **Client secret** into Vercel as `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET` (server-only, no `VITE_`). Redeploy.
6. **Submit the integration for review** in the portal. Until Canva approves it, only your own Canva account (the developer's) can connect. After approval, every member can.

Tokens are encrypted (AES-256-GCM) and stored in Firestore at `canvaTokens/{uid}`. No browser can read that collection. Members can **Disconnect** at any time.

### 3.5 Deploy on Vercel
1. Push this folder to GitHub, then go to [vercel.com/new](https://vercel.com/new) → import it. The framework (Vite) is detected automatically.
2. **Settings → Environment Variables:** add every variable from `.env.example`:
   - `VITE_*` (browser)
   - `FIREBASE_SERVICE_ACCOUNT`: paste the whole JSON on one line
   - the AI and Unsplash keys
   - `CRON_SECRET`: any long random string
3. Set `VITE_SITE_URL` to your final URL, e.g. `https://amal-club.vercel.app`. It's used in QR codes.
4. Deploy, then in Firebase go to **Authentication → Settings → Authorized domains** and add your Vercel domain (needed for Google sign-in).
5. The daily job (`vercel.json`) runs at **12:05 AM IST**. It drops unpaid registrations and runs AI planning for that day's events.

### 3.6 First admin
Open **`https://<your-site>/setup`** once and create the Faculty Admin. The page locks itself permanently afterwards. Then:
1. Complete onboarding.
2. Invite the President, VPs and Treasurer from **Members & invites**.
3. They invite the Team Leads, and the leads invite their members.

---

## 4. Local development

```bash
cp .env.example .env     # fill in VITE_* values
npm run dev              # http://localhost:5173 (API routes need `npx vercel dev` instead)
```

**Fully offline with the Firebase emulators** (no real project needed):
```bash
npm run emulators                    # terminal 1: Firestore + Auth emulators
npm run seed:emulator                # terminal 2: 8 demo members, an event, teams, chat
npm run dev:emulator                 # uses .env.emulator
```
Sign in with `kanishka.amal` / `password123` (President), `jiya.amal` (Technical Lead), `dedeepya.amal` (Media Lead), `arjun.amal` (Media member), `meera.amal` (Documentation member), `rohini.amal` (Member) or `admin.amal`.

---

## 5. Day-to-day: where things live

| Task | Where |
|---|---|
| Invite someone | Dashboard → Members & invites |
| Yearly retain / release | Dashboard → Retain / Release (choose team) |
| Create / edit / disable event, CSV, QR codes, AI planning | Dashboard → Events → event |
| Confirm payments | Event chat (Confirm & tag) or Registrations |
| All registrations (cards + table) | Dashboard → Registrations |
| Build a form / request permission | Dashboard → Form creation |
| Approve requests | Dashboard → Approvals |
| Posters & videos (Canva, Video Studio, uploads) | Dashboard → Media studio |
| Daily diary, event context, reports (PDF / Word) | Dashboard → Documentation |
| Who did what | Dashboard → Activity logs |

---

## 6. Testing

- **Security rules:** `npm run test:rules` runs 93 role scenarios against the Firestore emulator. All 93 pass. Examples:
  - a stolen invite code can't be used with another email
  - a VP can't edit the President's event
  - online registration is blocked after 11:50 PM; on-spot is capped at its intake
  - teams can't confirm their own payment
  - strangers can't read the chat
  - a permission code works once only
  - the 4th form of the day is blocked
  - only the Media team, leads, Club Reps and Admin can save media, and only Cloudinary URLs for existing events
  - team-only media is hidden from the public
  - only the Documentation team, Club Reps and Admin write reports and diary notes
  - Canva tokens can't be read by any browser
- **Canva integration:** `npm run test:canva` runs the real `/api/canva` function against the emulators with a mocked Canva API. It passes 21 checks covering:
  - PKCE sign-in and single-use state, plus rejecting off-site redirects
  - encrypted token storage and refresh-token rotation
  - design creation at preset sizes
  - signed return-JWT verification (forged and wrong-account tokens are rejected)
  - exports, asset upload and disconnect
- **End-to-end:** the main flows were run in a browser against the emulators with zero console errors:
  - President approves a request
  - Member creates a form with the code
  - reusing the code is rejected
  - invite generated
  - payment confirmed and tagged in chat
  - expired team auto-dropped
  - Video Studio: 2 clips + 1 photo + music → 10 s 720×1280 H.264/AAC MP4 with title, caption and logo → saved to the event → shows on the public page
  - Canva: connect → create poster → Return → export → saved to the event → "Edit in Canva"
  - Documentation: diary built from real data, note + AI summary saved, pre-filled report edited and autosaved, Word/Markdown/HTML/TXT downloads verified
- **Not yet tested:** your real Firebase, Cloudinary, Vercel and AI keys. Run the checklist below after deploying.

### Launch checklist
1. `/setup` creates the admin, and `/setup` refuses a second time.
2. Invite a Club Rep → join → onboarding (photo upload works = Cloudinary OK).
3. Create an event with an AI banner (works = Gemini/Cloudflare OK); the third AI banner in a month is refused.
4. Unsplash search returns photos.
5. Register from a phone with Google, pay, send the UTR in chat, and confirm from a staff account.
6. **Predict now** shows the four cards.
7. Media studio → Connect Canva → create a poster → press Return → Download & save → it appears on the event page. Video Studio → export a short reel → Save to event.
8. Documentation → open the event → add a diary note → Report → Download PDF and Word.
9. Disable the event → it moves to Past and the form link shows "closed"; the CSV download appears in the logs.

---

## 7. Known limits

- **Payments are verified by hand** (UPI QR + UTR in chat). Stripe is invite-only for new Indian accounts, so it isn't used. A gateway like Razorpay (about 2% per payment) can be added later.
- **The 5-hour drop** shows instantly in the app. The database is updated whenever any staff member opens the chat or registrations page, and by the nightly job. Vercel Hobby allows only one scheduled run per day.
- **No automatic emails.** Invites and codes are shared through the WhatsApp / email / copy buttons.
- **Cloudinary unsigned presets** can be used by anyone who knows the preset name. Keep the allowed formats list and a folder set on the preset.
- **Canva** must approve the public integration before members other than the developer can connect. Free Canva accounts can't upscale exports much beyond the design size, and Pro elements need a Pro account. Canva download links expire after 24 hours (the copy saved to the event doesn't).
- **Video Studio** runs on the member's device: keep videos under 3 minutes and 600 MB of input. 720p exports are several times faster than 1080p. The first export downloads the engine (~30 MB) from jsDelivr; it's cached after that.
- **Vercel Hobby** is for non-commercial use, which fits a student club.
