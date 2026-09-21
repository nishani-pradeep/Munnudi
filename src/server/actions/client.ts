import { createSafeActionClient } from "next-safe-action";

/**
 * Shared next-safe-action client. This — plus Zod validation on each action's
 * input schema — is the entire "backend API" (PRD 18 explicitly prefers typed
 * server functions over a broad REST API; there is no route-handler layer).
 */
export const actionClient = createSafeActionClient({
  handleServerError(error) {
    console.error("[server action]", error);
    if (error instanceof Error) {
      const cause = (error as { cause?: Error }).cause;
      if (cause?.message) return cause.message;
      return error.message;
    }
    return "Something went wrong.";
  },
});
