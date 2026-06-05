import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Struct Quiz update
code = re.sub(
    r'type Quiz struct {.*?Questions\s+\[\]Question\s+`json:"questions"`\n}',
    r'''type Quiz struct {
	ID               int        `json:"id"`
	Code             string     `json:"code"`
	Title            string     `json:"title"`
	Mode             string     `json:"mode"`
	Style            string     `json:"style"`
	Visibility       string     `json:"visibility"`
	PlayStatus       string     `json:"play_status"`
	TimerDurationSec *int       `json:"timer_duration_sec"`
	TimerEndAt       *time.Time `json:"timer_end_at"`
	Questions        []Question `json:"questions"`
}''',
    code, flags=re.DOTALL
)

# 2. Schema update
schema_target = "play_status VARCHAR(20) DEFAULT 'waiting'"
schema_replacement = "play_status VARCHAR(20) DEFAULT 'waiting',\n\t\ttimer_duration_sec INTEGER,\n\t\ttimer_end_at TIMESTAMP"
code = code.replace(schema_target, schema_replacement)

# Add ALTER TABLE to createTables
alter_code = """	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}

	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_duration_sec INTEGER;")
	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMP;")"""
code = code.replace("""	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}""", alter_code)

# 3. CreateQuizHandler insert
create_insert = """	err = app.QuizDB.QueryRow("INSERT INTO quizzes (code, title, mode, style) VALUES ($1, $2, $3, $4) RETURNING id",
		q.Code, q.Title, q.Mode, q.Style).Scan(&q.ID)"""
create_insert_new = """	err = app.QuizDB.QueryRow("INSERT INTO quizzes (code, title, mode, style, timer_duration_sec) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		q.Code, q.Title, q.Mode, q.Style, q.TimerDurationSec).Scan(&q.ID)"""
code = code.replace(create_insert, create_insert_new)

# 4. adminUpdateQuizHandler update
update_quiz_target = """	_, err = tx.Exec("UPDATE quizzes SET title = $1, mode = $2, style = $3 WHERE id = $4",
		q.Title, q.Mode, q.Style, quizID)"""
update_quiz_new = """	_, err = tx.Exec("UPDATE quizzes SET title = $1, mode = $2, style = $3, timer_duration_sec = $4 WHERE id = $5",
		q.Title, q.Mode, q.Style, q.TimerDurationSec, quizID)"""
code = code.replace(update_quiz_target, update_quiz_new)

# 5. adminUpdateQuizStatusHandler
update_status_target = """    if req.PlayStatus != nil {
        app.QuizDB.Exec("UPDATE quizzes SET play_status = $1 WHERE id = $2", *req.PlayStatus, quizID)
    }"""
update_status_new = """    if req.PlayStatus != nil {
        if *req.PlayStatus == "started" {
            app.QuizDB.Exec("UPDATE quizzes SET play_status = $1, timer_end_at = CASE WHEN timer_duration_sec IS NOT NULL THEN CURRENT_TIMESTAMP + (timer_duration_sec || ' seconds')::interval ELSE NULL END WHERE id = $2", *req.PlayStatus, quizID)
        } else {
            app.QuizDB.Exec("UPDATE quizzes SET play_status = $1 WHERE id = $2", *req.PlayStatus, quizID)
        }
    }"""
code = code.replace(update_status_target, update_status_new)


# 6. adjustQuizStatus helper
helper = """func adjustQuizStatus(playStatus *string, timerEndAt *time.Time) {
	if playStatus != nil && *playStatus == "started" && timerEndAt != nil {
		if time.Now().After(*timerEndAt) {
			*playStatus = "ended"
		}
	}
}
"""
code = code.replace("func (app *App) getQuizStatusHandler", helper + "\nfunc (app *App) getQuizStatusHandler")


# 7. getQuizStatusHandler read timer_end_at
code = code.replace("SELECT id, code, visibility, play_status FROM quizzes", "SELECT id, code, visibility, play_status, timer_end_at FROM quizzes")
code = code.replace("Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus)", "Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &q.TimerEndAt)")
code = code.replace(
    "json.NewEncoder(w).Encode(map[string]string{",
    "adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)\n\tjson.NewEncoder(w).Encode(map[string]interface{}{"
)
code = code.replace(
    '"visibility": q.Visibility,\n\t    "play_status": q.PlayStatus,\n\t})',
    '"visibility": q.Visibility,\n\t    "play_status": q.PlayStatus,\n\t    "timer_end_at": q.TimerEndAt,\n\t})'
)

# 8. getQuizHandler read timer_end_at
code = code.replace("SELECT id, code, title, mode, style, visibility, play_status FROM quizzes", "SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes")
code = code.replace(
    "Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)",
    "Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &q.TimerEndAt)"
)
code = code.replace(
    "if q.Visibility == \"closed\" {",
    "adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)\n\tif q.Visibility == \"closed\" {"
)

