"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Guard from "../../components/Guard";
import Shell from "../../components/Shell";
import { api, statusLabel } from "../../lib/api";
import { realtime } from "../../lib/realtime";
import type { Pos } from "../../components/LiveMap";

const LiveMap = dynamic(() => import("../../components/LiveMap"), { ssr: false });

const STEP = 0.00005;

let timer: any = null;
let pending: Pos | null = null;

type Order = {
  id: string;
  store_name: string;
  client_name: string;
  status: string;
  dest_lat: number | null;
  dest_lng: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  items: { name: string; quantity: number; price: number }[];
};

function destOf(o: Order) {
  return { lat: Number(o.dest_lat), lng: Number(o.dest_lng) };
}

function startOf(o: Order) {
  return { lat: Number(o.dest_lat) - 0.0013, lng: Number(o.dest_lng) - 0.0013 };
}

function meters(a: Pos, b: Pos) {
  const x = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const y = (b.lat - a.lat) * 110540;
  return Math.round(Math.sqrt(x * x + y * y));
}

function DeliveryPage() {
  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [pos, setPos] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const active = mine.find((o) => o.status === "in_progress");

  function load() {
    api("/delivery/available")
      .then((data) => setAvailable(data))
      .catch((err) => setError(err.message));
    api("/delivery/history")
      .then((data) => setMine(data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    return () => {
      clearTimeout(timer);
      timer = null;
      pending = null;
    };
  }, []);

  useEffect(() => {
    if (!active || pos) return;
    let p = { lat: Number(active.driver_lat), lng: Number(active.driver_lng) };
    if (active.driver_lat == null || meters(p, destOf(active)) > 2000) {
      p = startOf(active);
      send(active.id, p);
    }
    setPos(p);
  }, [active?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!active || !pos) return;
      let lat = pos.lat;
      let lng = pos.lng;
      if (e.key === "ArrowUp") lat = lat + STEP;
      else if (e.key === "ArrowDown") lat = lat - STEP;
      else if (e.key === "ArrowLeft") lng = lng - STEP;
      else if (e.key === "ArrowRight") lng = lng + STEP;
      else return;
      e.preventDefault();
      move(active.id, { lat, lng });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, pos]);

  useEffect(() => {
    const supa = realtime();
    const ch = supa
      .channel("deliveries", { config: { private: true } })
      .on("broadcast", { event: "orders" }, () => load())
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = active.id;
    const supa = realtime();
    const ch = supa
      .channel(`order:${id}`, { config: { private: true } })
      .on("broadcast", { event: "location" }, (res) => {
        if (res.payload.status === "delivered") delivered(id);
      })
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, [active?.id]);

  function stop() {
    clearTimeout(timer);
    timer = null;
    pending = null;
    setPos(null);
  }

  function delivered(id: string) {
    stop();
    setMine((list) => list.map((o) => (o.id === id ? { ...o, status: "delivered" } : o)));
    setMsg("¡Pedido entregado! Llegaste a menos de 10 m del destino.");
  }

  function send(id: string, p: Pos) {
    api(`/delivery/orders/${id}/position`, {
      method: "PUT",
      body: JSON.stringify({ pos: p }),
    })
      .then((data) => {
        if (data.status === "delivered") delivered(id);
      })
      .catch((err) => setError(err.message));
  }

  function move(id: string, p: Pos) {
    setPos(p);
    pending = p;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (pending) send(id, pending);
      pending = null;
    }, 1000);
  }

  async function accept(o: Order) {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const start = startOf(o);
      await api(`/delivery/orders/${o.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ pos: start }),
      });
      setPos(start);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function release(id: string) {
    try {
      await api(`/delivery/orders/${id}/release`, { method: "POST" });
      stop();
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Shell title="Domiciliario">
      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="card">
        <h2>Pedidos disponibles</h2>
        {available.length === 0 ? <p>No hay pedidos disponibles.</p> : null}
        {available.map((o) => (
          <div className="item" key={o.id}>
            <div className="row">
              <b>{o.store_name}</b>
              <span className="tag">{statusLabel(o.status)}</span>
            </div>
            <p>Cliente: {o.client_name}</p>
            {o.items.map((i, n) => (
              <p key={n}>
                {i.quantity} x {i.name}
              </p>
            ))}
            {active ? <p>Termina o libera tu pedido en curso para aceptar otro.</p> : null}
            <div className="row">
              <button
                className="ghost"
                onClick={() => setAvailable(available.filter((x) => x.id !== o.id))}
              >
                Rechazar
              </button>
              <button onClick={() => accept(o)} disabled={busy || active !== undefined}>
                {busy ? "Aceptando..." : "Aceptar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Mis pedidos</h2>
        {mine.length === 0 ? <p>No tienes pedidos asignados.</p> : null}
        {mine.map((o) => (
          <div className="item" key={o.id}>
            <div className="row">
              <b>{o.store_name}</b>
              <span className={`tag ${o.status}`}>{statusLabel(o.status)}</span>
            </div>
            <p>Cliente: {o.client_name}</p>
            {o.status === "in_progress" && pos ? (
              <div>
                <p>
                  Usa las flechas del teclado para moverte · Distancia al destino:{" "}
                  {meters(pos, destOf(o))} m
                </p>
                <LiveMap pos={pos} dest={destOf(o)} />
              </div>
            ) : null}
            {o.status === "in_progress" ? (
              <button className="ghost" onClick={() => release(o.id)}>
                Liberar
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export default function Page() {
  return (
    <Guard role="delivery">
      <DeliveryPage />
    </Guard>
  );
}
