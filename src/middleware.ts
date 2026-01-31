import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

// Primary domain for Ansiversa (used to build the root app URL)
const COOKIE_DOMAIN =
  import.meta.env.ANSIVERSA_COOKIE_DOMAIN ?? (import.meta.env.DEV ? "localhost" : undefined);
if (!COOKIE_DOMAIN && !import.meta.env.DEV) {
  throw new Error("ANSIVERSA_COOKIE_DOMAIN is required in production.");
}

// Root app URL
const ROOT_APP_URL =
  import.meta.env.PUBLIC_ROOT_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:2000" : `https://${COOKIE_DOMAIN}`);

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url } = context;
  const pathname = url.pathname;

  const publicRoutes = new Set([
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset",
    "/reset-password",
  ]);

  // Allow static assets
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest"
  ) {
    return next();
  }

  // Ensure predictable shape
  locals.user = locals.user ?? undefined;
  locals.sessionToken = null;
  locals.isAuthenticated = false;
  locals.rootAppUrl = ROOT_APP_URL;
  locals.session = {
    userId: "",
    roleId: null,
    plan: null,
    planStatus: null,
    isPaid: false,
    renewalAt: null,
  };

  // 1) Read the shared session cookie
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const payload = verifySessionToken(token);

    if (payload?.userId) {
      const roleId = payload.roleId ? Number(payload.roleId) : undefined;

      locals.user = {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        roleId: Number.isFinite(roleId) ? roleId : undefined,
        stripeCustomerId: payload.stripeCustomerId ?? null,
        plan: payload.plan ?? null,
        planStatus: payload.planStatus ?? null,
        isPaid: payload.isPaid === true,
        renewalAt: payload.renewalAt ?? null,
      };
      locals.session = {
        userId: payload.userId,
        roleId: payload.roleId ? String(payload.roleId) : null,
        plan: payload.plan ?? null,
        planStatus: payload.planStatus ?? null,
        isPaid: payload.isPaid === true,
        renewalAt: typeof payload.renewalAt === "number" ? payload.renewalAt : null,
      };

      locals.sessionToken = token;
      locals.isAuthenticated = true;
    } else {
      locals.user = undefined;
      locals.sessionToken = null;
      locals.isAuthenticated = false;
    }
  }

  const isDevBypassEnabled =
    import.meta.env.DEV && import.meta.env.DEV_BYPASS_AUTH === "true";

  if (!locals.isAuthenticated && isDevBypassEnabled) {
    const devUserId = import.meta.env.DEV_BYPASS_USER_ID || "dev-user";
    const devEmail = import.meta.env.DEV_BYPASS_EMAIL || "dev@local";
    const devRoleIdRaw = import.meta.env.DEV_BYPASS_ROLE_ID;
    const parsedRoleId = devRoleIdRaw ? Number.parseInt(devRoleIdRaw, 10) : NaN;
    const devRoleId = Number.isFinite(parsedRoleId) ? parsedRoleId : 1;

    locals.user = {
      id: devUserId,
      email: devEmail,
      roleId: devRoleId,
      stripeCustomerId: null,
      plan: null,
      planStatus: null,
      isPaid: false,
      renewalAt: null,
    };
    locals.session = {
      userId: devUserId,
      roleId: String(devRoleId),
      plan: null,
      planStatus: null,
      isPaid: false,
      renewalAt: null,
    };
    locals.sessionToken = null;
    locals.isAuthenticated = true;
  }

  // ✅ ENFORCE AUTH (protect everything in mini-app)
  if (!locals.isAuthenticated) {
    if (publicRoutes.has(pathname)) {
      return next();
    }
    const loginUrl = new URL("/login", ROOT_APP_URL);
    loginUrl.searchParams.set("returnTo", url.toString()); // ✅ full URL back to FlashNote
    return context.redirect(loginUrl.toString());
  }

  if (pathname.startsWith("/admin")) {
    if (locals.user?.roleId !== 1) {
      return context.redirect("/");
    }
  }

  return next();
});
