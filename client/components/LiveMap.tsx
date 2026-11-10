"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type Pos = { lat: number; lng: number };

const driverIcon = L.divIcon({ className: "driver-marker", html: "<i></i>", iconSize: [24, 24] });
const destIcon = L.divIcon({ className: "dest-marker", html: "<i></i>", iconSize: [24, 24] });

function Center({ pos }: { pos: Pos }) {
  const map = useMap();

  useEffect(() => {
    map.setView([pos.lat, pos.lng]);
  }, [pos.lat, pos.lng]);

  return null;
}

function Click({ onPick }: { onPick: (p: Pos) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

type Props = {
  pos: Pos;
  dest?: Pos;
  onPick?: (p: Pos) => void;
};

export default function LiveMap({ pos, dest, onPick }: Props) {
  return (
    <MapContainer center={[pos.lat, pos.lng]} zoom={16} keyboard={false} className="live-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Center pos={pos} />
      {onPick ? <Click onPick={onPick} /> : null}
      {onPick ? null : <Marker position={[pos.lat, pos.lng]} icon={driverIcon} />}
      {dest ? <Marker position={[dest.lat, dest.lng]} icon={destIcon} /> : null}
    </MapContainer>
  );
}
