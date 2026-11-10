import { Router } from "express";
import { onlyRole, AuthRequest } from "../middleware/auth";
import { createOrder, getClientOrders } from "../services/order.service";
const router = Router();
router.use(onlyRole("consumer"));
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    res.json(await getClientOrders(req.user!.id));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
router.post("/orders", async (req: AuthRequest, res) => {
  try {
    res
      .status(201)
      .json(
        await createOrder(
          req.user!.id,
          req.body.storeId,
          req.body.items,
          req.body.dest,
        ),
      );
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});
export default router;
