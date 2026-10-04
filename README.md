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
| Posters | ✔ | ✔ | Media team ✔, others code | Media team ✔, others code |
| Approve poster requests | ✔ | ✔ | Media Lead `MTL-AMAL-####` | – |

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
9. **Poster studio.**
   - Pick an event. Name, tagline, rules, prizes, sponsor logos, registration link and QR are prefilled. Add judges with photos and choose dark or light.
   - Formats: Instagram 4:5, Story 9:16, LinkedIn.
   - AI paints only the background; text, QR and logos are drawn sharp on top.
10. **AI planning.**
    - At 12:05 AM IST on event day (after registration closes), or whenever staff click **Predict now**, the AI predicts seating, snacks, beverages and certificate counts. These show as cards on the event page.
    - If every AI provider is down, a built-in calculation fills the cards.
11. **Images** are compressed in the browser to WebP at quality 0.88 before upload.

---

## 2. Project structure

```
api/                      Vercel serverless functions (keys stay server-side)
  _lib/admin.js           Firebase Admin, token check, roles
  _lib/ai.js              multi-provider AI with fallback (text + image)
  _lib/predict.js         AI planning + deterministic baseline
  ai/image.js             banners (2/month) & poster art (8/day)
  ai/text.js              poster taglines
  ai/predict.js           "Predict now"
  unsplash.js             photo search proxy
  cron/expire.js          daily: 5h auto-drop + predictions for today's events
src/
  pages/public/           Home, About, Teams, TeamDetail, Events, EventDetail, EventRegister, EventChat, PublicForm, Gallery
  pages/auth/             Login (AMAL ID), Join (invite code), Setup (first admin)
  pages/dashboard/        Overview, Onboarding/Profile, Members, YearReview, EventsManage, EventEditor, EventManage,
                          Registrations, Forms, FormEditor, FormResponses, Posters, Approvals, Logs
  components/ui/          shadcn-style primitives (Button, Card, Dialog, Tabs, Badge, Avatar, Table, Input)
  components/{layout,common,members,events,chat,forms}/
  services/               Firestore operations per domain (members, events, registrations, chat, requests, forms, posters, logs)
  lib/                    firebase, constants (roles/teams/limits), permissions, utils, image (compress + Cloudinary), poster renderer, api
  hooks/  context/  styles/ (theme.css = original crimson theme, index.css = Tailwind tokens)
firestore.rules           the real security boundary (tested — see §6)
firestore.indexes.json
tests/                    rules test suite (61 cases) + emulator seed
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
   - Allowed formats: `jpg,png,webp,gif`
   - Max file size: about 10 MB
3. Put the cloud name and preset name in `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.

### 3.3 Free API keys (server-side, for Vercel)
- **Gemini:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`. This is the primary provider for text and images. If your key has no image quota, the image request falls back to the next provider automatically.
- **Groq:** [console.groq.com](https://console.groq.com) → `GROQ_API_KEY` (text fallback).
- **OpenRouter** (optional): [openrouter.ai](https://openrouter.ai) → `OPENROUTER_API_KEY`.
- **Cloudflare Workers AI:** Dashboard → AI → Workers AI → copy the account ID and create an API token → `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (image fallback).
- **Pollinations:** needs no key (last image fallback).
- **Unsplash:** [unsplash.com/developers](https://unsplash.com/developers) → New application → Access Key → `UNSPLASH_ACCESS_KEY`.

To change which provider is primary, reorder `AI_TEXT_PROVIDERS` and `AI_IMAGE_PROVIDERS`.

### 3.4 Deploy on Vercel
1. Push this folder to GitHub, then go to [vercel.com/new](https://vercel.com/new) → import it. The framework (Vite) is detected automatically.
2. **Settings → Environment Variables:** add every variable from `.env.example`:
   - `VITE_*` (browser)
   - `FIREBASE_SERVICE_ACCOUNT`: paste the whole JSON on one line
   - the AI and Unsplash keys
   - `CRON_SECRET`: any long random string
3. Set `VITE_SITE_URL` to your final URL, e.g. `https://amal-club.vercel.app`. It's used in QR codes.
4. Deploy, then in Firebase go to **Authentication → Settings → Authorized domains** and add your Vercel domain (needed for Google sign-in).
5. The daily job (`vercel.json`) runs at **12:05 AM IST**. It drops unpaid registrations and runs AI planning for that day's events.

### 3.5 First admin
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
Sign in with `kanishka.amal` / `password123` (President), `jiya.amal` (Technical Lead), `rohini.amal` (Member) or `admin.amal`.

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
| Posters | Dashboard → Poster studio |
| Who did what | Dashboard → Activity logs |

---

## 6. Testing

- **Security rules:** `npm run test:rules` runs 61 role scenarios against the Firestore emulator. All 61 pass. Examples:
  - a stolen invite code can't be used with another email
  - a VP can't edit the President's event
  - online registration is blocked after 11:50 PM; on-spot is capped at its intake
  - teams can't confirm their own payment
  - strangers can't read the chat
  - a permission code works once only
  - the 4th form of the day is blocked
- **End-to-end:** the main flows were run in a browser against the emulators with zero console errors:
  - President approves a request
  - Member creates a form with the code
  - reusing the code is rejected
  - invite generated
  - payment confirmed and tagged in chat
  - expired team auto-dropped
  - posters rendered in all formats
- **Not yet tested:** your real Firebase, Cloudinary, Vercel and AI keys. Run the checklist below after deploying.

### Launch checklist
1. `/setup` creates the admin, and `/setup` refuses a second time.
2. Invite a Club Rep → join → onboarding (photo upload works = Cloudinary OK).
3. Create an event with an AI banner (works = Gemini/Cloudflare OK); the third AI banner in a month is refused.
4. Unsplash search returns photos.
5. Register from a phone with Google, pay, send the UTR in chat, and confirm from a staff account.
6. **Predict now** shows the four cards.
7. Poster studio → Save to gallery.
8. Disable the event → it moves to Past and the form link shows "closed"; the CSV download appears in the logs.

---

## 7. Known limits

- **Payments are verified by hand** (UPI QR + UTR in chat). Stripe is invite-only for new Indian accounts, so it isn't used. A gateway like Razorpay (about 2% per payment) can be added later.
- **The 5-hour drop** shows instantly in the app. The database is updated whenever any staff member opens the chat or registrations page, and by the nightly job. Vercel Hobby allows only one scheduled run per day.
- **No automatic emails.** Invites and codes are shared through the WhatsApp / email / copy buttons.
- **Cloudinary unsigned presets** can be used by anyone who knows the preset name. Keep the preset restricted to images and a size limit.
- **Vercel Hobby** is for non-commercial use, which fits a student club.
