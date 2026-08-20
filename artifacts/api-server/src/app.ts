import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  next();
});

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
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Global 404 JSON Handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Global Error Handler Middleware (Prevents stack trace leaks)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Handle invalid JSON body parse error
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  // Handle Payload Too Large (413)
  if (err.type === "entity.too.large" || err.status === 413) {
    res.status(413).json({ error: "Payload Too Large (max 1MB)" });
    return;
  }

  logger.error({ err }, "[Server] Unhandled application error");
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
