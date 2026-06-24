package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	_ "github.com/lib/pq"
	"github.com/makiuchi-d/gozxing"
	"github.com/makiuchi-d/gozxing/qrcode"
	"github.com/rs/cors"
	"golang.org/x/image/draw"
)

type App struct {
	QuizDB *sql.DB
	UserDB *sql.DB
}

type User struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	StudentID string `json:"student_id"`
}

type Question struct {
	ID            int      `json:"id"`
	QuizID        int      `json:"quiz_id"`
	Code          string   `json:"code"`
	Text          string   `json:"text"`
	Options       []string `json:"options"`
	CorrectIndex  int      `json:"correct_index"`
	Points        int      `json:"points"`
	QuestionType  string   `json:"question_type"`
	MediaURL      string   `json:"media_url"`
	Hint          string   `json:"hint"`
	PenaltyPoints int      `json:"penalty_points"`
	Explanation   string   `json:"explanation"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
	Radius        *float64 `json:"radius"`
}

type AnswerRequest struct {
	UserID        int    `json:"user_id"`
	QuestionID    int    `json:"question_id"`
	SelectedIndex int    `json:"selected_index"`
	AnswerText    string `json:"answer_text"`
	UsedHint      bool   `json:"used_hint"`
}

type AnswerResponse struct {
	IsCorrect     bool   `json:"is_correct"`
	PointsAwarded int    `json:"points_awarded"`
	Explanation   string `json:"explanation"`
	IsLocked      bool   `json:"is_locked"`
	Message       string `json:"message"`
}

type Quiz struct {
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
}

type QuizResult struct {
	UserID       int     `json:"user_id"`
	UserName     string  `json:"user_name"`
	StudentID    string  `json:"student_id"`
	TotalScore   int     `json:"total_score"`
	AttemptCount int     `json:"attempt_count"`
	CorrectCount int     `json:"correct_count"`
	Accuracy     float64 `json:"accuracy"`
}

func createTables(app *App) {
	userSchema := `CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		name VARCHAR(16) NOT NULL,
		student_id TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS external_scans (
	    user_id INTEGER PRIMARY KEY,
	    code TEXT NOT NULL,
	    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := app.UserDB.Exec(userSchema); err != nil {
		log.Fatal("Failed to create User table:", err)
	}

	quizSchema := `
	CREATE TABLE IF NOT EXISTS quizzes (
		id SERIAL PRIMARY KEY,
		code VARCHAR(50) UNIQUE NOT NULL,
		title TEXT NOT NULL,
		mode VARCHAR(20) DEFAULT 'normal',
		style VARCHAR(20) DEFAULT 'free',
		visibility VARCHAR(20) DEFAULT 'open',
		play_status VARCHAR(20) DEFAULT 'waiting',
		timer_duration_sec INTEGER,
		timer_end_at TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS quiz_questions (
	    id SERIAL PRIMARY KEY,
	    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
	    code VARCHAR(10),
	    text TEXT NOT NULL,
	    options JSONB NOT NULL,
	    correct_index INTEGER NOT NULL,
		points INTEGER DEFAULT 1,
		question_type VARCHAR(20) DEFAULT 'radio',
		media_url TEXT DEFAULT '',
		hint TEXT DEFAULT '',
		penalty_points INTEGER DEFAULT 0,
		explanation TEXT DEFAULT '',
		lat DOUBLE PRECISION,
		lng DOUBLE PRECISION,
		radius DOUBLE PRECISION
	);
	CREATE TABLE IF NOT EXISTS quiz_answers (
		id SERIAL PRIMARY KEY,
		question_id INTEGER REFERENCES quiz_questions(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL,
		is_correct BOOLEAN NOT NULL,
		points INTEGER NOT NULL,
		answer_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS quiz_locks (
	    question_id INTEGER PRIMARY KEY REFERENCES quiz_questions(id) ON DELETE CASCADE,
	    user_id INTEGER NOT NULL,
	    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS global_settings (
	    key VARCHAR(50) PRIMARY KEY,
	    value TEXT NOT NULL
	);`
	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}

	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_duration_sec INTEGER;")
	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMP;")

	var count int
	err := app.QuizDB.QueryRow("SELECT COUNT(*) FROM quizzes").Scan(&count)
	if err == nil && count == 0 {
		insertExampleQuizzes(app.QuizDB)
	}
	fmt.Println("Database tables initialized.")
}

