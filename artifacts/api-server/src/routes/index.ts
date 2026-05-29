import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import peopleRouter from "./people.js";
import tasksRouter from "./tasks.js";
import inboxRouter from "./inbox.js";
import uploadRouter from "./upload.js";
import filesRouter from "./files.js";
import timelineRouter from "./timeline.js";
import aiRouter from "./ai.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router: IRouter = Router();

// Health check is public (used by Render for pings, no auth needed)
router.use(healthRouter);

// All other routes require a valid Supabase JWT
router.use(authMiddleware as any);
router.use("/projects", projectsRouter);
router.use("/people", peopleRouter);
router.use("/tasks", tasksRouter);
router.use("/inbox", inboxRouter);
router.use("/upload", uploadRouter);
router.use("/files", filesRouter);
router.use("/timeline", timelineRouter);
router.use("/ai", aiRouter);

export default router;
