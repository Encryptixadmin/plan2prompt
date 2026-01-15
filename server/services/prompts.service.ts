import { randomUUID } from "crypto";
import type {
  IDEType,
  BuildPrompt,
  PromptDocument,
  PromptPrerequisite,
  VerificationCheckpoint,
  FailureRecoveryBranch,
} from "@shared/types/prompts";
import { artifactService } from "./artifact.service";
import type { Artifact } from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";

/**
 * Prompts Service
 * 
 * Generates sequential, executable prompts for building apps in external IDEs.
 */
export class PromptsService {
  private ideNames: Record<IDEType, string> = {
    replit: "Replit",
    cursor: "Cursor",
    lovable: "Lovable",
    antigravity: "Antigravity",
    warp: "Warp",
    other: "Generic IDE",
  };

  /**
   * Generate prompts from a requirements artifact
   */
  async generatePrompts(
    requirementsArtifactId: string,
    ide: IDEType
  ): Promise<PromptDocument> {
    // Load the requirements artifact
    const artifact = await artifactService.getById(requirementsArtifactId);
    if (!artifact) {
      throw new Error(`Requirements artifact not found: ${requirementsArtifactId}`);
    }

    // Capture source version for downstream tracking
    const sourceArtifactVersion = artifact.metadata.version;

    // Extract idea title from artifact
    const ideaTitle = this.extractIdeaTitle(artifact);

    // Generate IDE-specific prompts
    const prompts = this.generateIDEPrompts(artifact, ide, ideaTitle);

    // Create document
    const document: PromptDocument = {
      id: randomUUID(),
      requirementsArtifactId,
      ideaTitle,
      ide,
      ideName: this.ideNames[ide],
      prompts,
      summary: this.generateSummary(ideaTitle, ide, prompts.length),
      totalSteps: prompts.length,
      estimatedTotalTime: this.calculateTotalTime(prompts),
      createdAt: new Date().toISOString(),
      sourceArtifactVersion,
    };

    // Save as artifact
    const savedArtifact = await this.saveAsArtifact(document);
    document.artifactId = savedArtifact.metadata.id;

    return document;
  }

  /**
   * Extract idea title from requirements artifact
   */
  private extractIdeaTitle(artifact: Artifact): string {
    const titleMatch = artifact.metadata.title.match(/Requirements Reference: (.+)/);
    return titleMatch ? titleMatch[1] : artifact.metadata.title;
  }

  /**
   * Generate IDE-specific prompts
   */
  private generateIDEPrompts(
    artifact: Artifact,
    ide: IDEType,
    ideaTitle: string
  ): BuildPrompt[] {
    const basePrompts = this.getBasePrompts(ideaTitle);
    return basePrompts.map((prompt) => this.adaptPromptForIDE(prompt, ide));
  }

