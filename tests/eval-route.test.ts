import { afterEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { createDefaultDeps } from "@/lib/pipeline";
import { POST } from "@/app/api/eval/route";

vi.mock("@/lib/pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pipeline")>();
  return { ...actual, createDefaultDeps: vi.fn(actual.createDefaultDeps) };
});

afterEach(() => vi.restoreAllMocks());

describe("public sample evaluation", () => {
  it.each(["live", "auto", "mock"] as const)(
    "uses only cached fixtures even when the server is configured as %s",
    async (mode) => {
      const network = vi.fn(async () => {
        throw new Error("Network must not be used by the public sample eval");
      });
      vi.mocked(createDefaultDeps).mockReturnValue({
        env: {
          ...readEnv({}), mode,
          // Deliberately synthetic values, with fetch replaced below.
          nebiusApiKey: "unit-test-not-a-credential",
          tavilyApiKey: "unit-test-not-a-credential",
        },
        fetch: network,
        now: () => 0,
        sleep: async () => {},
        present: false,
      });

      const response = await POST();
      const report = await response.json();
      expect(response.status).toBe(200);
      expect(report).toMatchObject({ mode: "mock", agreement: 10, total: 10 });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(network).not.toHaveBeenCalled();
    },
  );
});