import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import forumRouter from "./forum";
import shoutboxRouter from "./shoutbox";
import upgradesRouter from "./upgrades";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/forum", forumRouter);
router.use("/shoutbox", shoutboxRouter);
router.use("/upgrades", upgradesRouter);
router.use("/admin", adminRouter);

export default router;
