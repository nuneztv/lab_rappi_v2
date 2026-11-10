"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Guard from "../../components/Guard";
import Shell from "../../components/Shell";
import { api, statusLabel } from "../../lib/api";
import { realtime } from "../../lib/realtime";
import type { Pos } from "../../components/LiveMap";

const LiveMap = dynamic(() => import("../../components/LiveMap"), { ssr: false });

type Store = { id: string; name: string; is_open: boolean };
type Product = { id: string; name: string; price: number };
type Order = {
  id: string;
  store_name: string;
  status: string;
  dest_lat: number | null;
  dest_lng: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  items: { name: string; quantity: number; price: number }[];
};

function ClientPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<any>({});
  const [dest, setDest] = useState<Pos>({ lat: 4.711, lng: -74.072 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const ids = orders
    .filter((o) => o.status !== "delivered")
    .map((o) => o.id)
    .join(",");

  function load() {
    api("/store/open")
      .then((data) => setStores(data))
      .catch((err) => setError(err.message));
    api("/client/orders")
      .then((data) => setOrders(data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    navigator.geolocation.getCurrentPosition((p) => {
      setDest({ lat: p.coords.latitude, lng: p.coords.longitude });
    });
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 8000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (!ids) return;
    const supa = realtime();
    const channels = ids.split(",").map((id) =>
      supa
        .channel(`order:${id}`, { config: { private: true } })
        .on("broadcast", { event: "location" }, (res) => {
          const data = res.payload;
          if (data.status === "delivered") setMsg("¡Tu pedido fue entregado!");
          setOrders((list) =>
            list.map((o) =>
              o.id === id
                ? { ...o, status: data.status, driver_lat: data.lat, driver_lng: data.lng }
                : o,
            ),
          );
        })
        .on("broadcast", { event: "status" }, (res) => {
          setOrders((list) =>
            list.map((o) => (o.id === id ? { ...o, status: res.payload.status } : o)),
          );
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") load();
        }),
    );
    return () => {
      channels.forEach((ch) => supa.removeChannel(ch));
    };
  }, [ids]);

  async function openStore(id: string) {
    try {
      const data = await api(`/store/details/${id}`);
      setStore(data.store);
      setProducts(data.products);
      setQty({});
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createOrder() {
    if (!store) return;
    const items = [];
    for (const p of products) {
      if (qty[p.id] > 0) items.push({ productId: p.id, quantity: qty[p.id] });
    }
    if (items.length === 0) {
      setError("Selecciona al menos un producto");
      return;
    }
    try {
      await api("/client/orders", {
        method: "POST",
        body: JSON.stringify({ storeId: store.id, items, dest }),
      });
      setStore(null);
      setError("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Shell title="Cliente">
      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="ok toast">{msg}</p> : null}

      <div className="card">
        <h2>Tiendas abiertas</h2>
        {stores.length === 0 ? <p>No hay tiendas abiertas por ahora.</p> : null}
        {stores.map((s) => (
          <div className="item row" key={s.id}>
            <b>{s.name}</b>
            <button className="ghost" onClick={() => openStore(s.id)}>
              Ver productos
            </button>
          </div>
        ))}
      </div>

      {store ? (
        <div className="card">
          <div className="row">
            <h2>{store.name}</h2>
            <button className="ghost" onClick={() => setStore(null)}>
              Cerrar
            </button>
          </div>
          {products.map((p) => (
            <div className="item row" key={p.id}>
              <span>
                {p.name} · ${p.price}
              </span>
              <input
                type="number"
                min="0"
                value={qty[p.id] || 0}
                onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })}
              />
            </div>
          ))}
          <p>Elige el punto de entrega en el mapa</p>
          <LiveMap pos={dest} dest={dest} onPick={setDest} />
          <button onClick={createOrder} disabled={!store.is_open}>
            Crear pedido
          </button>
        </div>
      ) : null}

      <div className="card">
        <h2>Mis pedidos</h2>
        {orders.length === 0 ? <p>Todavía no tienes pedidos.</p> : null}
        {orders.map((o) => (
          <div className="item" key={o.id}>
            <div className="row">
              <b>{o.store_name}</b>
              <span className={`tag ${o.status}`}>{statusLabel(o.status)}</span>
            </div>
            {o.status === "in_progress" && o.driver_lat != null ? (
              <LiveMap
                pos={{ lat: Number(o.driver_lat), lng: Number(o.driver_lng) }}
                dest={{ lat: Number(o.dest_lat), lng: Number(o.dest_lng) }}
              />
            ) : null}
            {o.status === "delivered" ? <p className="ok">Tu pedido fue entregado.</p> : null}
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
    <Guard role="consumer">
      <ClientPage />
    </Guard>
  );
}
