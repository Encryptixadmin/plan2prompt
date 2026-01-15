---
id: 7f9fd44b-9e7c-4032-89a8-b8d960c04e0b
title: Build Prompts: AI Recipe Recommendation App (Replit)
module: prompts
version: 1
createdAt: 2026-01-15T11:58:15.863Z
updatedAt: 2026-01-15T11:58:15.863Z
tags: ["prompts", "build", "replit", "executable"]
---

## Overview

This document contains 12 sequential prompts for building "AI Recipe Recommendation App" using Replit. Each prompt builds on the previous one with clear STOP/WAIT instructions. Prompts are copy-paste ready and IDE-specific.

**Total Steps:** 12
**Estimated Time:** 4-6 hours
**Target IDE:** Replit
**Source:** AI Recipe Recommendation App

## Instructions

1. Copy each prompt exactly as written
2. Paste into your Replit AI assistant
3. Wait for the AI to complete the task
4. Verify the expected outcome
5. Follow the STOP/WAIT instruction before proceeding
6. Only move to the next step after verification

**Important:** Do not skip steps. Each prompt builds on the previous one.

## Step 1: Project Initialization

**Objective:** Set up the project structure and install dependencies
**Estimated Time:** 5-10 minutes

---

### Prompt

```
[REPLIT AGENT PROMPT]

Create a new full-stack web application project for "AI Recipe Recommendation App".

Requirements:
- Use React with TypeScript for the frontend
- Use Node.js with Express for the backend
- Set up Tailwind CSS for styling
- Configure a PostgreSQL database connection
- Create the basic folder structure:
  - /client (frontend)
  - /server (backend)
  - /shared (shared types)

Initialize package.json with the necessary dependencies and create a basic "Hello World" page to verify the setup works.

Do NOT proceed to implement any features yet.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Project structure created with dependencies installed and a working Hello World page

### STOP here. Verify the project runs correctly before proceeding to Step 2. Check the Replit preview panel to verify.

## Step 2: Database Schema Setup

**Objective:** Define and create the database schema
**Estimated Time:** 10-15 minutes
**Dependencies:** Steps 1

---

### Prompt

```
[REPLIT AGENT PROMPT]

Set up the database schema for "AI Recipe Recommendation App".

Create the following tables using an ORM (Drizzle or Prisma):

1. **users** table:
   - id (UUID, primary key)
   - email (string, unique, required)
   - password_hash (string, required)
   - display_name (string, optional)
   - created_at (timestamp)
   - updated_at (timestamp)
   - is_active (boolean, default true)

2. **sessions** table:
   - id (UUID, primary key)
   - user_id (foreign key to users)
   - token (string, required)
   - expires_at (timestamp)
   - created_at (timestamp)

3. **user_preferences** table:
   - id (UUID, primary key)
   - user_id (foreign key to users, unique)
   - theme (enum: light, dark, system)
   - notifications (JSON)
   - updated_at (timestamp)

Run the migration to create these tables in the database.

Do NOT implement any API endpoints yet.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Database tables created successfully with proper relationships

### STOP here. Verify the database tables exist before proceeding to Step 3. Check the Replit preview panel to verify.

## Step 3: Authentication System

**Objective:** Implement user registration and login
**Estimated Time:** 20-30 minutes
**Dependencies:** Steps 2

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the authentication system for "AI Recipe Recommendation App".

Create the following API endpoints:

1. **POST /api/auth/register**
   - Accept: email, password, displayName (optional)
   - Validate email format and password strength
   - Hash password using bcrypt
   - Create user record
   - Return success with user ID

2. **POST /api/auth/login**
   - Accept: email, password
   - Verify credentials
   - Create session token (JWT)
   - Return token with expiration

3. **POST /api/auth/logout**
   - Require authentication
   - Invalidate current session
   - Return success

4. **GET /api/users/me**
   - Require authentication
   - Return current user profile

Also create:
- Authentication middleware to protect routes
- Password hashing utility
- JWT token generation and validation

Do NOT create any frontend UI yet.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Authentication API endpoints working and tested with curl or Postman

### STOP here. Test all auth endpoints before proceeding to Step 4. Check the Replit preview panel to verify.

## Step 4: Frontend Foundation

**Objective:** Set up frontend routing and layout
**Estimated Time:** 15-25 minutes
**Dependencies:** Steps 1

---

### Prompt

