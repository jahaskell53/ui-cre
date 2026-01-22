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

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Configure the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
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
# Using Supabase CLI
supabase migration up
```

5. Deploy AWS Lambda function (for email sync):
```bash
npm run sls:deploy
```

6. Start the development server:
```bash
npm run dev
# or
bun dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage
- `npm run sls:deploy` - Deploy AWS Lambda function
- `npm run sls:remove` - Remove AWS Lambda function
- `npm run sls:logs` - View Lambda function logs

## Database Schema

The application uses Supabase (PostgreSQL) with the following main tables:

- **integrations**: Email/calendar provider connections
- **contacts**: Imported contacts from email/calendar
- **interactions**: Email and calendar interactions
- **people**: Extended contact information
- **posts**: Social feed posts
- **likes**: Post likes
- **comments**: Post comments
- **notifications**: User notifications

See `supabase/migrations/` for the complete schema.

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
