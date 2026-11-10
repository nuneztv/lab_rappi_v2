import pool from "../db/connection";
import { send } from "../db/supabase";

type Pos = { lat: number; lng: number };

const base = `SELECT o.*, s.name AS store_name, u.name AS client_name,
  extensions.ST_Y(o.destination::extensions.geometry) AS dest_lat,
  extensions.ST_X(o.destination::extensions.geometry) AS dest_lng,
  extensions.ST_Y(l.pos::extensions.geometry) AS driver_lat,
  extensions.ST_X(l.pos::extensions.geometry) AS driver_lng
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  JOIN users u ON u.id = o.client_id
  LEFT JOIN order_locations l ON l.order_id = o.id`;

async function publish(topic: string, event: string, data: object) {
  try {
    await send(topic, event, data);
  } catch (err) {
    console.error("realtime", err);
  }
}

async function withItems(order: any) {
  const items = await pool.query(
    `SELECT oi.id, oi.quantity, p.id AS product_id, p.name, p.price
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [order.id],
  );
  return { ...order, items: items.rows };
}

async function listOrders(where: string, value: string | null) {
  const result = await pool.query(`${base} WHERE ${where}`, value ? [value] : []);
  const orders = [];
  for (const order of result.rows) {
    orders.push(await withItems(order));
  }
  return orders;
}

function checkPos(pos: Pos) {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
    throw new Error("Ubicacion invalida");
  }
  if (Math.abs(pos.lat) > 90 || Math.abs(pos.lng) > 180) {
    throw new Error("Ubicacion invalida");
  }
}

async function saveLocation(orderId: string, deliveryId: string, pos: Pos) {
  await pool.query(
    `INSERT INTO order_locations (order_id, delivery_id, pos)
     VALUES ($1, $2, extensions.ST_SetSRID(extensions.ST_MakePoint($4, $3), 4326)::extensions.geography)
     ON CONFLICT (order_id) DO UPDATE
     SET delivery_id = EXCLUDED.delivery_id, pos = EXCLUDED.pos, updated_at = now()`,
    [orderId, deliveryId, pos.lat, pos.lng],
  );
}

async function checkArrival(orderId: string) {
  const result = await pool.query(
    `UPDATE orders o SET status = 'delivered'
     FROM order_locations l
     WHERE o.id = $1 AND l.order_id = o.id AND o.status = 'in_progress'
       AND extensions.ST_DWithin(o.destination, l.pos, 10)
     RETURNING o.id`,
    [orderId],
  );
  return result.rows.length > 0 ? "delivered" : "in_progress";
}

export async function createOrder(
  clientId: string,
  storeId: string,
  items: { productId: string; quantity: number }[],
  dest: Pos,
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("El pedido necesita al menos un producto");
  }
  checkPos(dest);
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Cantidad invalida");
    }
  }

  const store = await pool.query("SELECT is_open FROM stores WHERE id = $1", [storeId]);
  if (store.rows.length === 0) throw new Error("Tienda no encontrada");
  if (!store.rows[0].is_open) throw new Error("La tienda esta cerrada");

  for (const item of items) {
    const product = await pool.query("SELECT id FROM products WHERE id = $1 AND store_id = $2", [
      item.productId,
      storeId,
    ]);
    if (product.rows.length === 0) throw new Error("Hay productos que no pertenecen a esta tienda");
  }

  const saved = await pool.query(
    `INSERT INTO orders (client_id, store_id, destination, status)
     VALUES ($1, $2, extensions.ST_SetSRID(extensions.ST_MakePoint($4, $3), 4326)::extensions.geography, 'waiting_for_deliver')
     RETURNING *`,
    [clientId, storeId, dest.lat, dest.lng],
  );
  const order = saved.rows[0];

  for (const item of items) {
    await pool.query("INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)", [
      order.id,
      item.productId,
      item.quantity,
    ]);
  }

  await publish(`store:${storeId}`, "order", { orderId: order.id, status: order.status });
  await publish("deliveries", "orders", { orderId: order.id });
  return withItems(order);
}

export async function getClientOrders(clientId: string) {
  return listOrders("o.client_id = $1 ORDER BY o.created_at DESC", clientId);
}

export async function getStoreOrders(userId: string) {
  const store = await pool.query("SELECT id FROM stores WHERE user_owner_id = $1", [userId]);
  if (store.rows.length === 0) throw new Error("No tienes tienda asociada");
  return listOrders("o.store_id = $1 ORDER BY o.created_at DESC", store.rows[0].id);
}

export async function getAvailableOrders() {
  return listOrders(
    "o.status = 'waiting_for_deliver' AND o.destination IS NOT NULL ORDER BY o.created_at ASC",
    null,
  );
}

export async function getMyDeliveries(deliveryId: string) {
  return listOrders("o.delivery_id = $1 ORDER BY o.created_at DESC", deliveryId);
}

export async function acceptOrder(deliveryId: string, orderId: string, pos: Pos) {
  checkPos(pos);
  const result = await pool.query(
    `UPDATE orders SET delivery_id = $1, status = 'in_progress'
     WHERE id = $2 AND status = 'waiting_for_deliver' AND destination IS NOT NULL
     RETURNING *`,
    [deliveryId, orderId],
  );
  if (result.rows.length === 0) throw new Error("Este pedido ya no esta disponible");
  const order = result.rows[0];

  await saveLocation(orderId, deliveryId, pos);
  const status = await checkArrival(orderId);

  const data = { orderId, status, lat: pos.lat, lng: pos.lng };
  await publish(`order:${orderId}`, "location", data);
  await publish(`store:${order.store_id}`, "status", data);
  await publish("deliveries", "orders", data);
  return { ...order, status };
}

export async function setPosition(deliveryId: string, orderId: string, pos: Pos) {
  checkPos(pos);
  const found = await pool.query(
    "SELECT store_id FROM orders WHERE id = $1 AND delivery_id = $2 AND status = 'in_progress'",
    [orderId, deliveryId],
  );
  if (found.rows.length === 0) throw new Error("No puedes mover este pedido");

  await saveLocation(orderId, deliveryId, pos);
  const status = await checkArrival(orderId);

  const data = { orderId, status, lat: pos.lat, lng: pos.lng };
  await publish(`order:${orderId}`, "location", data);
  if (status === "delivered") {
    await publish(`store:${found.rows[0].store_id}`, "status", data);
  }
  return data;
}

export async function releaseOrder(deliveryId: string, orderId: string) {
  const result = await pool.query(
    `UPDATE orders SET delivery_id = NULL, status = 'waiting_for_deliver'
     WHERE id = $1 AND delivery_id = $2 AND status = 'in_progress'
     RETURNING *`,
    [orderId, deliveryId],
  );
  if (result.rows.length === 0) throw new Error("No puedes liberar este pedido");
  const order = result.rows[0];

  await pool.query("DELETE FROM order_locations WHERE order_id = $1", [orderId]);

  const data = { orderId, status: order.status };
  await publish(`order:${orderId}`, "status", data);
  await publish(`store:${order.store_id}`, "status", data);
  await publish("deliveries", "orders", data);
  return order;
}
