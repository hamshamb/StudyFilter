import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyRouter from "./study";
import studyToolsRouter from "./studyTools";
import progressRouter from "./progress";
import pdfsRouter from "./pdfs";
import libraryRouter from "./library";
import mockRouter from "./mock";
import plannerRouter from "./planner";
import pomodoroRouter from "./pomodoro";
import feedbackRouter from "./feedback";
import accountRouter from "./account";
import leaderboardRouter from "./leaderboard";
import eventsRouter from "./events";
import analyticsRouter from "./analytics";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyRouter);
router.use(studyToolsRouter);
router.use(progressRouter);
router.use(pdfsRouter);
router.use(libraryRouter);
router.use(mockRouter);
router.use(plannerRouter);
router.use(pomodoroRouter);
router.use(feedbackRouter);
router.use(accountRouter);
router.use(leaderboardRouter);
router.use(eventsRouter);
router.use(analyticsRouter);
router.use(webhooksRouter);

export default router;
