# FamSpace - Household Administration App

A household administration app designed for UK families and people living together. FamSpace helps users manage household accounts, bills, insurance, and planning by organizing information around people and assets.

## Features

- **Family Spaces (Fams)**: Create collaborative spaces for household management
- **Asset Management**: Track homes, vehicles, and associated accounts
- **Account Management**: Manage household bills, insurance, and personal accounts
- **AI-Powered Bill Processing**: Automatically detect and process bills from email
- **OCR Document Processing**: Scan and process paper bills
- **Family Planning**: Organize holidays, property moves, and other family plans
- **UK-Specific**: Tailored for UK household types and account structures

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database connection and other settings
   ```

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run vercel-build` - Build command optimised for Vercel deployments (runs Prisma generate & deploy)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:deploy` - Deploy migrations in production environments
- `npm run db:studio` - Open Prisma Studio

## Supabase & Vercel Deployment

FamSpace can be deployed to [Vercel](https://vercel.com/) using [Supabase](https://supabase.com/) as the managed PostgreSQL provider. The application ships with a Supabase integration that allows you to exchange Supabase session tokens for FamSpace JWTs and automatically sync users from Supabase into the local database.

### 1. Configure Supabase

1. Create a new Supabase project.
2. In the **Project Settings → Database** page copy both the standard connection string and the connection pooling string (pgbouncer).
3. In Supabase **Authentication → Providers** ensure email sign-in is enabled and note the project URL and anon/service role keys.

### 2. Environment variables

Set the following values locally (`.env`) and in Vercel → **Project Settings → Environment Variables**:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | The **connection pooling** URL from Supabase. Include `?pgbouncer=true&connection_limit=1` for serverless environments. |
| `DIRECT_URL` | The normal database connection string (without pooling) for running Prisma migrations. |
| `SUPABASE_AUTH_ENABLED` | Set to `true` to enable Supabase token exchange endpoints. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Supabase anon key for public clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key used to verify tokens server-side. |
| `SUPABASE_JWT_SECRET` | (Optional) Supabase JWT secret if you need to verify tokens manually elsewhere. |

When deploying on Vercel, set the **Build Command** to `npm run vercel-build` to ensure the Prisma client is generated and migrations are applied (`prisma migrate deploy`).

### 3. Supabase authentication flow

1. Let your front-end authenticate users with Supabase (e.g. using `@supabase/supabase-js`).
2. Send the Supabase session access token to `POST /api/auth/supabase/exchange`.
3. The API will verify the Supabase token, sync/create the user in Prisma, and return FamSpace access/refresh tokens.
4. Use the FamSpace tokens to call the rest of the protected API routes.

You can check the integration status by calling `GET /api/auth/supabase/status`.

## Project Structure

```
src/
├── controllers/     # API route controllers
├── services/        # Business logic services
├── models/          # Data models and types
├── routes/          # API route definitions
├── middleware/      # Express middleware
├── utils/           # Utility functions
└── lib/             # External library configurations

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── setup.ts         # Test configuration

prisma/
└── schema.prisma    # Database schema
```

## API Endpoints

- `GET /health` - Health check
- `GET /api` - API information

Additional endpoints will be added as features are implemented.

## Development

This project follows a spec-driven development approach. See the `.kiro/specs/` directory for detailed requirements, design, and implementation plans.

## License

MIT