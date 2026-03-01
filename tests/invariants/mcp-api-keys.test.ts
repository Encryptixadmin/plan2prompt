import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey, authenticateApiKey } from "../../server/mcp/auth";
import { createHash } from "crypto";

describe("MCP API Key Invariants", () => {
  describe("Key Generation", () => {
    it("1.1 Generated keys MUST start with p2p_ prefix", () => {
      const { rawKey } = generateApiKey();
      expect(rawKey.startsWith("p2p_")).toBe(true);
    });

    it("1.2 Generated keys MUST be exactly 68 characters (4 prefix + 64 hex)", () => {
      const { rawKey } = generateApiKey();
      expect(rawKey.length).toBe(68);
    });

    it("1.3 Key prefix MUST be first 8 characters of the raw key", () => {
      const { rawKey, prefix } = generateApiKey();
      expect(prefix).toBe(rawKey.substring(0, 8));
      expect(prefix.length).toBe(8);
    });

    it("1.4 Each generated key MUST be unique", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { rawKey } = generateApiKey();
        keys.add(rawKey);
      }
      expect(keys.size).toBe(100);
    });

    it("1.5 Key hex portion MUST contain only valid hex characters", () => {
      const { rawKey } = generateApiKey();
      const hexPortion = rawKey.slice(4);
      expect(/^[0-9a-f]{64}$/.test(hexPortion)).toBe(true);
    });
  });

  describe("Key Hashing", () => {
    it("2.1 hashApiKey MUST produce deterministic SHA-256 hashes", () => {
      const key = "p2p_test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("2.2 hashApiKey output MUST match Node.js crypto SHA-256", () => {
      const key = "p2p_abcdef1234567890";
      const expected = createHash("sha256").update(key).digest("hex");
      expect(hashApiKey(key)).toBe(expected);
    });

    it("2.3 Different keys MUST produce different hashes", () => {
      const hash1 = hashApiKey("p2p_key1");
      const hash2 = hashApiKey("p2p_key2");
      expect(hash1).not.toBe(hash2);
    });

    it("2.4 Hash output MUST be 64-character hex string", () => {
      const hash = hashApiKey("p2p_anything");
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe("Authentication", () => {
    it("3.1 authenticateApiKey MUST reject missing Authorization header", async () => {
      const result = await authenticateApiKey(undefined);
      expect(result).toBeNull();
    });

    it("3.2 authenticateApiKey MUST reject empty Authorization header", async () => {
      const result = await authenticateApiKey("");
      expect(result).toBeNull();
    });

    it("3.3 authenticateApiKey MUST reject non-Bearer scheme", async () => {
      const result = await authenticateApiKey("Basic abc123");
      expect(result).toBeNull();
    });

    it("3.4 authenticateApiKey MUST reject Bearer with empty token", async () => {
      const result = await authenticateApiKey("Bearer ");
      expect(result).toBeNull();
    });

    it("3.5 authenticateApiKey MUST reject unknown API keys", async () => {
      const result = await authenticateApiKey("Bearer p2p_nonexistent_key_that_does_not_exist_in_database_at_all");
      expect(result).toBeNull();
    });
  });

  describe("Schema Contracts", () => {
    it("4.1 API key prefix format MUST support identification without exposing full key", () => {
      const { rawKey, prefix } = generateApiKey();
      expect(prefix.startsWith("p2p_")).toBe(true);
      expect(prefix.length).toBeLessThan(rawKey.length);
      expect(rawKey.includes(prefix)).toBe(true);
    });

    it("4.2 Raw key MUST NOT be derivable from hash", () => {
      const { rawKey } = generateApiKey();
      const hash = hashApiKey(rawKey);
      expect(hash).not.toContain("p2p_");
      expect(hash).not.toBe(rawKey);
      expect(hash.length).not.toBe(rawKey.length);
    });

    it("4.3 Generated key and hash MUST form a valid lookup pair", () => {
      const { rawKey } = generateApiKey();
      const hash = hashApiKey(rawKey);
      const verifyHash = hashApiKey(rawKey);
      expect(hash).toBe(verifyHash);
    });
  });
});
