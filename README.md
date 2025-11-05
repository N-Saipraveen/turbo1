# turbo1

# Build Brief for Claude Code: TurboDbx — Universal DB Converter (SQL ⇄ NoSQL ⇄ JSON)

> You are Claude Code. Generate a full, production‑quality monorepo that runs locally via `npm run dev`, no deployment required. The app is called **TurboDbx** and converts between relational SQL, NoSQL (MongoDB), and JSON schemas/data, with elite UI/UX and smooth animations. Include AI‑assisted conversion using an OpenAI‑compatible API.

---

## North Star

* Convert **SQL ⇄ NoSQL ⇄ JSON** both for **schema** and **data**.
* Visualize schemas (ER/graph) and tables/collections with **high‑polish UI** (shadcn/ui + Aceternity UI components), **Framer Motion** animations, and **delightful micro‑interactions**.
* Run **locally** with `npm run dev` (frontend + backend concurrently). No .env. Keys are **hardcoded** constants as placeholders.
* “No errors” standard: strict types, schema validation, robust parsing, clear error surfaces.

---

## Tech Stack (do not deviate)

**Frontend**

* React + Vite + TypeScript
* Tailwind CSS + **shadcn/ui** + **Aceternity UI** components
* **Framer Motion** for animations; **react-hot-toast** for feedback
* **TanStack Table** for data grids; **React Flow** for ER/graph visualization
* Zod for client schema validation; Axios for API calls

**Backend**

* Node.js + TypeScript + Express
* **node-sql-parser** for SQL parse/AST
* **mongodb** driver for Mongo; **pg**, **mysql2**, **better-sqlite3** for live connections (optional toggle)
* **Zod** for runtime validation; **BullMQ** (optional) for heavy conversions; **winston/pino** logging

**AI Conversion Layer**

* `openai` npm client pointing to **OpenAI‑compatible** base URL
* Use constants (no .env):

  ```ts
  export const OPENAI_API_KEY = "sk-xx";
  export const API_BASE_URL = "https://api.chatanywhere.tech/v1";
  ```

**Tooling/Quality**

* ESLint + Prettier + Type‑strict tsconfig
* Vitest + @testing-library/react + Supertest for API
* Playwright smoke E2E (basic flows)

---

## Project Structure

Use a lightweight monorepo.

```
TurboDbx/
  package.json                 # root scripts (concurrently)
  turbo.json (optional)
  README.md
  apps/
    frontend/
      vite.config.ts
      index.html
      src/
        main.tsx
        App.tsx
        routes/
          Home.tsx
          Convert.tsx
          Visualize.tsx
          Migrate.tsx
        components/
          layout/
          forms/
          tables/
          graph/
          ui/                 # shadcn & Aceternity wrappers
        lib/
          api.ts              # axios base
          ai.ts               # OpenAI‑compatible client
          validators.ts
          converters/
            sqlToJson.ts
            sqlToMongo.ts
            jsonToSql.ts
            mongoToSql.ts
            common.ts         # shared helpers
    backend/
      src/
        server.ts
        routes/
          convert.ts
          analyze.ts
          health.ts
        services/
          sql.ts              # parse/validate SQL
          mongo.ts            # infer schema
          json.ts             # validate JSON
          ai.ts               # AI assist functions
          mapRules.ts         # deterministic mapping rules
        lib/
          zodSchemas.ts
          logger.ts
        tests/
          convert.spec.ts
```

---

## How it Works (Functional Spec)

1. **Input modes**

   * Paste or upload: `.sql`, `.json`, `.bson` (JSON ext OK), `.csv` (optional)
   * Connect live (optional toggle): Postgres/MySQL/SQLite connection or Mongo URI (read‑only)
2. **Parsing & Validation**

   * SQL: `node-sql-parser` to AST; extract tables, columns, types, PK/FK/Unique/Checks
   * JSON: infer schema, nullability, enums
   * Mongo: sample docs to infer schema (types, optionality, nested arrays)
3. **Deterministic Conversion Rules** (baseline mapping)

   * Types: `INT ↔ Number`, `VARCHAR(n) ↔ String`, `BOOLEAN ↔ Boolean`, `TIMESTAMP ↔ Date`, `DECIMAL(p,s) ↔ Number`, `JSON ↔ Object`
   * PK/FK: For Mongo, embed vs reference decision by heuristic: small child tables embed; large/high‑fanout reference with `_id`
   * Constraints: emit JSON Schema for JSON; for Mongo, create validation rules if possible
   * Indexes: map to Mongo indexes, note unsupported unique scoping edge cases
4. **AI Assist**

   * Given source schema summary + target flavor, AI proposes refined mappings, naming, denormalization advice, and edge case solutions. Always keep deterministic baseline as fallback.
5. **Visualization**

   * **ER/Graph** with React Flow: nodes = tables/collections; edges = relationships; badges for indexes and constraints
   * **Data Grid** with TanStack Table: preview of converted sample rows/objects
6. **Export**

   * Output artifacts: SQL DDL, Mongo collection setup scripts (indexes & validators), JSON Schema files, sample data

---

## Key UI/UX Requirements

