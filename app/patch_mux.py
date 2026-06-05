import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'r', encoding='utf-8') as f:
    code = f.read()

target = '	mux.HandleFunc("/api/user/register", app.registerUserHandler)'
replacement = """	mux.HandleFunc("/api/user/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/register") {
			app.registerUserHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/history") {
			app.userHistoryHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/answered") {
			app.userAnsweredHandler(w, r)
		}
	})"""

code = code.replace(target, replacement)

# 1. History Handler null time fix
h_target = """		var timerEndAt *time.Time
		rows.Scan(&h.QuizID, &h.Code, &h.Title, &h.PlayStatus, &timerEndAt, &h.TotalScore)"""
h_new = """		var nullTimer sql.NullTime
		var timerEndAt *time.Time
		rows.Scan(&h.QuizID, &h.Code, &h.Title, &h.PlayStatus, &nullTimer, &h.TotalScore)
		if nullTimer.Valid {
			t := nullTimer.Time
			timerEndAt = &t
		}"""
code = code.replace(h_target, h_new)

# 2. Answer Handler null time fix
a_target = """	var timerEndAt *time.Time
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status, qz.timer_end_at
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus, &timerEndAt)"""
a_new = """	var nullTimer sql.NullTime
	var timerEndAt *time.Time
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status, qz.timer_end_at
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		timerEndAt = &t
	}"""
code = code.replace(a_target, a_new)

# 3. getQuizHandler null time fix
g_exact = """	err := app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &q.TimerEndAt)"""
g_exact_new = """	var nullTimer sql.NullTime
	err := app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		q.TimerEndAt = &t
	}"""
code = code.replace(g_exact, g_exact_new)

# 4. adminGetQuizzesHandler null time fix
admin_g_exact = """    for rows.Next() {
        var q Quiz
        rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &q.TimerEndAt)
		adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)"""
admin_g_new = """    for rows.Next() {
        var q Quiz
        var nullTimer sql.NullTime
        rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
        if nullTimer.Valid {
            t := nullTimer.Time
            q.TimerEndAt = &t
        }
		adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)"""
code = code.replace(admin_g_exact, admin_g_new)

# 5. admin Edit Get
admin_e_exact = """				var q Quiz
				app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1", quizID).
					Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &q.TimerEndAt)"""
admin_e_new = """				var q Quiz
				var nullTimer sql.NullTime
				app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1", quizID).
					Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
				if nullTimer.Valid {
					t := nullTimer.Time
					q.TimerEndAt = &t
				}"""
code = code.replace(admin_e_exact, admin_e_new)

# 6. getQuizStatusHandler null time fix
s_exact = """    var q Quiz
    err := app.QuizDB.QueryRow("SELECT id, code, visibility, play_status, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &q.TimerEndAt)"""
s_new = """    var q Quiz
    var nullTimer sql.NullTime
    err := app.QuizDB.QueryRow("SELECT id, code, visibility, play_status, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &nullTimer)
    if nullTimer.Valid {
        t := nullTimer.Time
        q.TimerEndAt = &t
    }"""
code = code.replace(s_exact, s_new)

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'w', encoding='utf-8') as f:
    f.write(code)
