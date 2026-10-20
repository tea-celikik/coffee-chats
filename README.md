# Coffee Chats

A small scheduling app for booking coffee chats. The host publishes open time slots, guests book one with their name and email, and **no slot can ever be booked twice**, even when two people click "Book" at the same moment.

Built for the TeamLift Product Engineer Internship challenge.

**Live demo:** https://coffee-chats-sand.vercel.app
(the backend runs on Render's free tier and sleeps when idle, so the first request can take 30–50 seconds)

Hosting: frontend on Vercel, NestJS API on Render, PostgreSQL on Neon.

## Features

- **Guests** see upcoming times grouped by day, clearly marked as free or taken, and book with name, email and an optional chat topic.
- **The host** (protected by a host key) adds and deletes slots and sees who booked what.
- **Double booking is impossible**, enforced by the database, not just by the UI.
- **AI confirmation (extra):** after booking, Gemini writes a short personal confirmation that mentions the guest's topic. If the AI is unavailable, a template message is used and the booking still succeeds.

## Tech stack

| Layer    | Choice                              |
| -------- | ----------------------------------- |
| Frontend | React + TypeScript (Vite)           |
| Backend  | NestJS (TypeScript), TypeORM        |
| Database | PostgreSQL 16 (Docker)              |
| AI       | Google Gemini API (REST, no SDK)    |

## Running locally

Requirements: Node.js 20+, Docker.

```bash
# 1. Database
docker compose up -d

# 2. Backend (http://localhost:3000)
cd backend
cp .env.example .env        # then set HOST_KEY (and GEMINI_API_KEY if you want AI messages)
npm install
npm run start:dev

# 3. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 to book, or http://localhost:5173/#/host to manage slots (use the `HOST_KEY` from `backend/.env`).

### Environment variables (`backend/.env`)

| Variable          | Required | Description                                                        |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | yes      | Postgres connection string                                         |
| `HOST_KEY`        | yes      | Shared secret for host-only endpoints                              |
| `PORT`            | no       | API port (default `3000`)                                          |
| `FRONTEND_ORIGIN` | no       | Allowed CORS origin (default `http://localhost:5173`)              |
| `GEMINI_API_KEY`  | no       | Enables AI confirmations; without it a template message is used    |
| `GEMINI_MODEL`    | no       | Gemini model ID (default `gemini-3.5-flash-lite`)                  |
| `HOST_TIMEZONE`   | no       | Time zone used in confirmation messages (default `Europe/Skopje`) |

## API

| Method | Route                        | Who   | Description                                       |
| ------ | ---------------------------- | ----- | ------------------------------------------------- |
| GET    | `/slots`                     | guest | Upcoming slots with `isBooked` (no personal data) |
| POST   | `/slots/:slotId/bookings`    | guest | Book a slot → `201`, or `409` if already taken    |
| GET    | `/host/slots`                | host  | Upcoming slots including who booked them          |
| POST   | `/host/slots`                | host  | Create a slot → `409` if it overlaps another      |
| DELETE | `/host/slots/:id`            | host  | Delete a slot (and its booking)                   |

Host routes require the `x-host-key` header.

## Testing

With the backend running:

```bash
./scripts/test-api.sh
```

An end-to-end script with 22 checks: validation (400), auth (401), not found (404), overlaps and double bookings (409), privacy of the public list, cleanup, and a **concurrency test where 20 requests try to book the same slot at once**. Exactly one gets `201` and the other nineteen get `409`.

## Design decisions

**Preventing double booking.** `bookings.slotId` has a `UNIQUE` constraint (a one-to-one relation). The service also checks whether the slot is taken, but that check alone has a race condition: two requests can both see "free" and both insert. The constraint is the real guarantee. Postgres accepts exactly one row, and the service turns the unique-violation error (`23505`) into a `409 Conflict`. The concurrency test proves this.

**Privacy.** The public endpoint returns only `isBooked`, never names or emails. Guest details are visible only on host endpoints.

**Validation on the server.** DTOs with `class-validator`, and a global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, so unknown fields are rejected. Emails are trimmed and lowercased. Form limits in the UI are only for convenience.

**Time zones.** Times are stored as `timestamptz` (UTC) and displayed in each visitor's local time.

**AI as an enhancement, not a dependency.** The Gemini call has a 6-second timeout and a template fallback, so booking never fails because of the AI. The guest's free-text topic is passed inside delimited tags and declared as data, to reduce prompt injection. The output is length-limited and rendered as plain text. The API key is sent in a header, not in the URL.

**Simple host auth.** A shared key compared in constant time (`timingSafeEqual`), stored in `sessionStorage` on the client. This was a deliberate trade-off for the scope of the challenge (see below).

## Trade-offs and what I'd do next

- **Real authentication** (OAuth / sessions with `httpOnly` cookies) and multiple hosts instead of a single shared key.
- **Migrations** instead of TypeORM `synchronize`, which is convenient for development but unsafe in production.
- **Overlap check in the database** with a Postgres exclusion constraint (`tstzrange` + `EXCLUDE USING gist`). Today it is checked in the service, which is fine for a single host but not race-proof.
- **Email confirmations and calendar invites** (`.ics` or Google Calendar).
- **Rate limiting** on the booking endpoint, to prevent spam and runaway AI costs.
- **Deployment** (for example Vercel + Render + Neon) and CI running the test script.

## How I built it

- I built this step by step with an AI assistant (Claude) acting as a pair programmer and tutor.
I set up and ran everything on my own machine, wrote or pasted each file myself, and tested
every step before moving on. The AI drafted a lot of the code, especially the frontend
components and the test script. I reviewed it, asked why things were done a certain way,
and committed after each working step.

- What I learned:
- Why a **UNIQUE** constraint in the database, not an `if` in the code, is what really prevents double booking, and how to prove it with a concurrency test.
- How **NestJS** fits together: modules, dependency injection, DTO validation, guards.
- How to integrate an **AI API** safely: timeout, fallback, and treating user input as data (prompt injection) and AI output as untrusted.
- Keeping public and private data apart (the guest list never exposes emails).