* **Design system**: shadcn/ui primitives + Aceternity UI patterns. Keep clean, rounded‑2xl, soft shadows, generous spacing.
* **Pages**

  * Home: quick intro, drag‑and‑drop, recent conversions
  * Convert: three panes (Source → Mapping → Target Preview) with animated transitions
  * Visualize: full‑screen canvas for ER/graph with mini‑map and fit‑view
  * Migrate (optional): run live migrations from source to target with progress toasts
* **Animations**: page transitions (Framer Motion), button micro‑states, graph edge hover tooltips
* **Accessibility**: keyboard nav, focus rings, proper aria labels
* **Error UX**: inline zod messages, retry actions, copy diagnostics

---

## Hardcoded AI Client (no .env)

Create these files exactly.

**Frontend `apps/frontend/src/lib/ai.ts`**

```ts
import OpenAI from "openai";
export const OPENAI_API_KEY = "sk-xx";
export const API_BASE_URL = "https://api.chatanywhere.tech/v1";
export const ai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: API_BASE_URL });

export async function aiSuggestMapping(prompt: string) {
  const res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You map database schemas conservatively and precisely." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
  });
  return res.choices[0]?.message?.content ?? "";
}
```

**Backend `apps/backend/src/services/ai.ts`**

```ts
import OpenAI from "openai";
export const OPENAI_API_KEY = "sk-xx";
export const API_BASE_URL = "https://api.chatanywhere.tech/v1";
export const ai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: API_BASE_URL });

export async function aiRefineMapping(summary: string) {
  const res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return JSON with refined mapping decisions. Keep constraints." },
      { role: "user", content: summary }
    ],
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content ?? "{}";
}
```

> Note: Hardcoding keys is for local demo only. User will replace `sk-xx` with their own.

---

## Core Converters (deterministic layer)

Implement these modules with strong typing and unit tests.

* `sqlToJson.ts`: parse DDL → JSON Schema + sample data transform
* `sqlToMongo.ts`: DDL → collection definitions + index plan + validation JSON Schema
* `jsonToSql.ts`: JSON Schema → SQL DDL (Postgres‑flavored by default)
* `mongoToSql.ts`: inferred schema → normalized SQL DDL with FK creation
* `common.ts`: type maps, name sanitizers, identifier quoting, enum extraction

Each converter exports:

```ts
export type ConvertInput = { dialect: "postgres"|"mysql"|"sqlite"|"mongo"|"json"; content: string };
export type ConvertOutput = { artifacts: Record<string, string>; summary: object; warnings: string[] };
export function convert(input: ConvertInput): Promise<ConvertOutput>;
```

---

## API Endpoints

* `GET /health` → `{ ok: true }`
* `POST /convert` → body `{ from: "sql|mongo|json", to: "sql|mongo|json", content: string, options?: { dialect?: string, ai?: boolean } }`

  * returns `{ artifacts, summary, warnings }`
* `POST /analyze` → returns parsed graph `{ nodes, edges }`

---

## Frontend Flows

* **Convert Page**

  1. User drops file or pastes text
  2. Parse client‑side where cheap; send to `/convert`
  3. Show **Mapping Inspector**: type maps, PK/FK rules; toggle **AI refine**
  4. Preview target DDL/JSON/validators in tabs; copy/download buttons

* **Visualize Page**

  * Render graph from `/analyze` or derived from conversion output
  * Controls: zoom, fit, layout, filter by table, show indexes

---

## Commands & Scripts

Root `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently -k -n backend,frontend -c blue,magenta \"npm run dev --workspace=apps/backend\" \"npm run dev --workspace=apps/frontend\"",
    "test": "pnpm -r test || npm -w apps/backend test && npm -w apps/frontend test",
    "lint": "pnpm -r lint || eslint ."
  }
}
```

Frontend:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint src --ext .ts,.tsx"
  }
}
```

Backend:

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "test": "vitest run",
    "lint": "eslint src --ext .ts"
  }
}
```

---

## Acceptance Criteria (must pass)

1. Paste SQL DDL → get JSON Schema + Mongo setup (validators + indexes) with download buttons.
2. Paste JSON Schema → generate Postgres DDL with PK/nullable inferred; preview diffs.
3. Visualize any input as ER/graph with edges labeled by FK/refs.
4. AI refine button produces adjusted mapping without breaking deterministic rules; warnings surfaced.
5. Zero runtime errors on fresh clone; all unit tests green; Playwright smoke for Convert/Visualize passes.

---

## Example Prompts to AI Layer

* “Given this SQL schema, propose an embedding vs referencing plan for MongoDB. Return JSON with decisions per relation and reasons.”
* “Normalize this inferred Mongo schema into 3NF tables with PK/FK and indexes. Return DDL.”

---

## Nice‑to‑Haves (if time permits)

* CSV sample import to generate JSON Schema or SQL CREATE TABLE
* Theme switcher; command palette; keyboard shortcuts
* Save/load projects to localStorage

---

## Delivery Checklist for Claude

* Generate complete monorepo with code, not just stubs
* Include polished UI pages, animated transitions, and accessible components
* Provide sample inputs in `/examples`
* Document usage in `README.md` with gifs/screenshots
* Ensure `npm install` then `npm run dev` works immediately (no env needed)

---

## Style & Quality Rules

* TypeScript strict everywhere; no `any` without justification
* Zod validate all API inputs
* Small, pure functions for mapping; unit tests per function
* Clear error messages and toasts with actionable advice

**Build it now.**