# 9. adminGetQuizzesHandler read timer_end_at
code = code.replace(
    "rows, err := app.QuizDB.Query(\"SELECT id, code, title, mode, style, visibility, play_status FROM quizzes ORDER BY id DESC\")",
    "rows, err := app.QuizDB.Query(\"SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes ORDER BY id DESC\")"
)
code = code.replace(
    "rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)",
    "rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &q.TimerEndAt)\n\t\tadjustQuizStatus(&q.PlayStatus, q.TimerEndAt)"
)


# 10. Edit admin GET
code = code.replace(
    "app.QuizDB.QueryRow(\"SELECT id, code, title, mode, style, visibility, play_status FROM quizzes WHERE id = $1\", quizID).",
    "app.QuizDB.QueryRow(\"SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1\", quizID)."
)


# 11. answerHandler check
ans_target = """	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus)"""
ans_new = """	var timerEndAt *time.Time
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status, qz.timer_end_at
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus, &timerEndAt)"""
code = code.replace(ans_target, ans_new)

code = code.replace("	if quizPlayStatus != \"started\" {", "	adjustQuizStatus(&quizPlayStatus, timerEndAt)\n\tif quizPlayStatus != \"started\" {")

ans_dup_check = """
	// 重複回答チェック
	var existingAnswer int
	err = tx.QueryRow("SELECT id FROM quiz_answers WHERE question_id = $1 AND user_id = $2", req.QuestionID, req.UserID).Scan(&existingAnswer)
	if err == nil {
		http.Error(w, "Already answered", http.StatusConflict)
		return
	}
"""
code = code.replace("	if quizStyle == \"fastest\" {", ans_dup_check + "\n\tif quizStyle == \"fastest\" {")


# 12. History Handler
history_handler = """
func (app *App) userHistoryHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3] // /api/user/{id}/history

	rows, err := app.QuizDB.Query(`
		SELECT qz.id, qz.code, qz.title, qz.play_status, qz.timer_end_at,
		       SUM(qa.points) as total_score
		FROM quizzes qz
		JOIN quiz_questions qq ON qz.id = qq.quiz_id
		JOIN quiz_answers qa ON qq.id = qa.question_id
		WHERE qa.user_id = $1
		GROUP BY qz.id, qz.code, qz.title, qz.play_status, qz.timer_end_at
		ORDER BY qz.id DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type HistoryItem struct {
		QuizID     int        `json:"quiz_id"`
		Code       string     `json:"code"`
		Title      string     `json:"title"`
		PlayStatus string     `json:"play_status"`
		TotalScore int        `json:"total_score"`
		Questions  []Question `json:"questions"`
	}

	var history []HistoryItem
	for rows.Next() {
		var h HistoryItem
		var timerEndAt *time.Time
		rows.Scan(&h.QuizID, &h.Code, &h.Title, &h.PlayStatus, &timerEndAt, &h.TotalScore)
		adjustQuizStatus(&h.PlayStatus, timerEndAt)
		history = append(history, h)
	}

	// Fetch details if ended
	for i, h := range history {
		if h.PlayStatus == "ended" {
			qRows, _ := app.QuizDB.Query(`
				SELECT qq.id, qq.text, qq.options, qq.correct_index, qq.explanation, qa.selected_index, qa.is_correct
				FROM quiz_questions qq
				LEFT JOIN quiz_answers qa ON qq.id = qa.question_id AND qa.user_id = $1
				WHERE qq.quiz_id = $2 ORDER BY qq.id
			`, userID, h.QuizID)
			if qRows != nil {
				for qRows.Next() {
					var q Question
					var optionsJSON []byte
					var selectedIndex sql.NullInt32
					var isCorrect sql.NullBool
					qRows.Scan(&q.ID, &q.Text, &optionsJSON, &q.CorrectIndex, &q.Explanation, &selectedIndex, &isCorrect)
					json.Unmarshal(optionsJSON, &q.Options)
					
					// Store user answer inside the Question struct for the history view
					// We can reuse Hint for user's selected index string, or add a field.
					// Instead, let's just use Hint = selectedIndex
					if selectedIndex.Valid {
					    q.Hint = fmt.Sprintf("%d", selectedIndex.Int32)
					} else {
					    q.Hint = "-1"
					}
					
					h.Questions = append(h.Questions, q)
				}
				qRows.Close()
				history[i] = h
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}
"""

code = code.replace("func (app *App) answerHandler", history_handler + "\nfunc (app *App) answerHandler")

mux_target = """	mux.HandleFunc("/api/user/register", func(w http.ResponseWriter, r *http.Request) {
		app.registerUserHandler(w, r)
	})"""
mux_new = """	mux.HandleFunc("/api/user/", func(w http.ResponseWriter, r *http.Request) {
	    if strings.HasSuffix(r.URL.Path, "/register") {
		    app.registerUserHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/history") {
		    app.userHistoryHandler(w, r)
		}
	})"""
code = code.replace(mux_target, mux_new)


with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch applied")
