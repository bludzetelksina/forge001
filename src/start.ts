import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/** Serves a published web project when the request arrives on its own domain. */
const customDomainMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const host = request?.headers.get("host") ?? "";
  if (request && host && !/(^|\.)(localhost|lovable\.app|lovable\.dev|lovableproject\.com)(:|$)/.test(host)) {
    try {
      const { serveCustomDomain } = await import("./lib/domain-serve.server");
      const response = await serveCustomDomain(request);
      if (response) return response;
    } catch (error) {
      console.error("custom domain serve failed", error);
    }
  }
  return next();
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, customDomainMiddleware, csrfMiddleware],
}));

