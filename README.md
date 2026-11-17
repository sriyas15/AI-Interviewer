# AI Interviewer — Autonomous Technical Assessment Platform

An enterprise-grade, autonomous technical interview platform powered by Next.js, NextAuth v5, Prisma ORM, and LLM reasoning. Built to simulate high-fidelity technical interviews, execute candidate code securely in client-side Web Workers, enforce recruiter proctoring policies, and provide comprehensive evaluation telemetry.

---

## 🚀 Key Features

### 1. Candidate Assessment Journey
- **Passwordless Single-Use Invitations**: Candidates access assessments through expiring single-use tokens with automatic authentication and account linking.
- **Pre-Flight Lobby & Consent**: Hardware checks (camera, microphone) and explicit consent agreements covering AI proctoring, recording disclosure, and assessment guidelines before entering the room.
- **Interactive AI Interviewer**: Animated AI avatar with automated speech generation (TTS) and Web Speech API voice capture.
- **Real Sandboxed Code Execution**: Real-time code execution in sandboxed Web Workers against question bank test cases. Displays passed/failed counts, expected vs actual outputs, and execution elapsed time without server overhead or fake random simulations.
- **Follow-Up Inquiry State Machine**: Server-enforced 2-turn follow-up cap when answers invite deeper technical exploration, storing each interaction in dedicated `FollowUp` models.
- **Per-Question Hints & Scoring Penalty**: Bank questions carry tailored hint ladders. Hint usage is logged and applies real server-side penalties (-5% for 1 hint, -10% for 2 hints, -15% for 3 hints).
- **Assessment Countdown & Session Timers**: Overall assessment countdown enforcing time limits alongside per-question stopwatches.
- **Anti-Cheat Proctoring Guard**: Tracks tab switching, browser blur events, and exit from fullscreen. Recruiter policy can strictly block external clipboard pasting and flag sessions exceeding tab switch limits.
- **Withheld Candidate Report**: Candidates receive a clean "Submitted for Review" receipt upon completion. Detailed rubrics, scores, and evaluations stay confidential until released by a recruiter.

### 2. Recruiter & Admin Portal
- **Candidate Pipeline Funnel**: Visual tracking of candidate progress from invitation, start, completion, to hiring decisions (`ADVANCE`, `HOLD`, `REJECT`).
- **Human Recruiter Override & Audit Trail**: Recruiters can review transcripts, question scores, and override AI decisions with full audit logging (`DecisionAuditLog`).
- **Recruiter Feedback Release Toggle**: Recruiter-controlled switch allowing candidate access to feedback reports only when explicitly permitted.
- **Invitation Management & SMTP Delivery**: Generate custom assessment invites and dispatch email notifications via Nodemailer SMTP with copyable links.
- **Curated Question Bank**: Create and manage questions across Technical, Coding, System Design, and Behavioral categories with sample code, test cases, and hint ladders.
- **Custom Assessment Templates**: Define reusable curricula with custom durations, question counts, difficulty levels, rubric weights, and proctoring policies.
- **Advanced Telemetry & Analytics**:
  - LLM token consumption and estimated inference cost tracking.
  - Role Score Benchmarks: Average candidate performance categorized by target job role.
  - Quality & Risk Telemetry: Flagged proctoring activity rates and LLM fallback rates.
  - AI vs. Human Agreement View: Mean absolute score delta and agreement percentages within ±10 points.
- **Pipeline Data Export**: Full CSV export of candidates and scores, plus print-ready PDF reporting.

### 3. Security, Privacy & Reliability
- **Strict Role Gating**: Candidates are restricted from creating ad-hoc interviews; `/interview/new` and creation actions are gated exclusively to `ADMIN` users.
- **Account Deactivation Enforcement**: Immediate session termination and route blocking in middleware for deactivated accounts (`isActive: false`).
- **GDPR Data Deletion Compliance**: Self-serve data erasure requests submitted by candidates from settings.
- **Sliding-Window Rate Limiting**: In-memory protection against brute-force attacks on auth and public endpoints.
- **Platform Healthcheck**: `/api/health` monitoring database connectivity and memory usage.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma 6.19](https://www.prisma.io/)
- **Authentication**: [NextAuth v5 (Auth.js)](https://authjs.dev/) with Credentials & Google OAuth
- **Styling**: Tailwind CSS & Glassmorphism Design Tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **Email**: [Nodemailer](https://nodemailer.com/) with SMTP support
- **Testing**: Node.js test runner with TypeScript execution via `tsx`
- **Containers**: Multi-stage `Dockerfile` and `docker-compose.yml`

---

## 📁 Project Architecture

```
ai-interviewer/
├── prisma/
│   ├── schema.prisma            # Database models (User, Interview, Question, Response, FollowUp, Report, etc.)
│   └── seed.ts                  # Bank questions, templates, sample invitations, and demo users
├── src/
│   ├── actions/                 # Server actions (interview, invitation, admin, settings)
│   ├── app/
│   │   ├── (auth)/              # Authentication pages (login, register, forgot-password)
│   │   ├── admin/               # Recruiter portal & session deep dive
│   │   ├── api/                 # API routes (health, auth, webhooks)
│   │   ├── dashboard/           # Candidate dashboard & invitation list
│   │   ├── interview/           # Lobby, active interview room, and report pages
│   │   ├── invite/[token]/      # Expiring assessment invitation landing page
│   │   └── settings/            # User settings & GDPR data deletion requests
│   ├── components/              # UI components (avatar, code editor, proctoring guard, admin portal)
│   ├── lib/                     # Database client, AI service, email dispatcher, rate limiter
│   └── types/                   # Type definitions and NextAuth extensions
├── tests/                       # Unit test suites (scoring, follow-up state machine, invite claim)
├── Dockerfile                   # Multi-stage production container
├── docker-compose.yml           # Complete web + PostgreSQL stack
└── package.json
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js** >= 20.x (Node 22 recommended)
- **PostgreSQL** >= 14.x (or Docker)
- **npm** or **pnpm**

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd ai-interviewer
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your credentials:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_interviewer"
AUTH_SECRET="your-32-character-random-secret-here"
AUTH_URL="http://localhost:3000"

# AI Inference Keys (Optional — falls back to heuristic engine if blank)
GEMINI_API_KEY=""
OPENAI_API_KEY=""

# SMTP Email Configuration (Optional — falls back to console logger if blank)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="AI Interviewer <no-reply@ai-interviewer.com>"
```

### 3. Database Migration & Seeding
```bash
npx prisma db push
npm run prisma:seed   # or: npx prisma db seed
```

Default seeded credentials:
- **Admin**: `admin@interviewer.ai` / `AdminPass123!`
- **Candidate**: `candidate@example.com` / `CandidatePass123!`

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

Run the automated test suite covering hint penalties, rubric formulas, follow-up state transitions, and invitation claim rules:

```bash
npm test
```

---

## 🐳 Docker Deployment

To spin up the entire application along with PostgreSQL using Docker Compose:

```bash
docker compose up -d --build
```

The application will be accessible at [http://localhost:3000](http://localhost:3000) and the PostgreSQL database on port `5432`.

To stop the containers:
```bash
docker compose down
```

---

## 🛡️ License

This project is licensed under the MIT License.
