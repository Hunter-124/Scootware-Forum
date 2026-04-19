import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import forumRouter from "./forum";
import shoutboxRouter from "./shoutbox";
import upgradesRouter from "./upgrades";
import adminRouter from "./admin";
import loadersRouter from "./loaders";
import productAssetsRouter from "./productAssets";
import hwidResetRouter from "./hwidReset";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/forum", forumRouter);
router.use("/shoutbox", shoutboxRouter);
router.use("/upgrades", upgradesRouter);
router.use("/products", upgradesRouter); // Added for React Products.tsx expecting /api/products
router.use("/products", productAssetsRouter);
router.use("/admin", adminRouter);
router.use("/loaders", loadersRouter);
router.use("/hwid-reset", hwidResetRouter);

export default router;
