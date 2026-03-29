import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

const UPGRADES = [
  {
    id: "basic",
    name: "Basic License",
    description: "Access to 2 driver products with community support",
    price: 9.99,
    durationDays: 30,
    features: [
      "Access to 2 driver product forums",
      "Config file sharing",
      "Community support",
      "Monthly software updates",
    ],
  },
  {
    id: "premium",
    name: "Premium License",
    description: "Full access to all 5 driver products with priority support",
    price: 24.99,
    durationDays: 30,
    features: [
      "Access to ALL 5 driver product forums",
      "Config file sharing & showcase",
      "Priority support channel",
      "Weekly software updates",
      "Beta access to new drivers",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime License",
    description: "Permanent access to all current and future driver products",
    price: 149.99,
    durationDays: 36500,
    features: [
      "Lifetime access to ALL driver product forums",
      "All future driver products included",
      "VIP support",
      "Immediate update access",
      "Beta tester status",
      "Exclusive Lifetime badge",
    ],
  },
];

router.get("/", (_req, res: Response) => {
  res.json(UPGRADES);
});

const purchaseSchema = z.object({
  upgradeId: z.string(),
});

router.post("/purchase", requireAuth, (req: Request, res: Response) => {
  const parse = purchaseSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid upgrade ID" });
    return;
  }

  const upgrade = UPGRADES.find(u => u.id === parse.data.upgradeId);
  if (!upgrade) {
    res.status(404).json({ error: "Upgrade not found" });
    return;
  }

  // Payment integration placeholder
  res.json({
    message: `Payment integration coming soon! The ${upgrade.name} will be available for $${upgrade.price}. Please contact support to manually activate your upgrade.`,
  });
});

export default router;
