import { randomUUID } from "crypto";
import type {
  IDEType,
  PromptDocument,
  BuildPrompt,
  PromptFeedbackRequest,
  PromptFeedbackResponse,
  KnownFailureResponse,
  UnknownFailureResponse,
  FeedbackAuditEntry,
  FailureRecoveryBranch,
} from "@shared/types/prompts";

interface FailurePattern {
  keywords: string[];
  regexPatterns?: RegExp[];
}

interface StaticRecovery {
  symptom: string;
  likelyCause: string;
  recoverySteps: string[];
  shouldRetry: boolean;
}

const STATIC_RECOVERY_STEPS: Record<string, StaticRecovery> = {
  "npm install fails with dependency conflicts": {
    symptom: "Dependency conflict during package installation",
    likelyCause: "Incompatible package versions or corrupt cache",
    recoverySteps: [
      "Delete node_modules folder",
      "Delete package-lock.json file",
      "Run package install command again",
    ],
    shouldRetry: true,
  },
  "TypeScript compilation errors on fresh project": {
    symptom: "TypeScript compilation errors",
    likelyCause: "Missing or misconfigured tsconfig.json",
    recoverySteps: [
      "Verify tsconfig.json exists",
      "Check jsx setting is react-jsx",
      "Check module setting is correct",
    ],
    shouldRetry: true,
  },
  "Port already in use error": {
    symptom: "Port already in use",
    likelyCause: "Another process is using the port",
    recoverySteps: [
      "Kill the process using the port",
      "Or configure a different port",
    ],
    shouldRetry: true,
  },
  "Database connection refused": {
    symptom: "Database connection refused",
    likelyCause: "Database not running or connection string incorrect",
    recoverySteps: [
      "Verify DATABASE_URL is set correctly",
      "Check that PostgreSQL is running",
      "Test connection with a database client",
    ],
    shouldRetry: true,
  },
  "CORS error on API calls": {
    symptom: "CORS error on API calls",
    likelyCause: "Backend not configured to accept requests from frontend origin",
    recoverySteps: [
      "Add CORS middleware to Express",
      "Set appropriate origin",
      "Ensure credentials: true if sending cookies",
    ],
    shouldRetry: true,
  },
  "Migration fails with permission denied": {
    symptom: "Migration permission denied",
    likelyCause: "Database user lacks CREATE TABLE permission",
    recoverySteps: [
      "Grant necessary permissions to database user",
      "Or use a user with admin privileges for migrations",
    ],
    shouldRetry: true,
  },
  "bcrypt throws error during password hashing": {
    symptom: "bcrypt hashing error",
    likelyCause: "bcrypt native bindings not compiled correctly",
    recoverySteps: [
      "Reinstall bcrypt package",
      "Or use bcryptjs (pure JS) as fallback",
    ],
    shouldRetry: true,
  },
  "JWT token validation always fails": {
    symptom: "JWT token validation fails",
    likelyCause: "Secret key not set or different between sign and verify",
    recoverySteps: [
      "Ensure JWT_SECRET environment variable is set",
      "Check token is passed correctly in Authorization header",
    ],
    shouldRetry: true,
  },
};

