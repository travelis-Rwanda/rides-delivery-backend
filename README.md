# Rides Delivery Backend System

Backend system for courier and package delivery services integrated with the Rides platform in Rwanda.

## Features

- **Multi-Category Delivery**: Parcel, Restaurant, Shop, and Cargo delivery support
- **Negotiation-Based Pricing**: Drivers submit price offers; customers choose the best option
- **Real-Time Tracking**: Continuous driver location updates during delivery
- **Comprehensive Status Management**: Handles full delivery lifecycle including failures, returns, refunds, and disputes
- **Mobile Money Integration**: Payment processing through MTN Mobile Money and Airtel Money
- **Module Integration**: Seamless connections with Restaurant, Shop, and Collection Point modules

## Technology Stack

- **Framework**: Express.js (Node.js)
- **Database**: PostgreSQL
- **Migrations**: Knex.js
- **Authentication**: JWT integration with Rides Platform
- **Caching**: Redis
- **Payment**: MTN Mobile Money & Airtel Money
- **Testing**: Jest & Supertest

## Prerequisites

- Node.js >= 16.x
- PostgreSQL >= 13.x
- Redis >= 6.x

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with appropriate values

5. Run database migrations:
   ```bash
   npm run migrate
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback last migration
- `npm run migrate:make <name>` - Create new migration

## API Documentation

API runs on `http://localhost:3000` by default.

### Health Check
```
GET /health
```

### API Base URL
```
/api/v1
```

## Project Structure

```
.
├── src/
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── routes/          # API routes
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── models/          # Database queries
│   ├── validators/      # Input validation schemas
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app setup
│   └── index.js         # Application entry point
├── migrations/          # Database migrations
├── __tests__/          # Test files
└── package.json

```

## Environment Variables

See `.env.example` for all available configuration options.

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:watch
```

## License

ISC