func insertExampleQuizzes(db *sql.DB) {
	examples := []Quiz{
		{
			Code:  "demo1",
			Title: "サンプルクイズ 1: IT基礎",
			Mode:  "normal",
			Style: "free",
			Visibility: "open",
			PlayStatus: "started",
			Questions: []Question{
				{Text: "HTMLは何の略？", Options: []string{"HyperText Markup Language", "HighText Machine Language", "HyperTool Multi Language", "None of the above"}, CorrectIndex: 0, Points: 1, QuestionType: "radio"},
				{Text: "次のうちプログラミング言語ではないものは？", Options: []string{"Python", "Java", "HTML", "C++"}, CorrectIndex: 2, Points: 1, QuestionType: "radio"},
			},
		},
		{
			Code:  "demo2",
			Title: "サンプルクイズ 2: 早押しテスト",
			Mode:  "normal",
			Style: "fastest",
			Visibility: "open",
			PlayStatus: "waiting",
			Questions: []Question{
				{Text: "日本で一番高い山は？", Options: []string{"北岳", "富士山", "奥穂高岳", "槍ヶ岳"}, CorrectIndex: 1, Points: 5, QuestionType: "radio"},
				{Text: "日本の最北端の島は？", Options: []string{"択捉島", "利尻島", "礼文島", "与那国島"}, CorrectIndex: 0, Points: 5, QuestionType: "radio"},
			},
		},
	}

	for _, quiz := range examples {
		var qID int
		err := db.QueryRow("INSERT INTO quizzes (code, title, mode, style, visibility, play_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", 
		    quiz.Code, quiz.Title, quiz.Mode, quiz.Style, quiz.Visibility, quiz.PlayStatus).Scan(&qID)
		if err == nil {
			for _, q := range quiz.Questions {
				opts, _ := json.Marshal(q.Options)
				db.Exec("INSERT INTO quiz_questions (quiz_id, code, text, options, correct_index, points, question_type) VALUES ($1, $2, $3, $4, $5, $6, $7)", 
					qID, generateRandomString(5), q.Text, opts, q.CorrectIndex, q.Points, q.QuestionType)
			}
		}
	}
	fmt.Println("Example quizzes inserted.")
}

func isValidName(name string) bool {
	runes := []rune(name)
	if len(runes) == 0 || len(runes) > 16 {
		return false
	}
	for _, r := range runes {
		if unicode.IsSymbol(r) || (unicode.IsPunct(r) && r != '・') {
			return false
		}
	}
	return true
}

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

func generateQuizCode() string {
	return generateRandomString(8)
}