const COMMON_FAILURE_PATTERNS: Record<string, FailurePattern> = {
  "npm install fails with dependency conflicts": {
    keywords: ["ERESOLVE", "peer dep", "dependency conflict", "could not resolve", "npm ERR!"],
    regexPatterns: [/npm ERR!/i, /ERESOLVE/i, /peer dependency/i],
  },
  "TypeScript compilation errors on fresh project": {
    keywords: ["TS2", "TS1", "cannot find module", "tsconfig", "type error"],
    regexPatterns: [/TS\d{4}:/i, /Cannot find module/i],
  },
  "Port already in use error": {
    keywords: ["EADDRINUSE", "port", "already in use", "address already in use"],
    regexPatterns: [/EADDRINUSE/i, /port \d+ is already in use/i],
  },
  "Database connection refused": {
    keywords: ["ECONNREFUSED", "connection refused", "database", "postgres", "could not connect"],
    regexPatterns: [/ECONNREFUSED/i, /connection refused/i],
  },
  "Migration fails with permission denied": {
    keywords: ["permission denied", "access denied", "insufficient privileges", "GRANT"],
    regexPatterns: [/permission denied/i, /access denied/i],
  },
  "Column type not supported error": {
    keywords: ["column type", "data type", "unsupported", "unknown type"],
    regexPatterns: [/unknown type/i, /unsupported.*type/i],
  },
  "bcrypt throws error during password hashing": {
    keywords: ["bcrypt", "hash", "native bindings", "node-pre-gyp"],
    regexPatterns: [/bcrypt.*error/i, /node-pre-gyp/i],
  },
  "JWT token validation always fails": {
    keywords: ["jwt", "invalid signature", "token expired", "malformed"],
    regexPatterns: [/jwt.*invalid/i, /invalid signature/i, /token.*expired/i],
  },
  "User creation succeeds but login fails": {
    keywords: ["invalid credentials", "password", "compare", "hash mismatch"],
    regexPatterns: [/invalid credentials/i, /password.*incorrect/i],
  },
  "Routes show blank page or 404": {
    keywords: ["404", "not found", "blank page", "route not found"],
    regexPatterns: [/404/i, /not found/i],
  },
  "Tailwind styles not applying": {
    keywords: ["tailwind", "styles not", "css not", "class not working"],
    regexPatterns: [/tailwind.*not/i, /styles.*not.*applying/i],
  },
  "CORS error on API calls": {
    keywords: ["CORS", "cross-origin", "blocked by CORS", "access-control"],
    regexPatterns: [/CORS/i, /cross-origin/i, /Access-Control-Allow/i],
  },
  "Form submits but nothing happens": {
    keywords: ["form", "submit", "nothing happens", "no response"],
    regexPatterns: [/form.*submit/i],
  },
  "Token not persisting across page refreshes": {
    keywords: ["token", "localStorage", "persist", "refresh", "lost"],
    regexPatterns: [/localStorage/i, /token.*lost/i],
  },
  "Dashboard shows loading forever": {
    keywords: ["loading", "forever", "infinite", "spinner", "stuck"],
    regexPatterns: [/loading.*forever/i, /infinite.*load/i],
  },
  "User data shows as undefined": {
    keywords: ["undefined", "null", "user data", "cannot read"],
    regexPatterns: [/undefined/i, /cannot read property/i, /TypeError/i],
  },
};

class FeedbackService {
  private auditLog: FeedbackAuditEntry[] = [];
  private readonly MAX_AUDIT_ENTRIES = 1000;

  classifyFailure(
    rawOutput: string,
    stepPrompt: BuildPrompt
  ): PromptFeedbackResponse {
    const normalizedOutput = rawOutput.toLowerCase();

    if (stepPrompt.failureRecovery && stepPrompt.failureRecovery.length > 0) {
      for (const recovery of stepPrompt.failureRecovery) {
        if (this.matchesPattern(normalizedOutput, recovery.symptom)) {
          return this.buildKnownFailureResponse(recovery);
        }
      }
    }

    for (const [patternName, pattern] of Object.entries(COMMON_FAILURE_PATTERNS)) {
      if (this.matchesCommonPattern(normalizedOutput, pattern)) {
        const matchedRecovery = stepPrompt.failureRecovery?.find(
          (r) => r.symptom.toLowerCase().includes(patternName.toLowerCase())
        );

        if (matchedRecovery) {
          return this.buildKnownFailureResponse(matchedRecovery);
        }

        return this.buildGenericKnownFailureResponse(patternName);
      }
    }

    return this.buildUnknownFailureResponse();
  }

  private matchesPattern(output: string, symptom: string): boolean {
    const symptomWords = symptom.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matchCount = symptomWords.filter((word) => output.includes(word)).length;
    return matchCount >= Math.min(3, symptomWords.length * 0.5);
  }

