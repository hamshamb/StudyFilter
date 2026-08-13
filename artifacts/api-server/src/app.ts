import express, { type Express, type Request } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(
  express.json({
    // Webhook signatures (routes/webhooks.ts) are computed over the exact
    // bytes Resend sent — re-serializing the parsed body changes whitespace
    // and key order and breaks verification. `verify` runs before parsing
    // discards that information, so it's the only place left to keep it.
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// PDFs are served from Object Storage by the library router
// (GET /api/library/files/*), not from the local filesystem. The old
// express.static mount here resolved data/pdfs against process.cwd(), which is
// the repo root in production, so it never matched anything on the live site.

app.use("/api", router);

export default app;