func (app *App) registerUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if !isValidName(u.Name) {
		http.Error(w, "Invalid name format", http.StatusUnprocessableEntity)
		return
	}

	query := `INSERT INTO users (name, student_id) VALUES ($1, $2) RETURNING id`
	err := app.UserDB.QueryRow(query, u.Name, u.StudentID).Scan(&u.ID)
	if err != nil {
		log.Printf("DB error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func (app *App) createQuizHandler(w http.ResponseWriter, r *http.Request) {
	var q Quiz
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if q.Code == "" {
		q.Code = generateQuizCode()
	}
	if q.Mode == "" {
		q.Mode = "normal"
	}
	if q.Style == "" {
		q.Style = "free"
	}
	q.Visibility = "open"
	q.PlayStatus = "waiting" // 最初は待機中

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	err = tx.QueryRow("INSERT INTO quizzes (code, title, mode, style, visibility, play_status, timer_duration_sec) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id", 
		q.Code, q.Title, q.Mode, q.Style, q.Visibility, q.PlayStatus, q.TimerDurationSec).Scan(&q.ID)
	if err != nil {
		tx.Rollback()
		log.Printf("DB error: %v", err)
		http.Error(w, "Code might already exist. Please choose another code.", http.StatusConflict)
		return
	}

	for i, question := range q.Questions {
		optionsJSON, _ := json.Marshal(question.Options)
		if question.QuestionType == "" {
			question.QuestionType = "radio"
		}
		if question.Points == 0 {
			question.Points = 1
		}
		
		qCode := question.Code
		if q.Mode == "spot" && qCode == "" {
		    qCode = generateRandomString(5)
		}

		err = tx.QueryRow(
			`INSERT INTO quiz_questions 
			(quiz_id, code, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
			q.ID, qCode, question.Text, optionsJSON, question.CorrectIndex, question.Points, question.QuestionType, 
			question.MediaURL, question.Hint, question.PenaltyPoints, question.Explanation, question.Lat, question.Lng, question.Radius,
		).Scan(&q.Questions[i].ID)
		if err != nil {
			tx.Rollback()
			log.Printf("DB error: %v", err)
			http.Error(w, "Failed to insert question", http.StatusInternalServerError)
			return
		}
		q.Questions[i].QuizID = q.ID
		q.Questions[i].Code = qCode
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func adjustQuizStatus(playStatus *string, timerEndAt *time.Time) {
	if playStatus != nil && *playStatus == "started" && timerEndAt != nil {
		if time.Now().After(*timerEndAt) {
			*playStatus = "ended"
		}
	}
}

func (app *App) getQuizStatusHandler(w http.ResponseWriter, r *http.Request) {
    code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

    var q Quiz
    var nullTimer sql.NullTime
    err := app.QuizDB.QueryRow("SELECT id, code, visibility, play_status, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &nullTimer)
    if nullTimer.Valid {
        t := nullTimer.Time
        q.TimerEndAt = &t
    }
		
	if err == sql.ErrNoRows {
		// もし見つからなければ、quiz_questions.code として検索
		var quizID int
		err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE code = $1", code).Scan(&quizID)
		if err != nil {
			http.Error(w, "Quiz not found", http.StatusNotFound)
			return
		}
		var nullTimer2 sql.NullTime
		err = app.QuizDB.QueryRow("SELECT id, code, visibility, play_status, timer_end_at FROM quizzes WHERE id = $1", quizID).
		    Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &nullTimer2)
		if nullTimer2.Valid {
			t2 := nullTimer2.Time
			q.TimerEndAt = &t2
		}
	}
	
	if err != nil {
	    http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
	json.NewEncoder(w).Encode(map[string]interface{}{
	    "visibility": q.Visibility,
	    "play_status": q.PlayStatus,
	    "timer_end_at": q.TimerEndAt,
	})
}

func (app *App) getQuizHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

	var q Quiz
	questionCodeFilter := ""

	var nullTimer sql.NullTime
	err := app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		q.TimerEndAt = &t
	}
		
	if err == sql.ErrNoRows {
		var quizID int
		err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE code = $1", code).Scan(&quizID)
		if err != nil {
			http.Error(w, "Quiz or Question not found", http.StatusNotFound)
			return
		}
		var nullTimer2 sql.NullTime
		err = app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1", quizID).
		    Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer2)
		if nullTimer2.Valid {
			t2 := nullTimer2.Time
			q.TimerEndAt = &t2
		}
		questionCodeFilter = code
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
	if q.Visibility == "closed" {
		http.Error(w, "This quiz is closed", http.StatusForbidden)
		return
	}
	
	// If waiting, just return metadata without questions
	if q.PlayStatus == "waiting" {
	    q.Questions = []Question{}
	    w.Header().Set("Content-Type", "application/json")
    	json.NewEncoder(w).Encode(q)
    	return
	}

	query := `
		SELECT id, COALESCE(code, ''), text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius 
		FROM quiz_questions WHERE quiz_id = $1`
		
	var rows *sql.Rows
	if questionCodeFilter != "" {
	    query += " AND code = $2 ORDER BY id"
	    rows, err = app.QuizDB.Query(query, q.ID, questionCodeFilter)
	} else {
	    query += " ORDER BY id"
	    rows, err = app.QuizDB.Query(query, q.ID)
	}

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var question Question
		var optionsJSON []byte
		if err := rows.Scan(
			&question.ID, &question.Code, &question.Text, &optionsJSON, &question.CorrectIndex, 
			&question.Points, &question.QuestionType, &question.MediaURL, &question.Hint, 
			&question.PenaltyPoints, &question.Explanation, &question.Lat, &question.Lng, &question.Radius,
		); err != nil {
			continue
		}
		json.Unmarshal(optionsJSON, &question.Options)
		question.QuizID = q.ID
		q.Questions = append(q.Questions, question)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}


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
		var nullTimer sql.NullTime
		var timerEndAt *time.Time
		rows.Scan(&h.QuizID, &h.Code, &h.Title, &h.PlayStatus, &nullTimer, &h.TotalScore)
		if nullTimer.Valid {
			t := nullTimer.Time
			timerEndAt = &t
		}
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


func (app *App) userAnsweredHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	rows, err := app.QuizDB.Query("SELECT question_id FROM quiz_answers WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var answered []int
	for rows.Next() {
		var qid int
		rows.Scan(&qid)
		answered = append(answered, qid)
	}
	if answered == nil {
	    answered = []int{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answered)
}

func (app *App) answerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var q Question
	var quizStyle, quizVisibility, quizPlayStatus string
	var nullTimer sql.NullTime
	var timerEndAt *time.Time
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status, qz.timer_end_at
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		timerEndAt = &t
	}
	
	if err != nil {
		http.Error(w, "Question not found", http.StatusNotFound)
		return
	}
	if quizVisibility == "closed" {
		http.Error(w, "Quiz is closed", http.StatusForbidden)
		return
	}
	adjustQuizStatus(&quizPlayStatus, timerEndAt)
	if quizPlayStatus != "started" {
	    http.Error(w, "Quiz is not running", http.StatusForbidden)
		return
	}


	// 重複回答チェック
	var existingAnswer int
	err = tx.QueryRow("SELECT id FROM quiz_answers WHERE question_id = $1 AND user_id = $2", req.QuestionID, req.UserID).Scan(&existingAnswer)
	if err == nil {
		http.Error(w, "Already answered", http.StatusConflict)
		return
	}

	if quizStyle == "fastest" {
		var lockedBy int
		err = tx.QueryRow("SELECT user_id FROM quiz_locks WHERE question_id = $1", req.QuestionID).Scan(&lockedBy)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(AnswerResponse{
				IsLocked: true,
				Message:  "この問題はすでに他のプレイヤーにクリアされています。",
			})
			return
		}
	}

	isCorrect := req.SelectedIndex == q.CorrectIndex
	awardedPoints := 0
	if isCorrect {
		awardedPoints = q.Points
		if req.UsedHint {
			awardedPoints = awardedPoints / 2
		}
	
	// 重複回答チェック
	var existingAnswer int
	err = tx.QueryRow("SELECT id FROM quiz_answers WHERE question_id = $1 AND user_id = $2", req.QuestionID, req.UserID).Scan(&existingAnswer)
	if err == nil {
		http.Error(w, "Already answered", http.StatusConflict)
		return
	}

	if quizStyle == "fastest" {
			_, err = tx.Exec("INSERT INTO quiz_locks (question_id, user_id) VALUES ($1, $2)", req.QuestionID, req.UserID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(AnswerResponse{
					IsLocked: true,
					Message:  "タッチの差で他のプレイヤーにクリアされました。",
				})
				return
			}
		}
	} else {
		awardedPoints = -q.PenaltyPoints
	}

	_, err = tx.Exec(`
		INSERT INTO quiz_answers (question_id, user_id, is_correct, points) 
		VALUES ($1, $2, $3, $4)`, req.QuestionID, req.UserID, isCorrect, awardedPoints)
	if err != nil {
		http.Error(w, "Failed to record answer", http.StatusInternalServerError)
		return
	}

	tx.Commit()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AnswerResponse{
		IsCorrect:     isCorrect,
		PointsAwarded: awardedPoints,
		Explanation:   q.Explanation,
		IsLocked:      false,
	})
}

func (app *App) adminGetQuizzesHandler(w http.ResponseWriter, r *http.Request) {
    rows, err := app.QuizDB.Query("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes ORDER BY id DESC")
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    quizzes := []Quiz{}
    for rows.Next() {
        var q Quiz
        var nullTimer sql.NullTime
        rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
        if nullTimer.Valid {
            t := nullTimer.Time
            q.TimerEndAt = &t
        }
        adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
        quizzes = append(quizzes, q)
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(quizzes)
}

func (app *App) adminUpdateQuizStatusHandler(w http.ResponseWriter, r *http.Request) {
    parts := strings.Split(r.URL.Path, "/")
    if len(parts) < 5 {
        http.Error(w, "Invalid path", http.StatusBadRequest)
        return
    }
    quizID := parts[4] // /api/admin/quizzes/{id}/status

    var req struct {
        Visibility *string `json:"visibility"`
        PlayStatus *string `json:"play_status"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid body", http.StatusBadRequest)
        return
    }

    if req.Visibility != nil {
        app.QuizDB.Exec("UPDATE quizzes SET visibility = $1 WHERE id = $2", *req.Visibility, quizID)
    }
    if req.PlayStatus != nil {
        if *req.PlayStatus == "started" {
            app.QuizDB.Exec("UPDATE quizzes SET play_status = $1, timer_end_at = CASE WHEN timer_duration_sec IS NOT NULL THEN CURRENT_TIMESTAMP + (timer_duration_sec || ' seconds')::interval ELSE NULL END WHERE id = $2", *req.PlayStatus, quizID)
        } else {
            app.QuizDB.Exec("UPDATE quizzes SET play_status = $1 WHERE id = $2", *req.PlayStatus, quizID)
        }
    }

    w.WriteHeader(http.StatusOK)
}

func (app *App) adminGetResultsHandler(w http.ResponseWriter, r *http.Request) {
    parts := strings.Split(r.URL.Path, "/")
    if len(parts) < 5 {
        http.Error(w, "Invalid path", http.StatusBadRequest)
        return
    }
    quizID := parts[4] // /api/admin/quizzes/{id}/results

    rows, err := app.QuizDB.Query(`
        SELECT 
            user_id, 
            SUM(qa.points) as total_score,
            COUNT(*) as attempt_count,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count
        FROM quiz_answers qa
        JOIN quiz_questions qq ON qa.question_id = qq.id
        WHERE qq.quiz_id = $1
        GROUP BY user_id
        ORDER BY total_score DESC
    `, quizID)
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var results []QuizResult
    for rows.Next() {
        var r QuizResult
        rows.Scan(&r.UserID, &r.TotalScore, &r.AttemptCount, &r.CorrectCount)
        if r.AttemptCount > 0 {
            r.Accuracy = float64(r.CorrectCount) / float64(r.AttemptCount) * 100
        }
        results = append(results, r)
    }

    // 各ユーザーの名前をUserDBから取得
    for i, res := range results {
        var name, studentID string
        err := app.UserDB.QueryRow("SELECT name, student_id FROM users WHERE id = $1", res.UserID).Scan(&name, &studentID)
        if err == nil {
            results[i].UserName = name
            results[i].StudentID = studentID
        } else {
            results[i].UserName = "Unknown"
        }
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(results)
}

func (app *App) adminUpdateQuizHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	quizID := parts[4] // /api/admin/quizzes/{id}

	var q Quiz
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("UPDATE quizzes SET title = $1, mode = $2, style = $3, timer_duration_sec = $4 WHERE id = $5",
		q.Title, q.Mode, q.Style, q.TimerDurationSec, quizID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update quiz", http.StatusInternalServerError)
		return
	}

	// 既存の問題をすべて削除して再登録（簡易な更新処理）
	_, err = tx.Exec("DELETE FROM quiz_questions WHERE quiz_id = $1", quizID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete old questions", http.StatusInternalServerError)
		return
	}

	for i, question := range q.Questions {
		optionsJSON, _ := json.Marshal(question.Options)
		if question.QuestionType == "" {
			question.QuestionType = "radio"
		}
		if question.Points == 0 {
			question.Points = 1
		}
		
		qCode := question.Code
		if q.Mode == "spot" && qCode == "" {
		    qCode = generateRandomString(5)
		}

		err = tx.QueryRow(
			`INSERT INTO quiz_questions 
			(quiz_id, code, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
			quizID, qCode, question.Text, optionsJSON, question.CorrectIndex, question.Points, question.QuestionType, 
			question.MediaURL, question.Hint, question.PenaltyPoints, question.Explanation, question.Lat, question.Lng, question.Radius,
		).Scan(&q.Questions[i].ID)
		if err != nil {
			tx.Rollback()
			log.Printf("DB error: %v", err)
			http.Error(w, "Failed to insert question", http.StatusInternalServerError)
			return
		}
		q.Questions[i].QuizID = quizID
		q.Questions[i].Code = qCode
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}


func main() {
	rand.Seed(time.Now().UnixNano())
	quizURL := os.Getenv("QUIZ_DB_URL")
	userURL := os.Getenv("USER_DB_URL")

	app := &App{
		QuizDB: initDB(quizURL),
		UserDB: initDB(userURL),
	}
	defer app.QuizDB.Close()
	defer app.UserDB.Close()

	createTables(app)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/user/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/register") {
			app.registerUserHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/history") {
			app.userHistoryHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/answered") {
			app.userAnsweredHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/external_scan") {
			app.externalScanHandler(w, r)
		}
	})
	mux.HandleFunc("/api/qr/receive", app.qrReceiveHandler)
	mux.HandleFunc("/api/quizzes", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			app.createQuizHandler(w, r)
		} else if r.Method == http.MethodGet {
			app.getQuizHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/quizzes/status", app.getQuizStatusHandler)
	mux.HandleFunc("/api/quizzes/answer", app.answerHandler)
	
	// Global Timer Handlers
	mux.HandleFunc("/api/global_timer", app.getGlobalTimerHandler)
	mux.HandleFunc("/api/admin/global_timer", app.adminGlobalTimerHandler)
	
	// Admin APIs
	mux.HandleFunc("/api/admin/quizzes", func(w http.ResponseWriter, r *http.Request) {
	    if r.Method == http.MethodGet {
	        app.adminGetQuizzesHandler(w, r)
	    }
	})
	mux.HandleFunc("/api/admin/quizzes/", func(w http.ResponseWriter, r *http.Request) {
	    if strings.HasSuffix(r.URL.Path, "/status") && r.Method == http.MethodPatch {
	        app.adminUpdateQuizStatusHandler(w, r)
	    } else if strings.HasSuffix(r.URL.Path, "/results") && r.Method == http.MethodGet {
	        app.adminGetResultsHandler(w, r)
	    } else if r.Method == http.MethodPut {
			app.adminUpdateQuizHandler(w, r)
		} else if r.Method == http.MethodGet {
			// Edit用のクイズ取得API
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) >= 4 {
				quizID := parts[4]
				var q Quiz
				var nullTimer sql.NullTime
				app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status, timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1", quizID).
					Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.TimerDurationSec, &nullTimer)
				if nullTimer.Valid {
					t := nullTimer.Time
					q.TimerEndAt = &t
				}
				rows, _ := app.QuizDB.Query("SELECT id, COALESCE(code, ''), text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius FROM quiz_questions WHERE quiz_id = $1 ORDER BY id", quizID)
				if rows != nil {
					defer rows.Close()
					for rows.Next() {
						var question Question
						var optionsJSON []byte
						rows.Scan(&question.ID, &question.Code, &question.Text, &optionsJSON, &question.CorrectIndex, &question.Points, &question.QuestionType, &question.MediaURL, &question.Hint, &question.PenaltyPoints, &question.Explanation, &question.Lat, &question.Lng, &question.Radius)
						json.Unmarshal(optionsJSON, &question.Options)
						q.Questions = append(q.Questions, question)
					}
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(q)
			}
		} else {
	        http.Error(w, "Not found", http.StatusNotFound)
	    }
	})

	handler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler(mux)

	fmt.Println("Backend Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func initDB(url string) *sql.DB {
	var db *sql.DB
	var err error
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", url)
		if err == nil {
			err = db.Ping()
			if err == nil {
				return db
			}
		}
		log.Printf("DB wait... (%d/10): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("DB connection failed after retries: %v", err)
	return nil
}

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
			VALUES ('global_timer_end_at', to_char(CURRENT_TIMESTAMP + ($1 || ' seconds')::interval, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
		`, *req.DurationSec)
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (app *App) qrReceiveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := r.Header.Get("X-User-Name")
	studentID := r.Header.Get("X-Student-Id")

	if name == "" || studentID == "" {
		http.Error(w, "Missing credentials", http.StatusUnauthorized)
		return
	}

	var userID int
	err := app.UserDB.QueryRow("SELECT id FROM users WHERE name = $1 AND student_id = $2", name, studentID).Scan(&userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	contentType := r.Header.Get("Content-Type")
	var code string

	if strings.Contains(contentType, "multipart/form-data") || strings.HasPrefix(contentType, "image/") {
		// Image processing
		var file io.Reader
		if strings.Contains(contentType, "multipart/form-data") {
			err := r.ParseMultipartForm(10 << 20)
			if err != nil {
				http.Error(w, "Invalid multipart data", http.StatusBadRequest)
				return
			}
			f, _, err := r.FormFile("image")
			if err != nil {
				http.Error(w, "Invalid image data", http.StatusBadRequest)
				return
			}
			defer f.Close()
			file = f
		} else {
			file = r.Body
		}

		img, _, err := image.Decode(file)
		if err != nil {
			http.Error(w, "Failed to decode image", http.StatusBadRequest)
			return
		}

		bounds := img.Bounds()
		if bounds.Dx() > 1920 || bounds.Dy() > 1200 {
			var newWidth, newHeight int
			if float64(bounds.Dx())/1920.0 > float64(bounds.Dy())/1200.0 {
				newWidth = 1920
				newHeight = int(float64(bounds.Dy()) * (1920.0 / float64(bounds.Dx())))
			} else {
				newHeight = 1200
				newWidth = int(float64(bounds.Dx()) * (1200.0 / float64(bounds.Dy())))
			}
			resized := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
			draw.CatmullRom.Scale(resized, resized.Bounds(), img, bounds, draw.Over, nil)
			img = resized
		}

		bmp, _ := gozxing.NewBinaryBitmapFromImage(img)
		qrReader := qrcode.NewQRCodeReader()
		result, err := qrReader.Decode(bmp, nil)
		if err != nil {
			http.Error(w, "No QR code found", http.StatusBadRequest)
			return
		}
		code = result.GetText()
	} else {
		// Assume text payload
		b, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}
		code = string(b)
	}

	if code == "" {
		http.Error(w, "Empty code", http.StatusBadRequest)
		return
	}

	app.UserDB.Exec(`
		INSERT INTO external_scans (user_id, code) 
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, created_at = CURRENT_TIMESTAMP
	`, userID, code)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "code": code})
}

func (app *App) externalScanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	var code string
	err := app.UserDB.QueryRow("DELETE FROM external_scans WHERE user_id = $1 RETURNING code", userID).Scan(&code)
	if err == nil && code != "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"code": code})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{})
}
