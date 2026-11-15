-- One row per installation and per day. No IP address or other data.
CREATE TABLE IF NOT EXISTS pings (
  day TEXT NOT NULL,
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  channel TEXT NOT NULL,
  model TEXT NOT NULL,
  PRIMARY KEY (day, id)
);
CREATE INDEX IF NOT EXISTS pings_id ON pings (id);
