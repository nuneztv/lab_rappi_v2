CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS destination extensions.GEOGRAPHY(POINT, 4326);

CREATE TABLE IF NOT EXISTS order_locations (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES users(id),
  pos extensions.GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_locations_pos_idx
  ON order_locations USING GIST (pos);

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

CREATE OR REPLACE FUNCTION public.can_deliveries_topic()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_id = (SELECT auth.uid())
      AND u.role = 'delivery'
  );
$$;

REVOKE ALL ON FUNCTION public.can_order_topic() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_store_topic() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_deliveries_topic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_order_topic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_store_topic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_deliveries_topic() TO authenticated;

DROP POLICY IF EXISTS "order app receive" ON realtime.messages;
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
      OR (
        (SELECT realtime.topic()) = 'deliveries'
        AND public.can_deliveries_topic()
      )
    )
  );
