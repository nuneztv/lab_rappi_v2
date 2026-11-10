import { Router } from "express";

import { onlyRole, AuthRequest } from "../middleware/auth";

import {
  getMyProducts,
  getMyStore,
  toggleStore,
  createProduct,
  updateProductName,
  getOpenStores,
  getStoreProducts,
} from "../services/store.service";

import { getStoreOrders } from "../services/order.service";

const router = Router();

router.get("/open", onlyRole("consumer"), async (_req, res) => {
  try {
    res.json(await getOpenStores());
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/details/:id", onlyRole("consumer"), async (req, res) => {
  try {
    res.json(await getStoreProducts(String(req.params.id)));
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
});

router.use(onlyRole("store"));

router.get("/me", async (req: AuthRequest, res) => {
  try {
    res.json(await getMyStore(req.user!.id));
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
});

router.put("/toggle", async (req: AuthRequest, res) => {
  try {
    res.json(await toggleStore(req.user!.id));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/products", async (req: AuthRequest, res) => {
  try {
    res.json(await getMyProducts(req.user!.id));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/products", async (req: AuthRequest, res) => {
  try {
    res
      .status(201)
      .json(
        await createProduct(
          req.user!.id,
          req.body.name,
          Number(req.body.price),
        ),
      );
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/products/:id", async (req: AuthRequest, res) => {
  try {
    res.json(
      await updateProductName(
        req.user!.id,
        String(req.params.id),
        req.body.name,
      ),
    );
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/orders", async (req: AuthRequest, res) => {
  try {
    res.json(await getStoreOrders(req.user!.id));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
