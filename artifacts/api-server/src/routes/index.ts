import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plantsRouter from "./plants";
import forecastsRouter from "./forecasts";
import schedulesRouter from "./schedules";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plantsRouter);
router.use(forecastsRouter);
router.use(schedulesRouter);
router.use(dashboardRouter);

export default router;
