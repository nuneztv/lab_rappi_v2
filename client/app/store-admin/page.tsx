"use client";

import { useEffect, useState } from "react";
import Guard from "../../components/Guard";
import Shell from "../../components/Shell";
import { api, statusLabel } from "../../lib/api";
import { realtime } from "../../lib/realtime";

type Product = { id: string; name: string; price: number };
type Store = { id: string; name: string; is_open: boolean };
type Order = {
  id: string;
  status: string;
  client_name: string;
  items: { name: string; quantity: number; price: number }[];
};

function StorePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  function load() {
    api("/store/me")
      .then((data) => setStore(data))
      .catch((err) => setError(err.message));
    api("/store/products")
      .then((data) => setProducts(data))
      .catch((err) => setError(err.message));
    api("/store/orders")
      .then((data) => setOrders(data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!store) return;
    const supa = realtime();
    const ch = supa
      .channel(`store:${store.id}`, { config: { private: true } })
      .on("broadcast", { event: "order" }, () => load())
      .on("broadcast", { event: "status" }, () => load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });
    return () => {
      supa.removeChannel(ch);
    };
  }, [store?.id]);

  async function toggle() {
    try {
      const data = await api("/store/toggle", { method: "PUT" });
      setStore(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createProduct() {
    try {
      const data = await api("/store/products", {
        method: "POST",
        body: JSON.stringify({ name, price: Number(price) }),
      });
      setProducts([...products, data]);
      setName("");
      setPrice("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function rename(p: Product) {
    const newName = prompt("Nuevo nombre del producto", p.name);
    if (!newName || newName === p.name) return;
    try {
      const data = await api(`/store/products/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName }),
      });
      setProducts(products.map((x) => (x.id === p.id ? data : x)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Shell title={store ? store.name : "Mi tienda"}>
      {error ? <p className="err">{error}</p> : null}

      <div className="card row">
        <span>{store && store.is_open ? "Tu tienda está abierta" : "Tu tienda está cerrada"}</span>
        <button onClick={toggle}>{store && store.is_open ? "Cerrar tienda" : "Abrir tienda"}</button>
      </div>

      <div className="card">
        <h2>Productos</h2>
        <div className="row">
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            placeholder="Precio"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button onClick={createProduct}>Crear</button>
        </div>
        {products.length === 0 ? <p>No tienes productos.</p> : null}
        {products.map((p) => (
          <div className="item row" key={p.id}>
            <span>
              {p.name} · ${p.price}
            </span>
            <button className="ghost" onClick={() => rename(p)}>
              Editar
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Pedidos</h2>
        {orders.length === 0 ? <p>No hay pedidos.</p> : null}
        {orders.map((o) => (
          <div className="item" key={o.id}>
            <div className="row">
              <b>Pedido #{o.id.slice(0, 8)}</b>
              <span className={`tag ${o.status}`}>{statusLabel(o.status)}</span>
            </div>
            <p>Cliente: {o.client_name}</p>
            {o.items.map((i, n) => (
              <div className="row" key={n}>
                <span>
                  {i.quantity} x {i.name}
                </span>
                <span>${i.price}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export default function Page() {
  return (
    <Guard role="store">
      <StorePage />
    </Guard>
  );
}
