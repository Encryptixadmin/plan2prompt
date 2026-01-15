import type {
  FailureCategory,
  FailurePatternDefinition,
  FailureScope,
} from "@shared/types/prompts";

export const UNKNOWN_FAILURE_PATTERN: FailurePatternDefinition = {
  id: "UNKNOWN_UNCLASSIFIED",
  category: "unknown",
  name: "Unclassified Failure",
  detectionHints: [],
  cause: "The system cannot determine the cause from the provided output.",
  recoverySteps: [
    "STOP execution immediately",
    "Do not continue to subsequent steps",
    "Regenerate prompts only if the issue persists after multiple attempts",
  ],
  retryAllowed: false,
  regenerateSuggested: false,
  appliesTo: "single_step",
};

export const FAILURE_PATTERN_TAXONOMY: FailurePatternDefinition[] = [
  {
    id: "DEP_NPM_ERESOLVE",
    category: "dependency",
    name: "NPM Dependency Conflict",
    detectionHints: [
      "ERESOLVE",
      "peer dep",
      "dependency conflict",
      "could not resolve",
      "npm ERR!",
    ],
    cause: "Incompatible package versions or corrupt cache",
    recoverySteps: [
      "Delete node_modules folder",
      "Delete package-lock.json file",
      "Run package install command again",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "SYNTAX_TS_COMPILE",
    category: "syntax",
    name: "TypeScript Compilation Error",
    detectionHints: [
      "TS2",
      "TS1",
      "TS\\d{4}:",
      "cannot find module",
      "type error",
    ],
    cause: "TypeScript type mismatch or missing module declarations",
    recoverySteps: [
      "Verify tsconfig.json exists and is valid",
      "Check import paths are correct",
      "Ensure all dependencies are installed",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "single_step",
  },
  {
    id: "ENV_PORT_IN_USE",
    category: "environment",
    name: "Port Already In Use",
    detectionHints: [
      "EADDRINUSE",
      "port.*already in use",
      "address already in use",
    ],
    cause: "Another process is using the required port",
    recoverySteps: [
      "Kill the process using the port",
      "Or configure a different port in environment variables",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "NET_DB_CONN_REFUSED",
    category: "network",
    name: "Database Connection Refused",
    detectionHints: [
      "ECONNREFUSED",
      "connection refused",
      "could not connect.*postgres",
      "could not connect.*database",
    ],
    cause: "Database not running or connection string incorrect",
    recoverySteps: [
      "Verify DATABASE_URL is set correctly",
      "Check that PostgreSQL is running",
      "Test connection with a database client",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "PERM_DB_MIGRATION",
    category: "permission",
    name: "Migration Permission Denied",
    detectionHints: [
      "permission denied",
      "access denied",
      "insufficient privileges",
    ],
    cause: "Database user lacks required permissions",
    recoverySteps: [
      "Grant necessary permissions to database user",
      "Or use a user with admin privileges for migrations",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "RUNTIME_BCRYPT",
    category: "runtime",
    name: "bcrypt Native Bindings Error",
    detectionHints: [
      "bcrypt.*error",
      "node-pre-gyp",
      "native bindings",
    ],
    cause: "bcrypt native bindings not compiled correctly for platform",
    recoverySteps: [
      "Reinstall bcrypt package",
      "Or use bcryptjs (pure JS) as fallback",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "CONFIG_JWT_SECRET",
    category: "configuration",
    name: "JWT Token Validation Failure",
    detectionHints: [
      "jwt.*invalid",
      "invalid signature",
      "token.*expired",
      "malformed token",
    ],
    cause: "JWT secret not set or mismatched between sign and verify",
    recoverySteps: [
      "Ensure JWT_SECRET environment variable is set",
      "Check token is passed correctly in Authorization header",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "NET_CORS_BLOCK",
    category: "network",
    name: "CORS Error",
    detectionHints: [
      "CORS",
      "cross-origin",
      "blocked by CORS",
      "Access-Control-Allow",
    ],
    cause: "Backend not configured to accept requests from frontend origin",
    recoverySteps: [
      "Add CORS middleware to Express",
      "Set appropriate origin configuration",
      "Ensure credentials: true if sending cookies",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "single_step",
  },
  {
    id: "RUNTIME_UNDEFINED_REF",
    category: "runtime",
    name: "Undefined Reference Error",
    detectionHints: [
      "cannot read property",
      "undefined is not an object",
      "TypeError.*undefined",
      "null.*undefined",
    ],
    cause: "Variable or property accessed before initialization",
    recoverySteps: [
      "Check variable initialization order",
      "Add null/undefined checks before access",
      "Verify data is loaded before rendering",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "single_step",
  },
  {
    id: "TOOLING_TAILWIND",
    category: "tooling",
    name: "Tailwind Styles Not Applying",
    detectionHints: [
      "tailwind.*not",
      "styles.*not.*applying",
      "postcss.*error",
    ],
    cause: "Tailwind CSS configuration or build issue",
    recoverySteps: [
      "Verify tailwind.config exists and content paths are correct",
      "Check postcss.config.js is present",
      "Restart the development server",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
  {
    id: "ENV_MODULE_NOT_FOUND",
    category: "environment",
    name: "Module Not Found",
    detectionHints: [
      "Cannot find module",
      "Module not found",
      "ERR_MODULE_NOT_FOUND",
    ],
    cause: "Required module not installed or path is incorrect",
    recoverySteps: [
      "Run package install command",
      "Verify import path matches file location",
      "Check package.json includes the dependency",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "single_step",
  },
  {
    id: "CONFIG_ENV_VAR_MISSING",
    category: "configuration",
    name: "Missing Environment Variable",
    detectionHints: [
      "environment variable.*not set",
      "undefined.*process.env",
      "missing.*env",
    ],
    cause: "Required environment variable not configured",
    recoverySteps: [
      "Check .env file contains the required variable",
      "Verify environment variable is exported in current shell",
      "Restart the application after setting the variable",
    ],
    retryAllowed: true,
    regenerateSuggested: false,
    appliesTo: "environment_wide",
  },
];

export function getPatternById(id: string): FailurePatternDefinition | undefined {
  if (id === "UNKNOWN_UNCLASSIFIED") {
    return UNKNOWN_FAILURE_PATTERN;
  }
  return FAILURE_PATTERN_TAXONOMY.find((p) => p.id === id);
}

export function getAllPatterns(): FailurePatternDefinition[] {
  return [...FAILURE_PATTERN_TAXONOMY, UNKNOWN_FAILURE_PATTERN];
}

export function getPatternsByCategory(category: FailureCategory): FailurePatternDefinition[] {
  return FAILURE_PATTERN_TAXONOMY.filter((p) => p.category === category);
}
