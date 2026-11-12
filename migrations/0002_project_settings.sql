CREATE TABLE project_settings (project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL CHECK(json_valid(data)), updated_at TEXT NOT NULL);