```
[REPLIT AGENT PROMPT]

Set up the frontend foundation for "AI Recipe Recommendation App".

Create the following:

1. **Router Setup**
   - Configure client-side routing (React Router or Wouter)
   - Create route structure for:
     - / (Home/Landing)
     - /login
     - /register
     - /dashboard (protected)
     - /settings (protected)

2. **Layout Components**
   - MainLayout with header and footer
   - AuthLayout for login/register pages
   - DashboardLayout with sidebar navigation

3. **UI Components** (using shadcn/ui or similar):
   - Button component with variants
   - Input component with validation
   - Card component
   - Navigation component

4. **Theme Setup**
   - Configure light/dark mode toggle
   - Set up consistent color scheme
   - Define typography scale

Do NOT implement authentication forms yet.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Frontend routes and layouts working with placeholder content

### STOP here. Navigate through all routes to verify routing works before proceeding to Step 5. Check the Replit preview panel to verify.

## Step 5: Authentication UI

**Objective:** Create login and registration forms
**Estimated Time:** 25-35 minutes
**Dependencies:** Steps 3, 4

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the authentication UI for "AI Recipe Recommendation App".

Create the following pages:

1. **Registration Page** (/register)
   - Form with: email, password, confirm password, display name
   - Client-side validation
   - Submit to POST /api/auth/register
   - Success: redirect to login
   - Error: display error message

2. **Login Page** (/login)
   - Form with: email, password
   - Remember me checkbox
   - Submit to POST /api/auth/login
   - Success: store token, redirect to dashboard
   - Error: display error message

3. **Auth Context/Hook**
   - Create useAuth hook
   - Store token in localStorage
   - Provide login/logout functions
   - Track authentication state

4. **Protected Route Component**
   - Check for valid token
   - Redirect to login if not authenticated
   - Show loading state while checking

Connect the frontend to the backend API endpoints.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Users can register, login, and logout with proper redirects

### STOP here. Test the complete auth flow (register → login → access dashboard → logout) before proceeding to Step 6. Check the Replit preview panel to verify.

## Step 6: Dashboard Foundation

**Objective:** Create the main dashboard view
**Estimated Time:** 20-30 minutes
**Dependencies:** Steps 5

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the dashboard for "AI Recipe Recommendation App".

Create the following:

1. **Dashboard Page** (/dashboard)
   - Welcome message with user's name
   - Overview cards showing:
     - Quick stats (placeholder data)
     - Recent activity (placeholder)
     - Quick actions
   - Responsive grid layout

2. **Sidebar Navigation**
   - Dashboard link (active indicator)
   - Main feature links (placeholder)
   - Settings link
   - Logout button

3. **Header Component**
   - App logo/name
   - User avatar/dropdown
   - Theme toggle
   - Notifications icon (placeholder)

4. **API Integration**
   - Fetch user profile on load
   - Handle loading states
   - Handle error states

Style the dashboard to be clean and professional.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Dashboard displays user info with navigation and placeholder content

### STOP here. Verify the dashboard loads correctly with user data before proceeding to Step 7. Check the Replit preview panel to verify.

## Step 7: Core Feature Backend

**Objective:** Implement the main feature API endpoints
**Estimated Time:** 25-35 minutes
**Dependencies:** Steps 3

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the core feature API for "AI Recipe Recommendation App".

Create the following:

1. **Resource CRUD Endpoints**
   - GET /api/resources - List with pagination
   - GET /api/resources/:id - Get single resource
   - POST /api/resources - Create new resource
   - PUT /api/resources/:id - Update resource
   - DELETE /api/resources/:id - Delete resource

2. **Request Validation**
   - Use Zod schemas for validation
   - Return clear error messages
   - Sanitize inputs

3. **Database Operations**
   - Create resources table (if not exists)
   - Implement repository pattern
   - Add proper error handling

4. **Response Format**
   - Consistent response wrapper
   - Include pagination metadata
   - Include timestamps

All endpoints should require authentication.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
CRUD API endpoints working and tested

### STOP here. Test all CRUD operations with authenticated requests before proceeding to Step 8. Check the Replit preview panel to verify.

## Step 8: Core Feature Frontend

**Objective:** Create the main feature UI
**Estimated Time:** 30-40 minutes
**Dependencies:** Steps 6, 7

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the core feature UI for "AI Recipe Recommendation App".

Create the following:

1. **List View**
   - Display resources in a table or card grid
   - Pagination controls
   - Search/filter functionality
   - Loading and empty states

2. **Create/Edit Form**
   - Modal or separate page
   - Form validation
   - Submit handling with loading state
   - Success/error feedback

3. **Detail View**
   - Display single resource
   - Edit and delete actions
   - Confirmation for delete

4. **State Management**
   - Use React Query for data fetching
   - Optimistic updates
   - Cache invalidation

Connect all UI to the backend API endpoints.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Users can create, view, edit, and delete resources through the UI

### STOP here. Test the complete CRUD flow through the UI before proceeding to Step 9. Check the Replit preview panel to verify.

## Step 9: Settings and Preferences

**Objective:** Implement user settings page
**Estimated Time:** 25-35 minutes
**Dependencies:** Steps 6

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement the settings page for "AI Recipe Recommendation App".

Create the following:

1. **Settings Page** (/settings)
   - Profile section:
     - Update display name
     - Change email (with verification)
     - Profile picture upload (optional)
   
   - Preferences section:
     - Theme selection (light/dark/system)
     - Notification preferences
   
   - Security section:
     - Change password
     - View active sessions
     - Delete account (with confirmation)

2. **API Endpoints**
   - PATCH /api/users/me - Update profile
   - PATCH /api/users/me/password - Change password
   - DELETE /api/users/me - Delete account

3. **Form Handling**
   - Validation for all fields
   - Save button with loading state
   - Success/error notifications

Ensure all changes persist correctly.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Users can update their profile, preferences, and password

### STOP here. Test all settings functionality before proceeding to Step 10. Check the Replit preview panel to verify.

## Step 10: Polish and Error Handling

**Objective:** Add finishing touches and comprehensive error handling
**Estimated Time:** 30-40 minutes
**Dependencies:** Steps 8, 9

---

### Prompt

```
[REPLIT AGENT PROMPT]

