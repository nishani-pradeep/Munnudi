import { createSafeActionClient } from "next-safe-action";

/**
 * Shared next-safe-action client. This — plus Zod validation on each action's
 * input schema — is the entire "backend API" (PRD 18 explicitly prefers typed
 * server functions over a broad REST API; there is no route-handler layer).
 */
export const actionClient = createSafeActionClient({
  handleServerError(error) {
    console.error("[server action]", error);
    return error instanceof Error ? error.message : "Something went wrong.";
  },
});
