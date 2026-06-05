import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'r', encoding='utf-8') as f:
    code = f.read()

init_db_target = """	app.QuizDB.Exec("CREATE TABLE IF NOT EXISTS quiz_results (id SERIAL PRIMARY KEY, quiz_id INTEGER, user_id INTEGER, score INTEGER, start_time TIMESTAMP, end_time TIMESTAMP, answers JSONB)")"""
init_db_new = init_db_target + """\n\tapp.QuizDB.Exec("CREATE TABLE IF NOT EXISTS global_settings (key VARCHAR(50) PRIMARY KEY, value TEXT)")"""
code = code.replace(init_db_target, init_db_new)

handlers_target = """	// Admin Handlers"""
handlers_new = """	// Global Timer Handlers
	mux.HandleFunc("/api/global_timer", app.getGlobalTimerHandler)
	mux.HandleFunc("/api/admin/global_timer", app.adminGlobalTimerHandler)

	// Admin Handlers"""
code = code.replace(handlers_target, handlers_new)

new_funcs = """
func (app *App) getGlobalTimerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var val string
	err := app.QuizDB.QueryRow("SELECT value FROM global_settings WHERE key = 'global_timer_end_at'").Scan(&val)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"end_at": nil})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"end_at": val})
}

func (app *App) adminGlobalTimerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Basic auth check
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "adminpass"
	}
	authHeader := r.Header.Get("Authorization")
	if authHeader != "Bearer "+adminPass {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		DurationSec *int `json:"duration_sec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.DurationSec == nil || *req.DurationSec <= 0 {
		app.QuizDB.Exec("DELETE FROM global_settings WHERE key = 'global_timer_end_at'")
	} else {
		app.QuizDB.Exec(`
			INSERT INTO global_settings (key, value) 
			VALUES ('global_timer_end_at', (CURRENT_TIMESTAMP + ($1 || ' seconds')::interval)::text)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
		`, *req.DurationSec)
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
"""

if "func (app *App) getGlobalTimerHandler" not in code:
    code += new_funcs

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'w', encoding='utf-8') as f:
    f.write(code)
