# OpenMidmarket App

**Democratizing the midmarket**

A comprehensive platform for managing relationships, properties, and market intelligence in the commercial real estate midmarket space.

## Overview

OpenMidmarket App is a modern web application built with Next.js that provides tools for professionals to manage contacts, track properties, stay informed with market news, and collaborate through a social feed. The platform integrates with email and calendar services to automatically sync contacts and interactions.

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS v4.1 with Untitled UI components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email/Calendar Integration**: Nylas
- **Cloud Infrastructure**: AWS Lambda, SQS, S3
- **AI**: Google Generative AI (for email filtering)
- **Maps**: Mapbox GL
- **Testing**: Vitest, React Testing Library

## Features

### 🏠 Property Management
- **Listings**: Browse and search commercial real estate listings
- **Map View**: Interactive map visualization of properties with filtering
- **Property Details**: View property information including price, cap rate, square footage
- **Advanced Filters**: Filter by price range, cap rate, square footage

### 👥 People & Contacts
- **Contact Management**: Comprehensive contact database with multiple views
- **Kanban Board**: Visual board for organizing contacts by status
- **Map View**: Geographic visualization of contacts
- **List View**: Traditional table/list view with sorting and filtering
- **Network Strength**: Automatic calculation of relationship strength based on interactions
- **Timeline**: View interaction history with contacts
- **Account Cards**: Detailed contact profiles with company information

### 📧 Email & Calendar Integration
- **Nylas Integration**: Connect Gmail, Outlook, Yahoo, iCloud, and other email providers
- **Automatic Contact Sync**: Automatically import contacts from email and calendar
- **Interaction Tracking**: Track email sent/received and calendar meetings
- **AI-Powered Filtering**: Google AI filters relevant business contacts
- **Async Processing**: AWS Lambda handles long-running sync operations via SQS

### 📰 News & Market Intelligence
- **News Aggregation**: Curated news articles relevant to commercial real estate
- **County-Based Filtering**: Filter news by geographic regions
- **Tag System**: Organize articles with tags
- **Customizable Preferences**: Configure news sources and topics
- **Market Intelligence**: Access market data and insights

### 📅 Calendar & Events
- **Event Management**: Create, edit, and manage calendar events
- **Integration**: Sync with connected calendar providers
- **Event Details**: View and manage event information

### 💬 Social Feed
- **Posts**: Create and share posts with text, links, and file attachments
- **Interactions**: Like and comment on posts
- **Notifications**: Real-time notifications for mentions, likes, and comments
- **Feed Filtering**: Filter to view all posts or only liked posts

### 📊 Holdings
- **Portfolio Management**: Track and manage property holdings
- **Portfolio Analytics**: View portfolio performance and metrics

### 🔔 Notifications
- **Real-Time Updates**: Receive notifications for messages, system events, mentions, likes, and comments
- **Notification Center**: Centralized view of all notifications

### 👤 User Management
- **User Profiles**: Manage user accounts and profiles
- **Role-Based Access**: Admin and user roles
- **Settings**: Customize application preferences

### 💬 Messaging
- **Conversations**: Message other users in the platform
- **Chat Interface**: Real-time messaging interface

## Project Structure

```
cre-ui/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── (app)/             # Main application routes
│   │   │   ├── people/        # People/contacts management
│   │   │   ├── listings/      # Property listings
│   │   │   ├── news/          # News aggregation
│   │   │   ├── calendar/      # Calendar and events
│   │   │   ├── messages/      # Messaging
│   │   │   ├── holdings/      # Portfolio management
│   │   │   └── ...
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                    # Utility libraries
│   └── utils/                  # Helper functions
├── lambda/                     # AWS Lambda functions
│   └── sync-email-contacts.ts  # Email sync handler
├── supabase/
│   └── migrations/            # Database migrations
└── public/                     # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Supabase account and project
- AWS account (for email sync functionality)
- Nylas account (for email/calendar integration)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cre-ui
```

