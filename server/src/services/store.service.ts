import pool from "../db/connection";

export async function getOpenStores() {
  const result = await pool.query(
    "SELECT id,name,is_open FROM stores WHERE is_open = true ORDER BY name",
  );
  return result.rows;
}

export async function getMyStore(userId: string) {
  const result = await pool.query(
    "SELECT * FROM stores WHERE user_owner_id = $1",
    [userId],
  );
  if (!result.rows.length) throw new Error("No tienes tienda asociada");
  return result.rows[0];
}

export async function toggleStore(userId: string) {
  const store = await getMyStore(userId);
  const result = await pool.query(
    "UPDATE stores SET is_open = NOT is_open WHERE id = $1 RETURNING *",
    [store.id],
  );
  return result.rows[0];
}

export async function getStoreProducts(storeId: string) {
  const store = await pool.query(
    "SELECT id,name,is_open FROM stores WHERE id = $1",
    [storeId],
  );
  if (!store.rows.length) throw new Error("Tienda no encontrada");
  if (!store.rows[0].is_open) throw new Error("La tienda esta cerrada");
  const products = await pool.query(
    "SELECT id,name,price,store_id FROM products WHERE store_id = $1 ORDER BY name",
    [storeId],
  );
  return { store: store.rows[0], products: products.rows };
}

export async function getMyProducts(userId: string) {
  const store = await getMyStore(userId);
  const result = await pool.query(
    "SELECT id,name,price,store_id FROM products WHERE store_id = $1 ORDER BY name",
    [store.id],
  );
  return result.rows;
}

export async function createProduct(
  userId: string,
  name: string,
  price: number,
) {
  if (!name?.trim()) throw new Error("El producto necesita nombre");
  if (!Number.isInteger(price) || price < 0)
    throw new Error("El precio debe ser un numero entero mayor o igual a 0");
  const store = await getMyStore(userId);
  const result = await pool.query(
    "INSERT INTO products (name,price,store_id) VALUES ($1,$2,$3) RETURNING *",
    [name.trim(), price, store.id],
  );
  return result.rows[0];
}

export async function updateProductName(
  userId: string,
  productId: string,
  name: string,
) {
  if (!name?.trim()) throw new Error("El producto necesita nombre");
  const store = await getMyStore(userId);
  const result = await pool.query(
    "UPDATE products SET name = $1 WHERE id = $2 AND store_id = $3 RETURNING *",
    [name.trim(), productId, store.id],
  );
  if (!result.rows.length) throw new Error("Producto no encontrado");
  return result.rows[0];
}