Add polish and error handling to "AI Recipe Recommendation App".

Implement the following:

1. **Error Handling**
   - Global error boundary
   - API error interceptor
   - User-friendly error messages
   - 404 page
   - 500 error page

2. **Loading States**
   - Skeleton loaders for all data
   - Button loading states
   - Page transition loading

3. **Notifications**
   - Toast notifications for actions
   - Success confirmations
   - Error alerts

4. **Accessibility**
   - Keyboard navigation
   - Focus management
   - ARIA labels
   - Color contrast check

5. **Responsive Design**
   - Mobile-friendly layouts
   - Touch-friendly interactions
   - Responsive navigation

Test the application thoroughly on different screen sizes.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Application handles all edge cases gracefully with good UX

### STOP here. Test error scenarios and responsive design before proceeding to Step 11. Check the Replit preview panel to verify.

## Step 11: Security Hardening

**Objective:** Implement security best practices
**Estimated Time:** 20-30 minutes
**Dependencies:** Steps 10

---

### Prompt

```
[REPLIT AGENT PROMPT]

Implement security hardening for "AI Recipe Recommendation App".

Add the following:

1. **Security Headers**
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security

2. **Rate Limiting**
   - Limit auth endpoints (5 req/min)
   - Limit API endpoints (100 req/min)
   - Return 429 with retry-after

3. **Input Validation**
   - Sanitize all user inputs
   - Validate file uploads (if any)
   - SQL injection prevention (ORM handles this)
   - XSS prevention

4. **Session Security**
   - Secure cookie flags
   - Token expiration
   - Refresh token rotation

5. **Logging**
   - Log authentication attempts
   - Log security events
   - Do NOT log sensitive data

Review the OWASP Top 10 checklist.

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Application follows security best practices

### STOP here. Run a security audit before proceeding to Step 12. Check the Replit preview panel to verify.

## Step 12: Testing and Deployment

**Objective:** Add tests and prepare for deployment
**Estimated Time:** 30-45 minutes
**Dependencies:** Steps 11

---

### Prompt

```
[REPLIT AGENT PROMPT]

Add tests and prepare "AI Recipe Recommendation App" for deployment.

Implement the following:

1. **Unit Tests**
   - Test utility functions
   - Test validation schemas
   - Test components (basic rendering)

2. **Integration Tests**
   - Test API endpoints
   - Test authentication flow
   - Test CRUD operations

3. **Environment Configuration**
   - Production environment variables
   - Database connection for production
   - API URL configuration

4. **Build Optimization**
   - Production build configuration
   - Bundle size optimization
   - Image optimization

5. **Deployment Preparation**
   - Create deployment scripts
   - Document environment setup
   - Create README with setup instructions

The application is now ready for deployment!

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes
```

### Expected Outcome
Tests passing and application ready for production deployment

### COMPLETE! The application is ready for deployment. Check the Replit preview panel to verify.

## Completion Checklist

- [ ] Step 1: Project Initialization
- [ ] Step 2: Database Schema Setup
- [ ] Step 3: Authentication System
- [ ] Step 4: Frontend Foundation
- [ ] Step 5: Authentication UI
- [ ] Step 6: Dashboard Foundation
- [ ] Step 7: Core Feature Backend
- [ ] Step 8: Core Feature Frontend
- [ ] Step 9: Settings and Preferences
- [ ] Step 10: Polish and Error Handling
- [ ] Step 11: Security Hardening
- [ ] Step 12: Testing and Deployment

---

## AI Notes

### system
*2026-01-15T11:58:15.863Z* | Confidence: 0.95

Generated 12 prompts for Replit
