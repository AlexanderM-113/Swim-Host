import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubRouter from "./club";
import athletesRouter from "./athletes";
import teamsRouter from "./teams";
import meetsRouter from "./meets";
import sessionsRouter from "./sessions";
import eventsRouter from "./events";
import entriesRouter from "./entries";
import heatsRouter from "./heats";
import resultsRouter from "./results";
import relaysRouter from "./relays";
import timeStandardsRouter from "./timestandards";
import workoutsRouter from "./workouts";
import billingRouter from "./billing";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubRouter);
router.use(athletesRouter);
router.use(teamsRouter);
router.use(meetsRouter);
router.use(sessionsRouter);
router.use(eventsRouter);
router.use(entriesRouter);
router.use(heatsRouter);
router.use(resultsRouter);
router.use(relaysRouter);
router.use(timeStandardsRouter);
router.use(workoutsRouter);
router.use(billingRouter);
router.use(dashboardRouter);

export default router;
