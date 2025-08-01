# Overview

This is a trading application that integrates with OANDA's live trading API for executing forex and metals trades. The application features a React frontend with a cyberpunk aesthetic, Express.js backend, and uses MongoDB for trade tracking. It's designed as a single-user system for live trading with automated trade management features including take profit levels, stop losses, and real-time position monitoring.

## Recent Changes (Phase 2 - January 2025)
- Added TradingView-style live candlestick charts using lightweight-charts library
- Implemented full-width chart display with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Enhanced UI with improved button styling matching the cyberpunk theme
- Fixed lot size input to use placeholder instead of default value
- Updated recent trades to display in descending order (most recent first)
- Added OANDA candle data API integration for historical price data

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React + TypeScript**: Modern component-based architecture using functional components and hooks
- **Wouter Router**: Lightweight client-side routing for navigation between login and dashboard
- **TanStack Query**: Server state management with automatic refetching and caching for real-time data
- **Shadcn/ui + Radix UI**: Component library providing accessible, customizable UI components
- **Tailwind CSS**: Utility-first styling with custom cyberpunk theme including neon colors and glow effects
- **Vite**: Fast development server and build tool with hot module replacement
- **Lightweight Charts**: TradingView-style candlestick charts for live price visualization

## Backend Architecture
- **Express.js**: RESTful API server with session-based authentication
- **TypeScript**: Type safety across the entire backend codebase
- **Service Layer Pattern**: Separate services for OANDA API, MongoDB operations, and authentication
- **Middleware Chain**: Request logging, authentication guards, and error handling
- **Session Management**: Express sessions for user authentication state

## Database Design
- **MongoDB**: Document-based storage for trade records and user sessions
- **Mongoose ODM**: Schema validation and model abstraction for trade documents
- **Trade Document Schema**: Comprehensive trade tracking including entry/exit prices, profit/loss, partial closures, and OANDA trade IDs
- **Automatic Timestamping**: CreatedAt and updatedAt fields for audit trails

## Authentication System
- **Hardcoded Credentials**: Single-user system with predefined username/password (trader/trading123)
- **Session-based Auth**: Server-side session storage with configurable expiration
- **Route Protection**: Authentication middleware protecting all API endpoints and frontend routes
- **Automatic Redirects**: Unauthenticated users redirected to login page

## Trading Core Integration
- **OANDA REST API**: Live trading execution using OANDA's v3 API for practice accounts
- **Real-time Pricing**: Current market prices fetched every 2 seconds for active instruments
- **Instrument Mapping**: Automatic conversion from UI format (XAUUSD) to OANDA format (XAU_USD)
- **Market Orders Only**: Simplified trading interface focusing on immediate execution
- **Position Management**: Automated monitoring of take profit and stop loss levels
- **Chart Data Integration**: Historical and live candlestick data from OANDA's candles endpoint

## Trade Management System
- **Dual Execution**: All trades executed on OANDA's live API and tracked in MongoDB
- **Background Polling**: Server-side monitoring of open positions for automated closure
- **Partial Position Handling**: Support for partial closures at TP1 levels
- **P&L Calculation**: Real-time profit/loss calculations based on current market prices
- **Trade Status Tracking**: Comprehensive status management (open, partial, closed)

## Error Handling & Monitoring
- **Comprehensive Logging**: Request/response logging with performance metrics
- **Environment Validation**: Strict validation of required environment variables on startup
- **API Error Handling**: Proper error propagation from OANDA API to frontend
- **Toast Notifications**: User-friendly error and success messages in the UI

## Development Tooling
- **Drizzle Kit**: Database migration and schema management (configured for PostgreSQL but using MongoDB)
- **ESBuild**: Fast production builds for the server
- **Path Aliases**: Clean import paths using TypeScript path mapping
- **Hot Reload**: Development environment with automatic reloading for both client and server

# External Dependencies

## Trading Infrastructure
- **OANDA API**: Live forex/metals trading execution via REST API
- **OANDA Practice Account**: Sandbox environment for development and testing

## Database Services
- **MongoDB**: Primary database for trade records and session storage
- **Mongoose**: MongoDB object modeling and validation library

## Frontend Libraries
- **React Query**: Server state management and data fetching
- **Radix UI Primitives**: Accessible component foundations
- **Lucide React**: Icon library for UI elements
- **Date-fns**: Date manipulation and formatting utilities

## Development Services
- **Replit Integration**: Development environment plugins and runtime error handling
- **Vite Plugins**: Development tooling for React and error overlays

## Authentication & Security
- **Express Session**: Session management with configurable storage
- **Connect-PG-Simple**: PostgreSQL session store (configured but not actively used)

## Styling & UI
- **Tailwind CSS**: Utility-first CSS framework
- **Class Variance Authority**: Component variant management
- **Clsx**: Conditional class name utility
- **PostCSS**: CSS processing and autoprefixing

## Validation & Type Safety
- **Zod**: Runtime type validation for API requests and database schemas
- **TypeScript**: Compile-time type checking across the entire application
- **Drizzle-Zod**: Integration between Drizzle ORM and Zod validation