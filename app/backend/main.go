package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	_ "github.com/lib/pq"
	"github.com/rs/cors"
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
	ID         int        `json:"id"`
	Code       string     `json:"code"`
	Title      string     `json:"title"`
	Mode       string     `json:"mode"`
	Style      string     `json:"style"`
	Visibility string     `json:"visibility"`
	PlayStatus string     `json:"play_status"`
	Questions  []Question `json:"questions"`
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
		play_status VARCHAR(20) DEFAULT 'waiting'
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
	);`
	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}

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

	err = tx.QueryRow("INSERT INTO quizzes (code, title, mode, style, visibility, play_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", 
		q.Code, q.Title, q.Mode, q.Style, q.Visibility, q.PlayStatus).Scan(&q.ID)
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

func (app *App) getQuizStatusHandler(w http.ResponseWriter, r *http.Request) {
    code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

    var q Quiz
    err := app.QuizDB.QueryRow("SELECT id, code, visibility, play_status FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus)
		
	if err == sql.ErrNoRows {
		// もし見つからなければ、quiz_questions.code として検索
		var quizID int
		err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE code = $1", code).Scan(&quizID)
		if err != nil {
			http.Error(w, "Quiz not found", http.StatusNotFound)
			return
		}
		err = app.QuizDB.QueryRow("SELECT id, code, visibility, play_status FROM quizzes WHERE id = $1", quizID).
		    Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus)
	}
	
	if err != nil {
	    http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
	    "visibility": q.Visibility,
	    "play_status": q.PlayStatus,
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

	err := app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)
		
	if err == sql.ErrNoRows {
		var quizID int
		err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE code = $1", code).Scan(&quizID)
		if err != nil {
			http.Error(w, "Quiz or Question not found", http.StatusNotFound)
			return
		}
		err = app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status FROM quizzes WHERE id = $1", quizID).
		    Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)
		questionCodeFilter = code
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

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
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style, qz.visibility, qz.play_status
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle, &quizVisibility, &quizPlayStatus)
	
	if err != nil {
		http.Error(w, "Question not found", http.StatusNotFound)
		return
	}
	if quizVisibility == "closed" {
		http.Error(w, "Quiz is closed", http.StatusForbidden)
		return
	}
	if quizPlayStatus != "started" {
	    http.Error(w, "Quiz is not running", http.StatusForbidden)
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
    rows, err := app.QuizDB.Query("SELECT id, code, title, mode, style, visibility, play_status FROM quizzes ORDER BY id DESC")
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    quizzes := []Quiz{}
    for rows.Next() {
        var q Quiz
        rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)
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
        app.QuizDB.Exec("UPDATE quizzes SET play_status = $1 WHERE id = $2", *req.PlayStatus, quizID)
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

	_, err = tx.Exec("UPDATE quizzes SET title = $1, mode = $2, style = $3 WHERE id = $4",
		q.Title, q.Mode, q.Style, quizID)
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
	mux.HandleFunc("/api/user/register", app.registerUserHandler)
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
				app.QuizDB.QueryRow("SELECT id, code, title, mode, style, visibility, play_status FROM quizzes WHERE id = $1", quizID).
					Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus)
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
