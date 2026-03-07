-- HADE signal enum alignment for Supabase Cloud
-- Run in Supabase SQL Editor when your public.signals.type is TEXT

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'signaltype'
  ) THEN
    CREATE TYPE signaltype AS ENUM (
      'PRESENCE',
      'SOCIAL_RELAY',
      'ENVIRONMENTAL',
      'BEHAVIORAL',
      'AMBIENT',
      'EVENT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'signaltype'
      AND e.enumlabel = 'EVENT'
  ) THEN
    ALTER TYPE signaltype ADD VALUE 'EVENT';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'signals'
      AND column_name = 'type'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.signals
      ALTER COLUMN type TYPE signaltype
      USING UPPER(type)::signaltype;
  END IF;
END
$$;