  /**
   * Get base prompts that work across all IDEs
   */
  private getBasePrompts(ideaTitle: string): BuildPrompt[] {
    return [
      {
        step: 1,
        title: "Project Initialization",
        objective: "Set up the project structure and install dependencies",
        prompt: `Create a new full-stack web application project for "${ideaTitle}".

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

Do NOT proceed to implement any features yet.`,
        expectedOutcome: "Project structure created with dependencies installed and a working Hello World page",
        waitInstruction: "STOP here. Verify the project runs correctly before proceeding to Step 2.",
        estimatedTime: "5-10 minutes",
        tags: ["setup", "initialization"],
        verificationCheckpoint: {
          whatToVerify: "The development server starts and displays Hello World in the browser",
          successCriteria: "No console errors, page loads at localhost:5000 or designated port, folder structure matches specification",
          whenToStop: "If dependencies fail to install, if TypeScript has configuration errors, or if the server won't start",
        },
        failureRecovery: [
          {
            symptom: "npm install fails with dependency conflicts",
            likelyCause: "Incompatible package versions or corrupt cache",
            recoveryAction: "Delete node_modules and package-lock.json, then run npm install again. If still failing, check for version conflicts in package.json.",
            shouldRetry: true,
          },
          {
            symptom: "TypeScript compilation errors on fresh project",
            likelyCause: "Missing or misconfigured tsconfig.json",
            recoveryAction: "Ensure tsconfig.json exists with correct compiler options. Check that jsx is set to react-jsx and module is set appropriately.",
            shouldRetry: true,
          },
          {
            symptom: "Port already in use error",
            likelyCause: "Another process is using the port",
            recoveryAction: "Kill the process using the port or configure a different port in the server configuration.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add authentication logic",
          "Do NOT create database schemas",
          "Do NOT add any feature-specific code",
          "Do NOT configure production settings",
          "Do NOT add testing infrastructure yet",
        ],
      },
      {
        step: 2,
        title: "Database Schema Setup",
        objective: "Define and create the database schema",
        prompt: `Set up the database schema for "${ideaTitle}".

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

Do NOT implement any API endpoints yet.`,
        expectedOutcome: "Database tables created successfully with proper relationships",
        waitInstruction: "STOP here. Verify the database tables exist before proceeding to Step 3.",
        dependencies: [1],
        estimatedTime: "10-15 minutes",
        tags: ["database", "schema"],
        prerequisites: [
          {
            stepNumber: 1,
            description: "Project initialized with working development environment",
            verificationCheck: "Run npm run dev and confirm server starts without errors",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "All three tables exist in the database with correct columns and relationships",
          successCriteria: "Can connect to database and query table structure. Foreign keys are properly configured. No migration errors in logs.",
          whenToStop: "If database connection fails, if migration throws errors, or if tables are created with wrong column types",
        },
        failureRecovery: [
          {
            symptom: "Database connection refused",
            likelyCause: "Database not running or connection string incorrect",
            recoveryAction: "Verify DATABASE_URL is set correctly. Check that PostgreSQL is running. Test connection with a database client.",
            shouldRetry: true,
          },
          {
            symptom: "Migration fails with permission denied",
            likelyCause: "Database user lacks CREATE TABLE permission",
            recoveryAction: "Grant necessary permissions to the database user or use a user with admin privileges for migrations.",
            shouldRetry: true,
          },
          {
            symptom: "Column type not supported error",
            likelyCause: "ORM syntax incorrect or PostgreSQL version incompatibility",
            recoveryAction: "Check ORM documentation for correct syntax. Verify PostgreSQL version supports the column types used.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add seed data",
          "Do NOT create API endpoints",
          "Do NOT add business logic tables yet",
          "Do NOT configure replication or advanced database features",
          "Do NOT add indexes beyond primary/foreign keys",
        ],
      },
      {
        step: 3,
        title: "Authentication System",
        objective: "Implement user registration and login",
        prompt: `Implement the authentication system for "${ideaTitle}".

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

Do NOT create any frontend UI yet.`,
        expectedOutcome: "Authentication API endpoints working and tested with curl or Postman",
        waitInstruction: "STOP here. Test all auth endpoints before proceeding to Step 4.",
        dependencies: [2],
        estimatedTime: "20-30 minutes",
        tags: ["authentication", "api", "security"],
        prerequisites: [
          {
            stepNumber: 2,
            description: "Database schema exists with users and sessions tables",
            verificationCheck: "Query the users table: SELECT * FROM users LIMIT 1; should return empty result, not error",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "All four auth endpoints respond correctly to valid and invalid requests",
          successCriteria: "Register creates user in database. Login returns valid JWT. Logout invalidates session. /me returns user data with valid token and 401 without.",
          whenToStop: "If password hashing fails, if JWT generation errors, or if database inserts fail",
        },
        failureRecovery: [
          {
            symptom: "bcrypt throws error during password hashing",
            likelyCause: "bcrypt native bindings not compiled correctly",
            recoveryAction: "Reinstall bcrypt package. On some systems, use bcryptjs (pure JS) as fallback.",
            shouldRetry: true,
          },
          {
            symptom: "JWT token validation always fails",
            likelyCause: "Secret key not set or different between sign and verify",
            recoveryAction: "Ensure JWT_SECRET environment variable is set and used consistently. Check token is being passed correctly in Authorization header.",
            shouldRetry: true,
          },
          {
            symptom: "User creation succeeds but login fails",
            likelyCause: "Password comparison logic incorrect or password not hashed on registration",
            recoveryAction: "Verify bcrypt.compare is used correctly. Check that password_hash column contains hashed value, not plaintext.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT create frontend login forms",
          "Do NOT add OAuth/social login",
          "Do NOT implement password reset flow",
          "Do NOT add email verification",
          "Do NOT add rate limiting yet (comes in Step 11)",
        ],
      },
      {
        step: 4,
        title: "Frontend Foundation",
        objective: "Set up frontend routing and layout",
        prompt: `Set up the frontend foundation for "${ideaTitle}".

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

Do NOT implement authentication forms yet.`,
        expectedOutcome: "Frontend routes and layouts working with placeholder content",
        waitInstruction: "STOP here. Navigate through all routes to verify routing works before proceeding to Step 5.",
        dependencies: [1],
        estimatedTime: "15-25 minutes",
        tags: ["frontend", "layout", "routing"],
        prerequisites: [
          {
            stepNumber: 1,
            description: "Project initialized with React and Tailwind CSS configured",
            verificationCheck: "Tailwind classes render correctly, React dev server runs without errors",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "All routes are accessible and layouts render correctly",
          successCriteria: "Navigate to each route without errors. Theme toggle switches between light/dark. No console errors.",
          whenToStop: "If router throws errors, if layouts break on route change, or if styles don't apply",
        },
        failureRecovery: [
          {
            symptom: "Routes show blank page or 404",
            likelyCause: "Router not configured correctly or routes not wrapped in provider",
            recoveryAction: "Ensure RouterProvider wraps the app. Check route paths match exactly. Verify lazy-loaded components have Suspense boundaries.",
            shouldRetry: true,
          },
          {
            symptom: "Tailwind styles not applying",
            likelyCause: "Tailwind not configured to scan component files",
            recoveryAction: "Check tailwind.config.js content array includes all component paths. Ensure @tailwind directives are in CSS entry file.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT implement login/register form logic",
          "Do NOT add API calls",
          "Do NOT add authentication state management",
          "Do NOT implement protected route logic yet",
          "Do NOT add animations or transitions",
        ],
      },
      {
        step: 5,
        title: "Authentication UI",
        objective: "Create login and registration forms",
        prompt: `Implement the authentication UI for "${ideaTitle}".

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

Connect the frontend to the backend API endpoints.`,
        expectedOutcome: "Users can register, login, and logout with proper redirects",
        waitInstruction: "STOP here. Test the complete auth flow (register → login → access dashboard → logout) before proceeding to Step 6.",
        dependencies: [3, 4],
        estimatedTime: "25-35 minutes",
        tags: ["frontend", "authentication", "forms"],
        prerequisites: [
          {
            stepNumber: 3,
            description: "Authentication API endpoints are working",
            verificationCheck: "POST to /api/auth/register and /api/auth/login return expected responses",
          },
          {
            stepNumber: 4,
            description: "Frontend routing and layouts are in place",
            verificationCheck: "Navigate to /login and /register routes, layouts render correctly",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Complete authentication flow works end-to-end",
          successCriteria: "Register new user successfully. Login with those credentials. Token stored in localStorage. Dashboard accessible. Logout clears token and redirects.",
          whenToStop: "If API calls fail with CORS errors, if token storage fails, or if redirects don't work",
        },
        failureRecovery: [
          {
            symptom: "CORS error on API calls",
            likelyCause: "Backend not configured to accept requests from frontend origin",
            recoveryAction: "Add CORS middleware to Express with appropriate origin. Ensure credentials: true if sending cookies.",
            shouldRetry: true,
          },
          {
            symptom: "Form submits but nothing happens",
            likelyCause: "Form not preventing default or API call not awaited",
            recoveryAction: "Add e.preventDefault() to form onSubmit. Ensure async/await is used correctly. Check network tab for actual request.",
            shouldRetry: true,
          },
          {
            symptom: "Token not persisting across page refreshes",
            likelyCause: "localStorage not being read on app initialization",
            recoveryAction: "Initialize auth state from localStorage in useEffect. Ensure token is read before rendering protected routes.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add social login (OAuth)",
          "Do NOT implement forgot password",
          "Do NOT add email verification UI",
          "Do NOT add multi-factor authentication",
          "Do NOT add session management UI",
        ],
      },
      {
        step: 6,
        title: "Dashboard Foundation",
        objective: "Create the main dashboard view",
        prompt: `Implement the dashboard for "${ideaTitle}".

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

Style the dashboard to be clean and professional.`,
        expectedOutcome: "Dashboard displays user info with navigation and placeholder content",
        waitInstruction: "STOP here. Verify the dashboard loads correctly with user data before proceeding to Step 7.",
        dependencies: [5],
        estimatedTime: "20-30 minutes",
        tags: ["frontend", "dashboard", "layout"],
        prerequisites: [
          {
            stepNumber: 5,
            description: "Authentication UI complete with working login flow",
            verificationCheck: "Can log in and token is stored, protected routes redirect correctly",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Dashboard loads with authenticated user data and navigation works",
          successCriteria: "User name displays correctly. Sidebar navigation highlights current route. Logout button works. No flickering or layout shifts.",
          whenToStop: "If user data fails to load, if navigation breaks, or if layout doesn't render",
        },
        failureRecovery: [
          {
            symptom: "Dashboard shows loading forever",
            likelyCause: "API call not completing or token not being sent",
            recoveryAction: "Check Authorization header is being sent. Verify API endpoint returns data. Add timeout and error handling.",
            shouldRetry: true,
          },
          {
            symptom: "User data shows as undefined",
            likelyCause: "API response structure different from expected",
            recoveryAction: "Log API response to console. Check response.data vs response.data.user. Update destructuring accordingly.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT implement real stats or metrics",
          "Do NOT add real-time updates",
          "Do NOT implement notification system",
          "Do NOT add user avatar upload",
          "Do NOT add complex dashboard widgets",
        ],
      },
      {
        step: 7,
        title: "Core Feature Backend",
        objective: "Implement the main feature API endpoints",
        prompt: `Implement the core feature API for "${ideaTitle}".

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

All endpoints should require authentication.`,
        expectedOutcome: "CRUD API endpoints working and tested",
        waitInstruction: "STOP here. Test all CRUD operations with authenticated requests before proceeding to Step 8.",
        dependencies: [3],
        estimatedTime: "25-35 minutes",
        tags: ["backend", "api", "crud"],
        prerequisites: [
          {
            stepNumber: 3,
            description: "Authentication middleware is working",
            verificationCheck: "Protected routes return 401 without token, 200 with valid token",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "All CRUD operations work correctly with proper authentication",
          successCriteria: "Create returns new resource with ID. Read returns correct data. Update modifies existing. Delete removes resource. All require auth.",
          whenToStop: "If database operations fail, if validation doesn't catch invalid data, or if auth bypass is possible",
        },
        failureRecovery: [
          {
            symptom: "Foreign key constraint error on insert",
            likelyCause: "User ID not being set correctly from auth context",
            recoveryAction: "Ensure req.user.id is available from auth middleware. Verify user_id column references users table correctly.",
            shouldRetry: true,
          },
          {
            symptom: "Zod validation passes invalid data",
            likelyCause: "Schema not strict enough or not being applied",
            recoveryAction: "Add .strict() to Zod schema. Ensure schema.parse() is called before database operations.",
            shouldRetry: true,
          },
          {
            symptom: "Pagination returns wrong count",
            likelyCause: "Count query not matching filter query",
            recoveryAction: "Ensure COUNT query uses same WHERE clause as data query. Use database transaction if needed for consistency.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add file uploads",
          "Do NOT implement search functionality",
          "Do NOT add bulk operations",
          "Do NOT implement soft delete",
          "Do NOT add audit logging yet",
        ],
      },
      {
        step: 8,
        title: "Core Feature Frontend",
        objective: "Create the main feature UI",
        prompt: `Implement the core feature UI for "${ideaTitle}".

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

Connect all UI to the backend API endpoints.`,
        expectedOutcome: "Users can create, view, edit, and delete resources through the UI",
        waitInstruction: "STOP here. Test the complete CRUD flow through the UI before proceeding to Step 9.",
        dependencies: [6, 7],
        estimatedTime: "30-40 minutes",
        tags: ["frontend", "crud", "forms"],
        prerequisites: [
          {
            stepNumber: 6,
            description: "Dashboard layout is complete with navigation",
            verificationCheck: "Dashboard renders with sidebar, user can navigate to different sections",
          },
          {
            stepNumber: 7,
            description: "Backend CRUD API endpoints are working",
            verificationCheck: "All CRUD operations tested successfully via curl or Postman",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Full CRUD cycle works through the UI without errors",
          successCriteria: "Create item via form, see it in list, edit it, delete it. Optimistic updates feel snappy. Error states display correctly.",
          whenToStop: "If API calls fail silently, if cache doesn't update after mutations, or if forms submit with invalid data",
        },
        failureRecovery: [
          {
            symptom: "List doesn't update after creating/editing",
            likelyCause: "React Query cache not being invalidated",
            recoveryAction: "Add queryClient.invalidateQueries({ queryKey: ['resources'] }) in mutation onSuccess callback.",
            shouldRetry: true,
          },
          {
            symptom: "Form validation errors not displaying",
            likelyCause: "Form library not wired to show field errors",
            recoveryAction: "Ensure form.formState.errors is mapped to display messages. Check Zod resolver is connected correctly.",
            shouldRetry: true,
          },
          {
            symptom: "Delete confirmation modal doesn't work",
            likelyCause: "Modal state not being managed correctly",
            recoveryAction: "Use controlled modal with isOpen state. Ensure onClose resets state. Prevent event bubbling.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add drag-and-drop reordering",
          "Do NOT implement inline editing",
          "Do NOT add bulk selection/actions",
          "Do NOT add export functionality yet",
          "Do NOT add real-time updates",
        ],
      },
      {
        step: 9,
        title: "Settings and Preferences",
        objective: "Implement user settings page",
        prompt: `Implement the settings page for "${ideaTitle}".

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

Ensure all changes persist correctly.`,
        expectedOutcome: "Users can update their profile, preferences, and password",
        waitInstruction: "STOP here. Test all settings functionality before proceeding to Step 10.",
        dependencies: [6],
        estimatedTime: "25-35 minutes",
        tags: ["frontend", "settings", "preferences"],
        prerequisites: [
          {
            stepNumber: 6,
            description: "Dashboard with settings navigation link exists",
            verificationCheck: "Can navigate to /settings from dashboard sidebar",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "All settings update correctly and persist across sessions",
          successCriteria: "Profile changes save and reload correctly. Password change works (can login with new password). Theme persists after refresh. Delete requires confirmation.",
          whenToStop: "If profile updates don't persist, if password change breaks login, or if delete has no confirmation",
        },
        failureRecovery: [
          {
            symptom: "Password change succeeds but can't login with new password",
            likelyCause: "New password not being hashed or old password check failing",
            recoveryAction: "Verify current password is checked before allowing change. Ensure new password is hashed with same algorithm as registration.",
            shouldRetry: true,
          },
          {
            symptom: "Theme changes don't persist",
            likelyCause: "Preference not being saved to database or not read on app load",
            recoveryAction: "Verify PATCH request is being sent. Check theme is read from user preferences on app initialization, not just localStorage.",
            shouldRetry: true,
          },
          {
            symptom: "Account deletion doesn't work",
            likelyCause: "Foreign key constraints preventing deletion",
            recoveryAction: "Delete related records first (sessions, preferences) or set up CASCADE DELETE in database schema.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT implement two-factor authentication",
          "Do NOT add account recovery options",
          "Do NOT implement email change verification flow",
          "Do NOT add profile picture cropping",
          "Do NOT add export user data feature yet",
        ],
      },
      {
        step: 10,
        title: "Polish and Error Handling",
        objective: "Add finishing touches and comprehensive error handling",
        prompt: `Add polish and error handling to "${ideaTitle}".

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

Test the application thoroughly on different screen sizes.`,
        expectedOutcome: "Application handles all edge cases gracefully with good UX",
        waitInstruction: "STOP here. Test error scenarios and responsive design before proceeding to Step 11.",
        dependencies: [8, 9],
        estimatedTime: "30-40 minutes",
        tags: ["polish", "ux", "accessibility"],
        prerequisites: [
          {
            stepNumber: 8,
            description: "Core feature UI is functional",
            verificationCheck: "CRUD operations work through the UI without errors",
          },
          {
            stepNumber: 9,
            description: "Settings page is functional",
            verificationCheck: "Profile and preference updates work correctly",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Application handles errors gracefully and works on mobile",
          successCriteria: "Error boundary catches component crashes. 404 page shows for unknown routes. Mobile navigation works. Keyboard users can access all features.",
          whenToStop: "If errors cause white screen, if mobile layout is broken, or if keyboard navigation is impossible",
        },
        failureRecovery: [
          {
            symptom: "Error boundary shows for minor errors",
            likelyCause: "Error boundary too high in component tree or catching non-fatal errors",
            recoveryAction: "Move error boundary closer to error-prone components. Use try/catch for recoverable errors instead of letting them bubble.",
            shouldRetry: true,
          },
          {
            symptom: "Toast notifications stack up and don't dismiss",
            likelyCause: "Toast not configured with auto-dismiss or unique keys",
            recoveryAction: "Add duration to toast options. Ensure each toast has unique ID to prevent duplicates.",
            shouldRetry: true,
          },
          {
            symptom: "Sidebar overlaps content on mobile",
            likelyCause: "Sidebar not configured for responsive behavior",
            recoveryAction: "Use mobile-first responsive design. Add hamburger menu for mobile. Ensure sidebar has fixed/absolute positioning with proper z-index.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT add complex animations",
          "Do NOT implement offline mode",
          "Do NOT add performance optimizations yet",
          "Do NOT add analytics tracking",
          "Do NOT implement A/B testing",
        ],
      },
      {
        step: 11,
        title: "Security Hardening",
        objective: "Implement security best practices",
        prompt: `Implement security hardening for "${ideaTitle}".

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

Review the OWASP Top 10 checklist.`,
        expectedOutcome: "Application follows security best practices",
        waitInstruction: "STOP here. Run a security audit before proceeding to Step 12.",
        dependencies: [10],
        estimatedTime: "20-30 minutes",
        tags: ["security", "hardening"],
        prerequisites: [
          {
            stepNumber: 10,
            description: "Application is feature-complete with error handling",
            verificationCheck: "All features work correctly, errors are handled gracefully",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Security headers are present and rate limiting works",
          successCriteria: "Check response headers in browser dev tools. Trigger rate limit by rapid requests (should get 429). Verify no sensitive data in logs.",
          whenToStop: "If rate limiting blocks legitimate use, if CSP breaks the app, or if logging exposes passwords",
        },
        failureRecovery: [
          {
            symptom: "CSP blocks inline styles or scripts",
            likelyCause: "CSP too restrictive for the application's needs",
            recoveryAction: "Add nonce to inline scripts or move to external files. Use 'unsafe-inline' only as last resort. Check console for specific violations.",
            shouldRetry: true,
          },
          {
            symptom: "Rate limiting triggers on normal use",
            likelyCause: "Limits too aggressive or counting incorrectly",
            recoveryAction: "Increase limits for normal endpoints. Use sliding window instead of fixed. Ensure IP/user identification is correct.",
            shouldRetry: true,
          },
          {
            symptom: "HSTS causes problems in development",
            likelyCause: "HSTS header being set in development environment",
            recoveryAction: "Only set HSTS in production. Use environment variable check. Remember HSTS is cached by browsers.",
            shouldRetry: false,
          },
        ],
        scopeGuardrails: [
          "Do NOT implement WAF (Web Application Firewall)",
          "Do NOT add CAPTCHA",
          "Do NOT implement IP blocking",
          "Do NOT add honeypot fields",
          "Do NOT implement fraud detection",
        ],
      },
      {
        step: 12,
        title: "Testing and Deployment",
        objective: "Add tests and prepare for deployment",
        prompt: `Add tests and prepare "${ideaTitle}" for deployment.

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

The application is now ready for deployment!`,
        expectedOutcome: "Tests passing and application ready for production deployment",
        waitInstruction: "COMPLETE! The application is ready for deployment.",
        dependencies: [11],
        estimatedTime: "30-45 minutes",
        tags: ["testing", "deployment"],
        prerequisites: [
          {
            stepNumber: 11,
            description: "Security hardening is complete",
            verificationCheck: "Security headers present, rate limiting works, no sensitive data logged",
          },
        ],
        verificationCheckpoint: {
          whatToVerify: "Tests pass and production build works",
          successCriteria: "All tests pass. Production build completes without errors. Application runs in production mode. Environment variables are documented.",
          whenToStop: "If tests fail, if build fails, or if production mode has different behavior than development",
        },
        failureRecovery: [
          {
            symptom: "Tests fail with module not found",
            likelyCause: "Test environment not configured with same module resolution as app",
            recoveryAction: "Configure Jest/Vitest module aliases to match tsconfig paths. Ensure test setup file loads correctly.",
            shouldRetry: true,
          },
          {
            symptom: "Production build succeeds but app doesn't work",
            likelyCause: "Environment variables not available or API URL wrong in production",
            recoveryAction: "Check VITE_ prefix for frontend env vars. Verify API_URL points to correct production endpoint. Test with production env locally first.",
            shouldRetry: true,
          },
          {
            symptom: "Bundle size too large",
            likelyCause: "Large dependencies not tree-shaken or unnecessary imports",
            recoveryAction: "Use bundle analyzer to identify large chunks. Check for barrel file imports (import from specific path instead). Consider lazy loading routes.",
            shouldRetry: true,
          },
        ],
        scopeGuardrails: [
          "Do NOT set up CI/CD pipelines",
          "Do NOT configure multiple environments (staging, etc.)",
          "Do NOT add end-to-end tests",
          "Do NOT implement canary deployments",
          "Do NOT add monitoring/alerting setup",
        ],
      },
    ];
  }

  /**
   * Adapt a prompt for specific IDE
   */
  private adaptPromptForIDE(prompt: BuildPrompt, ide: IDEType): BuildPrompt {
    const adapted = { ...prompt };

    switch (ide) {
      case "replit":
        adapted.prompt = this.adaptForReplit(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Check the Replit preview panel to verify.`;
        break;

      case "cursor":
        adapted.prompt = this.adaptForCursor(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Use Cursor's terminal to verify.`;
        break;

      case "lovable":
        adapted.prompt = this.adaptForLovable(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Check the Lovable preview.`;
        break;

      case "antigravity":
        adapted.prompt = this.adaptForAntigravity(prompt.prompt);
        break;

      case "warp":
        adapted.prompt = this.adaptForWarp(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Verify in your code editor.`;
        break;

      case "other":
      default:
        // Keep generic prompt
        break;
    }

    return adapted;
  }

  /**
   * Adapt prompt for Replit
   */
  private adaptForReplit(prompt: string): string {
    return `[REPLIT AGENT PROMPT]

${prompt}

REPLIT-SPECIFIC NOTES:
- Use the Replit database integration if available
- The server should bind to 0.0.0.0:5000
- Use the packager tool for dependencies
- Workflows will auto-restart after changes`;
  }

  /**
   * Adapt prompt for Cursor
   */
  private adaptForCursor(prompt: string): string {
    return `[CURSOR PROMPT]

${prompt}

CURSOR-SPECIFIC NOTES:
- Use @codebase to reference existing code
- Use Cmd+K for inline edits
- Use the Composer for multi-file changes
- Run terminal commands as needed`;
  }

  /**
   * Adapt prompt for Lovable
   */
  private adaptForLovable(prompt: string): string {
    return `[LOVABLE PROMPT]

${prompt}

LOVABLE-SPECIFIC NOTES:
- Focus on UI components first
- Use Lovable's component library
- Preview changes in real-time
- Backend may need separate setup`;
  }

  /**
   * Adapt prompt for Antigravity
   */
  private adaptForAntigravity(prompt: string): string {
    return `[ANTIGRAVITY PROMPT]

${prompt}

ANTIGRAVITY-SPECIFIC NOTES:
- Use natural language descriptions
- Let the AI handle file organization
- Review generated code carefully`;
  }

  /**
   * Adapt prompt for Warp
   */
  private adaptForWarp(prompt: string): string {
    return `[WARP + CODE EDITOR PROMPT]

${prompt}

WARP-SPECIFIC NOTES:
- Use Warp AI for command suggestions
- Use blocks for organized terminal output
- Pair with your preferred code editor
- Use Warp's workflows for repetitive tasks`;
  }

  /**
   * Calculate total estimated time
   */
  private calculateTotalTime(prompts: BuildPrompt[]): string {
    let minTotal = 0;
    let maxTotal = 0;

    for (const prompt of prompts) {
      if (prompt.estimatedTime) {
        const match = prompt.estimatedTime.match(/(\d+)-(\d+)/);
        if (match) {
          minTotal += parseInt(match[1]);
          maxTotal += parseInt(match[2]);
        }
      }
    }

    const minHours = Math.floor(minTotal / 60);
    const maxHours = Math.floor(maxTotal / 60);

    if (minHours > 0) {
      return `${minHours}-${maxHours} hours`;
    }
    return `${minTotal}-${maxTotal} minutes`;
  }

  /**
   * Generate summary
   */
  private generateSummary(ideaTitle: string, ide: IDEType, stepCount: number): string {
    return `This document contains ${stepCount} sequential prompts for building "${ideaTitle}" using ${this.ideNames[ide]}. Each prompt includes prerequisites, verification checkpoints, failure recovery guidance, and scope guardrails. Prompts are copy-paste ready, dependency-aware, and failure-safe.`;
  }

  /**
   * Format prompt content with all intelligence fields
   */
  private formatPromptContent(prompt: BuildPrompt): string {
    let content = `**Objective:** ${prompt.objective}\n**Estimated Time:** ${prompt.estimatedTime || "15-20 minutes"}\n`;
    
    if (prompt.dependencies && prompt.dependencies.length > 0) {
      content += `**Dependencies:** Steps ${prompt.dependencies.join(", ")}\n`;
    }

    // Prerequisites section
    if (prompt.prerequisites && prompt.prerequisites.length > 0) {
      content += `\n### Prerequisites\n`;
      content += `Before starting this step, verify:\n\n`;
      for (const prereq of prompt.prerequisites) {
        content += `- **Step ${prereq.stepNumber}:** ${prereq.description}\n`;
        content += `  - *Check:* ${prereq.verificationCheck}\n`;
      }
    }

    content += `\n---\n\n### Prompt\n\n\`\`\`\n${prompt.prompt}\n\`\`\`\n`;

    // Scope guardrails
    if (prompt.scopeGuardrails && prompt.scopeGuardrails.length > 0) {
      content += `\n### Scope Guardrails\n`;
      content += `**What NOT to do in this step:**\n\n`;
      for (const guardrail of prompt.scopeGuardrails) {
        content += `- ${guardrail}\n`;
      }
    }

    content += `\n### Expected Outcome\n${prompt.expectedOutcome}\n`;

    // Verification checkpoint
    if (prompt.verificationCheckpoint) {
      content += `\n### Verification Checkpoint\n`;
      content += `**What to verify:** ${prompt.verificationCheckpoint.whatToVerify}\n\n`;
      content += `**Success looks like:** ${prompt.verificationCheckpoint.successCriteria}\n\n`;
      content += `**When to stop:** ${prompt.verificationCheckpoint.whenToStop}\n`;
    }

    // Failure recovery
    if (prompt.failureRecovery && prompt.failureRecovery.length > 0) {
      content += `\n### If This Fails\n`;
      for (const failure of prompt.failureRecovery) {
        content += `\n**Symptom:** ${failure.symptom}\n`;
        content += `- *Likely cause:* ${failure.likelyCause}\n`;
        content += `- *Recovery:* ${failure.recoveryAction}\n`;
        content += `- *Action:* ${failure.shouldRetry ? "Fix and retry this step" : "Roll back and investigate"}\n`;
      }
    }

    content += `\n### ${prompt.waitInstruction}`;

    return content;
  }

  /**
   * Save prompts as Markdown artifact
   */
  private async saveAsArtifact(document: PromptDocument) {
    const sections = [
      {
        heading: "Overview",
        level: 2 as const,
        content: `${document.summary}\n\n**Total Steps:** ${document.totalSteps}\n**Estimated Time:** ${document.estimatedTotalTime}\n**Target IDE:** ${document.ideName}\n**Source:** ${document.ideaTitle}`,
      },
      {
        heading: "Instructions",
        level: 2 as const,
        content: `1. Copy each prompt exactly as written\n2. Paste into your ${document.ideName} AI assistant\n3. Wait for the AI to complete the task\n4. Verify the expected outcome\n5. Follow the STOP/WAIT instruction before proceeding\n6. Only move to the next step after verification\n\n**Important:** Do not skip steps. Each prompt builds on the previous one.`,
      },
      ...document.prompts.map((prompt) => ({
        heading: `Step ${prompt.step}: ${prompt.title}`,
        level: 2 as const,
        content: this.formatPromptContent(prompt),
      })),
      {
        heading: "Completion Checklist",
        level: 2 as const,
        content: document.prompts.map((p) => `- [ ] Step ${p.step}: ${p.title}`).join("\n"),
      },
    ];

    const stage: PipelineStage = "PROMPTS_GENERATED";
    const artifact = await artifactService.create({
      title: `Build Prompts: ${document.ideaTitle} (${document.ideName})`,
      module: "prompts",
      sections,
      aiNotes: [
        {
          provider: "system",
          note: `Generated ${document.totalSteps} prompts for ${document.ideName}`,
          confidence: 0.95,
        },
      ],
      tags: ["prompts", "build", document.ide, "executable"],
      stage,
      sourceArtifactId: document.requirementsArtifactId,
      sourceArtifactVersion: document.sourceArtifactVersion,
    });

    return artifact;
  }

  getDefaultStepPrompt(stepNumber: number): BuildPrompt {
    return {
      step: stepNumber,
      title: `Step ${stepNumber}`,
      objective: "Complete this step of the build process",
      prompt: "",
      expectedOutcome: "Step completes successfully",
      waitInstruction: "STOP and verify before proceeding",
      failureRecovery: [
        {
          symptom: "npm install fails with dependency conflicts",
          likelyCause: "Incompatible package versions or corrupt cache",
          recoveryAction: "Delete node_modules and package-lock.json, then run npm install again. If still failing, check for version conflicts in package.json.",
          shouldRetry: true,
        },
        {
          symptom: "TypeScript compilation errors",
          likelyCause: "Missing or misconfigured tsconfig.json",
          recoveryAction: "Ensure tsconfig.json exists with correct compiler options. Check that jsx is set to react-jsx and module is set appropriately.",
          shouldRetry: true,
        },
        {
          symptom: "Port already in use error",
          likelyCause: "Another process is using the port",
          recoveryAction: "Kill the process using the port or configure a different port in the server configuration.",
          shouldRetry: true,
        },
        {
          symptom: "Database connection refused",
          likelyCause: "Database not running or connection string incorrect",
          recoveryAction: "Verify DATABASE_URL is set correctly. Check that PostgreSQL is running. Test connection with a database client.",
          shouldRetry: true,
        },
        {
          symptom: "CORS error on API calls",
          likelyCause: "Backend not configured to accept requests from frontend origin",
          recoveryAction: "Add CORS middleware to Express with appropriate origin. Ensure credentials: true if sending cookies.",
          shouldRetry: true,
        },
      ],
    };
  }
}

export const promptsService = new PromptsService();
