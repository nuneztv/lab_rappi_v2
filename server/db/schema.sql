CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'store', 'delivery'))
);

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  user_owner_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id),
  delivery_id UUID REFERENCES users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  destination extensions.GEOGRAPHY(POINT, 4326),
  status TEXT NOT NULL DEFAULT 'waiting_for_deliver'
    CHECK (status IN ('waiting_for_deliver', 'in_progress', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE order_locations (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES users(id),
  pos extensions.GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_locations_pos_idx ON order_locations USING GIST (pos);

CREATE OR REPLACE FUNCTION public.can_order_topic()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.users c ON c.id = o.client_id
    LEFT JOIN public.users d ON d.id = o.delivery_id
    WHERE o.id::text = split_part((SELECT realtime.topic()), ':', 2)
      AND (
        c.auth_id = (SELECT auth.uid())
        OR d.auth_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.stores s
          JOIN public.users u ON u.id = s.user_owner_id
          WHERE s.id = o.store_id
            AND u.auth_id = (SELECT auth.uid())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_store_topic()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    JOIN public.users u ON u.id = s.user_owner_id
    WHERE s.id::text = split_part((SELECT realtime.topic()), ':', 2)
      AND u.auth_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.can_order_topic() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_store_topic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_order_topic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_store_topic() TO authenticated;

CREATE POLICY "order app receive" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND (
      (
        split_part((SELECT realtime.topic()), ':', 1) = 'order'
        AND public.can_order_topic()
      )
      OR (
        split_part((SELECT realtime.topic()), ':', 1) = 'store'
        AND public.can_store_topic()
      )
    )
  );