  private matchesCommonPattern(output: string, pattern: FailurePattern): boolean {
    if (pattern.regexPatterns) {
      for (const regex of pattern.regexPatterns) {
        if (regex.test(output)) {
          return true;
        }
      }
    }

    const matchedKeywords = pattern.keywords.filter((kw) =>
      output.includes(kw.toLowerCase())
    );
    return matchedKeywords.length >= 2;
  }

  private buildKnownFailureResponse(recovery: FailureRecoveryBranch): KnownFailureResponse {
    return {
      classification: "KNOWN_FAILURE",
      failurePatternName: recovery.symptom,
      whyThisOccurs: recovery.likelyCause,
      recoverySteps: recovery.recoveryAction.split(". ").filter((s) => s.trim()),
      instruction: "STOP. RETRY THIS STEP ONLY.",
      shouldRetry: recovery.shouldRetry,
    };
  }

  private buildGenericKnownFailureResponse(patternName: string): KnownFailureResponse {
    const staticRecovery = STATIC_RECOVERY_STEPS[patternName];
    if (staticRecovery) {
      return {
        classification: "KNOWN_FAILURE",
        failurePatternName: staticRecovery.symptom,
        whyThisOccurs: staticRecovery.likelyCause,
        recoverySteps: staticRecovery.recoverySteps,
        instruction: "STOP. RETRY THIS STEP ONLY.",
        shouldRetry: staticRecovery.shouldRetry,
      };
    }

    return {
      classification: "KNOWN_FAILURE",
      failurePatternName: patternName,
      whyThisOccurs: "Configuration or dependency issue.",
      recoverySteps: [
        "Check error message details",
        "Verify configuration files",
        "Retry the step",
      ],
      instruction: "STOP. RETRY THIS STEP ONLY.",
      shouldRetry: true,
    };
  }

  private buildUnknownFailureResponse(): UnknownFailureResponse {
    return {
      classification: "UNKNOWN_FAILURE",
      statement:
        "This failure is unclassified. The system cannot determine the cause from the provided output.",
      instruction: "STOP. DO NOT CONTINUE.",
      suggestRegeneration: false,
    };
  }

  logFeedbackAttempt(
    request: PromptFeedbackRequest,
    classification: "KNOWN_FAILURE" | "UNKNOWN_FAILURE",
    failurePatternName?: string
  ): void {
    const entry: FeedbackAuditEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      promptDocumentId: request.promptDocumentId,
      stepNumber: request.stepNumber,
      ide: request.ide,
      classification,
      failurePatternName,
    };

    this.auditLog.push(entry);

    if (this.auditLog.length > this.MAX_AUDIT_ENTRIES) {
      this.auditLog = this.auditLog.slice(-this.MAX_AUDIT_ENTRIES);
    }

    console.log(
      `[FeedbackService] Logged attempt: step=${request.stepNumber}, ` +
        `classification=${classification}, pattern=${failurePatternName || "none"}`
    );
  }

  getRecentAuditEntries(limit: number = 50): FeedbackAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  validateInput(request: PromptFeedbackRequest): { valid: boolean; error?: string } {
    if (!request.rawIdeOutput || request.rawIdeOutput.trim().length === 0) {
      return { valid: false, error: "Raw IDE output is required." };
    }

    if (request.rawIdeOutput.includes("?")) {
      const questionCount = (request.rawIdeOutput.match(/\?/g) || []).length;
      const lineCount = request.rawIdeOutput.split("\n").length;
      if (questionCount > lineCount * 0.3) {
        return {
          valid: false,
          error: "Input appears to contain questions. Paste only the raw error output from your IDE.",
        };
      }
    }

    if (request.rawIdeOutput.length < 10) {
      return { valid: false, error: "Output is too short. Paste the complete error message." };
    }

    if (request.rawIdeOutput.length > 50000) {
      return { valid: false, error: "Output is too long. Paste only the relevant error section." };
    }

    return { valid: true };
  }
}

export const feedbackService = new FeedbackService();
