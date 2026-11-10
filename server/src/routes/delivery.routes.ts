import { Router } from "express";
import { onlyRole, AuthRequest } from "../middleware/auth";
import {
  getAvailableOrders,
  getMyDeliveries,
  acceptOrder,
  releaseOrder,
  setPosition,
} from "../services/order.service";
const router = Router();
router.use(onlyRole("delivery"));
router.get("/available", async (_req, res) => {
  try {
    res.json(await getAvailableOrders());
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
router.get("/history", async (req: AuthRequest, res) => {
  try {
    res.json(await getMyDeliveries(req.user!.id));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
router.post("/orders/:id/accept", async (req: AuthRequest, res) => {
  try {
    res.json(
      await acceptOrder(req.user!.id, String(req.params.id), req.body.pos),
    );
  } catch (e: any) {
    res.status(409).json({ message: e.message });
  }
});
router.put("/orders/:id/position", async (req: AuthRequest, res) => {
  try {
    res.json(
      await setPosition(req.user!.id, String(req.params.id), req.body.pos),
    );
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});
router.post("/orders/:id/release", async (req: AuthRequest, res) => {
  try {
    res.json(await releaseOrder(req.user!.id, String(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});
export default router;
