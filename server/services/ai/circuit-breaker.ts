import type { AIProviderType } from "@shared/types/ai";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxAttempts: 2,
};

interface CircuitInfo {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private circuits: Map<string, CircuitInfo> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getCircuit(provider: string): CircuitInfo {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: "CLOSED",
        consecutiveFailures: 0,
        lastFailureTime: null,
        halfOpenAttempts: 0,
      });
    }
    return this.circuits.get(provider)!;
  }

  canExecute(provider: string): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "CLOSED") {
      return true;
    }

    if (circuit.state === "OPEN") {
      if (
        circuit.lastFailureTime &&
        Date.now() - circuit.lastFailureTime >= this.config.resetTimeoutMs
      ) {
        circuit.state = "HALF_OPEN";
        circuit.halfOpenAttempts = 0;
        console.log(`[CircuitBreaker] ${provider}: OPEN -> HALF_OPEN (cooldown elapsed)`);
        return true;
      }
      return false;
    }

    if (circuit.state === "HALF_OPEN") {
      return circuit.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }

    return false;
  }

  recordSuccess(provider: string): void {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "HALF_OPEN") {
      circuit.state = "CLOSED";
      circuit.consecutiveFailures = 0;
      circuit.halfOpenAttempts = 0;
      circuit.lastFailureTime = null;
      console.log(`[CircuitBreaker] ${provider}: HALF_OPEN -> CLOSED (recovery successful)`);
    } else if (circuit.state === "CLOSED") {
      circuit.consecutiveFailures = 0;
    }
  }

  recordFailure(provider: string): void {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "HALF_OPEN") {
      circuit.halfOpenAttempts++;
      if (circuit.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        circuit.state = "OPEN";
        circuit.lastFailureTime = Date.now();
        console.log(`[CircuitBreaker] ${provider}: HALF_OPEN -> OPEN (recovery failed)`);
      }
      return;
    }

    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.consecutiveFailures >= this.config.failureThreshold) {
      circuit.state = "OPEN";
      console.log(
        `[CircuitBreaker] ${provider}: CLOSED -> OPEN (${circuit.consecutiveFailures} consecutive failures)`
      );
    }
  }

  getState(provider: string): CircuitState {
    const circuit = this.getCircuit(provider);

    if (
      circuit.state === "OPEN" &&
      circuit.lastFailureTime &&
      Date.now() - circuit.lastFailureTime >= this.config.resetTimeoutMs
    ) {
      circuit.state = "HALF_OPEN";
      circuit.halfOpenAttempts = 0;
    }

    return circuit.state;
  }

  getStatus(provider: string): {
    state: CircuitState;
    consecutiveFailures: number;
    lastFailureTime: number | null;
  } {
    const circuit = this.getCircuit(provider);
    const state = this.getState(provider);
    return {
      state,
      consecutiveFailures: circuit.consecutiveFailures,
      lastFailureTime: circuit.lastFailureTime,
    };
  }

  getAllStatuses(): Map<string, { state: CircuitState; consecutiveFailures: number; lastFailureTime: number | null }> {
    const statuses = new Map<string, { state: CircuitState; consecutiveFailures: number; lastFailureTime: number | null }>();
    const keys = Array.from(this.circuits.keys());
    for (const provider of keys) {
      statuses.set(provider, this.getStatus(provider));
    }
    return statuses;
  }

  reset(provider: string): void {
    this.circuits.delete(provider);
  }
}

export const circuitBreaker = new CircuitBreaker();
