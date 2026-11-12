-- Google Analytics 4 property chosen for a project, e.g. "properties/123456789".
ALTER TABLE projects ADD COLUMN ga4_property TEXT;
-- Optional short code a consultancy uses for the client or job, e.g. "RZ-104".
ALTER TABLE projects ADD COLUMN code TEXT;
