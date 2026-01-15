import { randomUUID } from "crypto";
import type {
  IDEType,
  BuildPrompt,
  PromptDocument,
  IDE_OPTIONS,
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
    return `This document contains ${stepCount} sequential prompts for building "${ideaTitle}" using ${this.ideNames[ide]}. Each prompt builds on the previous one with clear STOP/WAIT instructions. Prompts are copy-paste ready and IDE-specific.`;
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
        content: `**Objective:** ${prompt.objective}\n**Estimated Time:** ${prompt.estimatedTime || "15-20 minutes"}\n${prompt.dependencies ? `**Dependencies:** Steps ${prompt.dependencies.join(", ")}\n` : ""}\n---\n\n### Prompt\n\n\`\`\`\n${prompt.prompt}\n\`\`\`\n\n### Expected Outcome\n${prompt.expectedOutcome}\n\n### ${prompt.waitInstruction}`,
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
}

export const promptsService = new PromptsService();
