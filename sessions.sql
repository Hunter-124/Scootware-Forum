CREATE TABLE IF NOT EXISTS public.user_sessions (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  CONSTRAINT user_sessions_pk PRIMARY KEY (sid)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON public.user_sessions (expire);
