CREATE TABLE ai_reports(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,data TEXT NOT NULL CHECK(json_valid(data)),created_at TEXT NOT NULL);
CREATE INDEX ai_reports_project ON ai_reports(project_id,created_at);
