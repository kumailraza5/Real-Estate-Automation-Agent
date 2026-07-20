import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import agentsRouter from "./agents";
import leadsRouter from "./leads";
import propertiesRouter from "./properties";
import clientsRouter from "./clients";
import tasksRouter from "./tasks";
import appointmentsRouter from "./appointments";
import workflowsRouter from "./workflows";
import notificationsRouter from "./notifications";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(agentsRouter);
router.use(leadsRouter);
router.use(propertiesRouter);
router.use(clientsRouter);
router.use(tasksRouter);
router.use(appointmentsRouter);
router.use(workflowsRouter);
router.use(notificationsRouter);
router.use(reportsRouter);

export default router;
