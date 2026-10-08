-- Consolidated initial schema. This file represents the final state of all
-- migrations that previously lived in this directory, in chronological order.
-- Superseded duplicate ALTER/CREATE statements and obsolete grants are omitted.

-- 20260727135928_924890e7-2916-46ee-9b58-1cf393b861f6
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  username text NOT NULL,
  user_id text NOT NULL UNIQUE,
  email text,
  xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '✅',
  color text NOT NULL DEFAULT 'cyan',
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'medium',
  difficulty text NOT NULL DEFAULT 'medium',
  target_value numeric NOT NULL DEFAULT 1,
  target_unit text NOT NULL DEFAULT 'time',
  reminder_time text,
  sort_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX habits_owner_idx ON public.habits(owner_id);

CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  progress numeric NOT NULL DEFAULT 100,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.habit_logs FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX habit_logs_owner_date_idx ON public.habit_logs(owner_id, log_date);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER habits_touch BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER habit_logs_touch BEFORE UPDATE ON public.habit_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 20260915123959_237c0ddd-5e02-40ec-afc2-80d4ec292bce
ALTER TABLE public.profiles
  ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE public.habits
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN daily_score integer NOT NULL DEFAULT 10,
  ADD COLUMN reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN active_from date,
  ADD COLUMN deleted_at timestamptz;

UPDATE public.habits
SET active_from = created_at::date
WHERE active_from IS NULL;

ALTER TABLE public.habits
  ALTER COLUMN active_from SET DEFAULT CURRENT_DATE,
  ALTER COLUMN active_from SET NOT NULL,
  ADD CONSTRAINT habits_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT habits_description_length CHECK (char_length(description) <= 500),
  ADD CONSTRAINT habits_category_length CHECK (char_length(btrim(category)) BETWEEN 1 AND 60),
  ADD CONSTRAINT habits_daily_score_range CHECK (daily_score BETWEEN 1 AND 1000),
  ADD CONSTRAINT habits_reminder_consistent CHECK (NOT reminder_enabled OR reminder_time IS NOT NULL),
  ADD CONSTRAINT habits_reminder_time_format CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE public.habit_logs
  ADD COLUMN score_awarded integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT habit_logs_valid_status CHECK (status IN ('completed', 'partial', 'skipped', 'missed')),
  ADD CONSTRAINT habit_logs_progress_range CHECK (progress BETWEEN 0 AND 100),
  ADD CONSTRAINT habit_logs_note_length CHECK (note IS NULL OR char_length(note) <= 280),
  ADD CONSTRAINT habit_logs_score_range CHECK (score_awarded BETWEEN 0 AND 1000);

UPDATE public.habit_logs
SET score_awarded = 10
WHERE status = 'completed';

CREATE OR REPLACE FUNCTION public.validate_habit_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Habit owner does not match signed-in user';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.category := btrim(NEW.category);
  IF NEW.reminder_enabled = false THEN
    NEW.reminder_time := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_habit_write_trigger
BEFORE INSERT OR UPDATE ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.validate_habit_write();

CREATE OR REPLACE FUNCTION public.validate_habit_log_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_owner uuid;
  target_score integer;
  user_timezone text;
  expected_date date;
  target_deleted_at timestamptz;
BEGIN
  SELECT h.owner_id, h.daily_score, h.deleted_at
    INTO target_owner, target_score, target_deleted_at
  FROM public.habits h
  WHERE h.id = COALESCE(NEW.habit_id, OLD.habit_id);

  IF target_owner IS NULL OR target_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Invalid habit';
  END IF;

  SELECT p.timezone INTO user_timezone
  FROM public.profiles p
  WHERE p.id = auth.uid();

  BEGIN
    expected_date := (now() AT TIME ZONE COALESCE(user_timezone, 'UTC'))::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    expected_date := (now() AT TIME ZONE 'UTC')::date;
  END;

  IF TG_OP = 'DELETE' THEN
    IF OLD.log_date <> expected_date THEN
      RAISE EXCEPTION 'Historical completion records are locked';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.owner_id <> auth.uid() OR NEW.log_date <> expected_date THEN
    RAISE EXCEPTION 'Only today can be changed';
  END IF;

  IF target_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted habits cannot be changed';
  END IF;

  NEW.score_awarded := CASE WHEN NEW.status = 'completed' THEN target_score ELSE 0 END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_habit_log_write_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.habit_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_habit_log_write();

REVOKE DELETE ON public.habits FROM authenticated;

CREATE INDEX habits_owner_active_idx ON public.habits(owner_id, deleted_at, archived, sort_order);
CREATE INDEX habit_logs_owner_score_idx ON public.habit_logs(owner_id, status, log_date);

REVOKE EXECUTE ON FUNCTION public.validate_habit_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_habit_log_write() FROM PUBLIC, anon, authenticated;

-- 20260916010326_b1a9c4f9-21b2-4df7-9e08-d895a240c0d2
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX push_subscriptions_owner_idx ON public.push_subscriptions(owner_id);
CREATE TRIGGER push_subscriptions_touch BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  reminder_time text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, local_date, reminder_time)
);
GRANT ALL ON public.reminder_deliveries TO service_role;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.due_habit_reminders(window_minutes integer DEFAULT 5)
RETURNS TABLE (
  habit_id uuid,
  owner_id uuid,
  habit_name text,
  emoji text,
  reminder_time text,
  local_date date,
  timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id,
    h.owner_id,
    h.name,
    h.emoji,
    h.reminder_time,
    ((now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) AS local_date,
    COALESCE(p.timezone, 'UTC') AS timezone
  FROM public.habits h
  JOIN public.profiles p ON p.id = h.owner_id
  WHERE h.reminder_enabled
    AND h.reminder_time IS NOT NULL
    AND h.deleted_at IS NULL
    AND h.archived = false
    AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.owner_id = h.owner_id)
    AND (
      EXTRACT(EPOCH FROM (
        (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))
        - (((now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date)::timestamp + h.reminder_time::time)
      )) BETWEEN 0 AND (GREATEST(window_minutes, 1) * 60)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.due_habit_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_habit_reminders(integer) TO service_role;
