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
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

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