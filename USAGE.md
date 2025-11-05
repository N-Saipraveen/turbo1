# TurboDbx Usage Guide

Welcome to TurboDbx - the Universal Database Converter!

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Application

```bash
npm run dev
```

This will start both the frontend (http://localhost:5173) and backend (http://localhost:3000) concurrently.

## Features

### 🔄 Schema Conversion

Convert between SQL, MongoDB, and JSON Schema formats with ease.

**Supported Conversions:**
- SQL → JSON Schema
- SQL → MongoDB (with validation rules and indexes)
- JSON Schema → SQL (PostgreSQL, MySQL, SQLite)
- MongoDB → SQL (normalized tables)
- MongoDB ↔ JSON (direct compatibility)

### 👁️ Schema Visualization

Interactive ER diagrams showing:
- Tables/Collections as nodes
- Foreign keys and relationships as edges
- Schema metadata (columns, types, constraints)

### 🤖 AI-Assisted Mapping

Enable AI suggestions for:
- Intelligent type mapping
- Embed vs. reference decisions for MongoDB
- Schema normalization recommendations

### 📊 Data Preview

View converted schemas with:
- Syntax-highlighted code
- Download individual files
- Copy to clipboard functionality

## Pages

### Home (`/`)
- Quick navigation to all features
- Recent conversions (coming soon)
- Drag-and-drop file upload

### Convert (`/convert`)
Three-pane conversion interface:
1. **Source Panel**: Input schema and format
2. **Mapping Panel**: Configure conversion options
3. **Output Panel**: View and download results

### Visualize (`/visualize`)
- Interactive graph with React Flow
- Zoom, pan, and fit-to-view controls
- Mini-map for navigation
- Relationship highlighting

### Migrate (`/migrate`)
- Coming soon: Live database migrations
- Progress tracking
- Data validation

## Example Usage

### Converting SQL to MongoDB

1. Go to `/convert`
2. Select "SQL" as source format
3. Choose your SQL dialect (PostgreSQL/MySQL/SQLite)
4. Paste your SQL DDL (see `examples/example.sql`)
5. Select "MongoDB" as target format
6. Click "Convert Schema"
7. Download the generated collection setup scripts

### Visualizing a Schema

1. Go to `/visualize`
2. Select schema type (SQL/MongoDB/JSON)
3. Paste your schema content
4. Click "Visualize"
5. Explore the interactive graph

## Configuration

### AI Integration

To use AI features, update the API key in:
- `apps/frontend/src/lib/ai.ts`
- `apps/backend/src/services/ai.ts`

Replace `sk-xx` with your OpenAI-compatible API key.

```typescript
export const OPENAI_API_KEY = "your-api-key-here";
```

### Backend Port

Default: `3000`

To change, set `PORT` environment variable:
```bash
PORT=8080 npm run dev
```

### Frontend Proxy

The frontend automatically proxies `/api` requests to `http://localhost:3000`.

To change, edit `apps/frontend/vite.config.ts`.

## Examples

Sample schemas are provided in the `/examples` directory:

- `example.sql` - E-commerce database schema
- `example.json` - User JSON Schema
- `example-mongo.json` - MongoDB document examples

## API Endpoints

### Health Check
```
GET /health
```

### Convert Schema
```
POST /api/convert
{
  "from": "sql|mongo|json",
  "to": "sql|mongo|json",
  "content": "<schema content>",
  "options": {
    "dialect": "postgres|mysql|sqlite|mongodb",
    "ai": true|false
  }
}
```

### Analyze Schema
```
POST /api/analyze
{
  "content": "<schema content>",
  "type": "sql|mongo|json"
}
```

## Development

### Project Structure

```
TurboDbx/
├── apps/
│   ├── frontend/          # React + Vite frontend
│   │   └── src/
│   │       ├── routes/    # Page components
│   │       ├── components/# UI components
│   │       └── lib/       # Utilities & API
│   └── backend/           # Express API
│       └── src/
│           ├── routes/    # API endpoints
│           ├── services/  # Converters & logic
│           └── lib/       # Utilities
└── examples/              # Sample schemas
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)
- React Flow (graphs)
- React Router (routing)

**Backend:**
- Node.js + Express
- TypeScript
- node-sql-parser (SQL parsing)
- Zod (validation)
- Winston (logging)
- OpenAI SDK (AI features)

### Adding New Converters

1. Create converter in `apps/backend/src/services/`
2. Export `convert()` function matching the interface
3. Add route handler in `apps/backend/src/routes/convert.ts`
4. Update frontend dropdowns in `Convert.tsx`

### Testing

```bash
# Run all tests
npm test

# Run backend tests
npm test --workspace=apps/backend

# Run frontend tests
npm test --workspace=apps/frontend
```

## Troubleshooting

### Port Already in Use
Kill the process using port 3000 or 5173, or change the port in configuration.

### Dependencies Not Installing
Try deleting `node_modules` and running `npm install` again.

### AI Features Not Working
Ensure you've configured a valid API key in the AI service files.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