2. Install dependencies (use Bun — the project lockfile is `bun.lockb`):
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Configure the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `DATABASE_URL`: Supabase Postgres connection string (use the transaction pooler URL from Project Settings → Database → Connection string)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `NYLAS_API_KEY`: Your Nylas API key
- `NYLAS_CLIENT_ID`: Your Nylas client ID
- `GOOGLE_AI_API_KEY`: Your Google AI API key (for email filtering)
- `EMAIL_SYNC_QUEUE_URL`: AWS SQS queue URL (after Lambda deployment)
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (default: us-east-1)

4. Run database migrations:
```bash
# Apply pending migrations to your local or remote Supabase project
supabase db push
```

5. Deploy AWS Lambda function (for email sync):
```bash
npm run sls:deploy
```

6. Start the development server:
```bash
bun dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `bun dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run test` - Run tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:ui` - Run tests with UI
- `bun run test:coverage` - Run tests with coverage
- `bun run sls:deploy` - Deploy AWS Lambda function
- `npm run sls:remove` - Remove AWS Lambda function
- `npm run sls:logs` - View Lambda function logs

## Database Schema

The application uses Supabase (PostgreSQL). `src/db/schema.ts` is the single source of truth for all table definitions (Drizzle ORM). The generated SQL migrations live in `supabase/migrations/`.

Main tables:

- **integrations**: Email/calendar provider connections
- **contacts**: Imported contacts from email/calendar
- **interactions**: Email and calendar interactions
- **people**: Extended contact information
- **posts**: Social feed posts
- **likes**: Post likes
- **comments**: Post comments
- **notifications**: User notifications
- **neighborhoods**: Neighborhood boundary polygons ([Zillow 2017 dataset](https://www.arcgis.com/home/item.html?id=56b89613f9f7450fb44e857691a244e7))
- **county_boundaries**: US county polygons ([Census TIGER/Line 2025 — tl_2025_us_county.zip](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html))
- **msa_boundaries**: Metropolitan Statistical Area polygons ([Census TIGER/Line 2025 — tl_2025_us_cbsa.zip](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html), MEMI=1 only)

### Making schema changes

1. Edit `src/db/schema.ts`.
2. Run `drizzle-kit generate` to produce a new migration file under `supabase/migrations/`.
3. Review the generated SQL — it must be additive (new columns with defaults/nullable, new tables). Dropping columns or tables requires two separate PRs (see AGENTS.md for details).
4. Commit both the schema file and the migration file.
5. Open a PR — CI will post a dry-run comment showing the exact SQL that will run against production.
6. On merge to main, CI applies the migration automatically before the Vercel deployment completes.

Do not apply schema changes via the Supabase dashboard or MCP — use the workflow above to keep changes version-controlled.

## Data Ingestion

### Zillow (cleaned_listings)

Rental listings are scraped from Zillow via two Apify actors:

- **ZIP code scraper** — fetches active listings by ZIP code: [Apify actor](https://console.apify.com/actors/l7auNT3I30CssRrvO/input)
- **Detail scraper** — fetches full listing details, used for REIT/building-level data: [Apify actor](https://console.apify.com/actors/ENK9p4RZHg0iVso52/input)

The orchestration pipeline (scheduling, transformation, loading into `cleaned_listings`) lives in [`../zillow/pipeline/dagster`](../zillow/pipeline/dagster).

### LoopNet (loopnet_listing_details + loopnet_listing_snapshots)

Custom browser console scraper — see [`../loopnet-bot`](../loopnet-bot/README.md). Scrapes Bay Area multifamily listings from LoopNet in two phases (search pages → detail pages), outputs a CSV, then uploads via `upload_to_supabase.py`. Static listing details are upserted into `loopnet_listing_details` (one row per URL); per-run price/cap-rate data is stored in `loopnet_listing_snapshots` (one row per URL + run_id).

## AWS Lambda Setup

The email sync functionality uses AWS Lambda to process long-running operations asynchronously. See [AWS_SETUP.md](./AWS_SETUP.md) and [lambda/README.md](./lambda/README.md) for detailed setup instructions.

## Testing

The project uses Vitest for testing. See [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) for testing guidelines and best practices.

## License

This project is built on top of [Untitled UI React](https://www.untitledui.com/react), which is licensed under the MIT license.

## Resources

- [Untitled UI React Documentation](https://www.untitledui.com/react/docs/introduction)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Nylas Documentation](https://developer.nylas.com/)
