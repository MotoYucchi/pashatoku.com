package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
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
	ID        int        `json:"id"`
	Code      string     `json:"code"`
	Title     string     `json:"title"`
	Mode      string     `json:"mode"`
	Style     string     `json:"style"`
	Status    string     `json:"status"`
	Questions []Question `json:"questions"`
}

// 起動時にテーブルを作成
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
		status VARCHAR(20) DEFAULT 'active'
	);
	CREATE TABLE IF NOT EXISTS quiz_questions (
	    id SERIAL PRIMARY KEY,
	    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
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

	// サンプルクイズの自動挿入
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
			Questions: []Question{
				{Text: "日本で一番高い山は？", Options: []string{"北岳", "富士山", "奥穂高岳", "槍ヶ岳"}, CorrectIndex: 1, Points: 5, QuestionType: "radio"},
				{Text: "日本の最北端の島は？", Options: []string{"択捉島", "利尻島", "礼文島", "与那国島"}, CorrectIndex: 0, Points: 5, QuestionType: "radio"},
			},
		},
	}

	for _, quiz := range examples {
		var qID int
		err := db.QueryRow("INSERT INTO quizzes (code, title, mode, style) VALUES ($1, $2, $3, $4) RETURNING id", quiz.Code, quiz.Title, quiz.Mode, quiz.Style).Scan(&qID)
		if err == nil {
			for _, q := range quiz.Questions {
				opts, _ := json.Marshal(q.Options)
				db.Exec("INSERT INTO quiz_questions (quiz_id, text, options, correct_index, points, question_type) VALUES ($1, $2, $3, $4, $5, $6)", 
					qID, q.Text, opts, q.CorrectIndex, q.Points, q.QuestionType)
			}
		}
	}
	fmt.Println("Example quizzes inserted.")
}

// バリデーション：16文字以内、記号禁止（・はOK）
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

func generateQuizCode() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// POST /api/user/register
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
		http.Error(w, "Invalid name format (Max 16 chars, no symbols except '・')", http.StatusUnprocessableEntity)
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

// POST /api/quizzes
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
	q.Status = "active"

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	err = tx.QueryRow("INSERT INTO quizzes (code, title, mode, style, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
		q.Code, q.Title, q.Mode, q.Style, q.Status).Scan(&q.ID)
	if err != nil {
		tx.Rollback()
		log.Printf("DB error: %v", err)
		http.Error(w, "Code might already exist. Please choose another code.", http.StatusConflict)
		return
	}

	for i, question := range q.Questions {
		optionsJSON, _ := json.Marshal(question.Options)
		
		// Set defaults if not provided from frontend yet
		if question.QuestionType == "" {
			question.QuestionType = "radio"
		}
		if question.Points == 0 {
			question.Points = 1
		}

		err = tx.QueryRow(
			`INSERT INTO quiz_questions 
			(quiz_id, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
			q.ID, question.Text, optionsJSON, question.CorrectIndex, question.Points, question.QuestionType, 
			question.MediaURL, question.Hint, question.PenaltyPoints, question.Explanation, question.Lat, question.Lng, question.Radius,
		).Scan(&q.Questions[i].ID)
		if err != nil {
			tx.Rollback()
			log.Printf("DB error: %v", err)
			http.Error(w, "Failed to insert question", http.StatusInternalServerError)
			return
		}
		q.Questions[i].QuizID = q.ID
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

// GET /api/quizzes?code=...
func (app *App) getQuizHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

	var q Quiz
	err := app.QuizDB.QueryRow("SELECT id, code, title, mode, style, status FROM quizzes WHERE code = $1", code).
		Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Status)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Quiz not found", http.StatusNotFound)
		} else {
			log.Printf("DB error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
		}
		return
	}

	rows, err := app.QuizDB.Query(`
		SELECT id, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius 
		FROM quiz_questions WHERE quiz_id = $1 ORDER BY id`, q.ID)
	if err != nil {
		log.Printf("DB error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var question Question
		var optionsJSON []byte
		if err := rows.Scan(
			&question.ID, &question.Text, &optionsJSON, &question.CorrectIndex, 
			&question.Points, &question.QuestionType, &question.MediaURL, &question.Hint, 
			&question.PenaltyPoints, &question.Explanation, &question.Lat, &question.Lng, &question.Radius,
		); err != nil {
			log.Printf("DB error: %v", err)
			continue
		}
		json.Unmarshal(optionsJSON, &question.Options)
		question.QuizID = q.ID
		q.Questions = append(q.Questions, question)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

// POST /api/quizzes/answer
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

	// 1. 問題の取得
	var q Question
	var quizStyle string
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, qz.style 
		FROM quiz_questions q 
		JOIN quizzes qz ON q.quiz_id = qz.id 
		WHERE q.id = $1`, req.QuestionID).Scan(&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &quizStyle)
	
	if err != nil {
		http.Error(w, "Question not found", http.StatusNotFound)
		return
	}

	// 2. 早押し(fastest)ロックの確認
	if quizStyle == "fastest" {
		var lockedBy int
		err = tx.QueryRow("SELECT user_id FROM quiz_locks WHERE question_id = $1", req.QuestionID).Scan(&lockedBy)
		if err == nil {
			// すでにロックされている
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(AnswerResponse{
				IsLocked: true,
				Message:  "この問題はすでに他のプレイヤーにクリアされています。",
			})
			return
		}
	}

	// 3. 正誤判定
	isCorrect := req.SelectedIndex == q.CorrectIndex
	awardedPoints := 0
	if isCorrect {
		awardedPoints = q.Points
		if req.UsedHint {
			awardedPoints = awardedPoints / 2 // ヒント使用時は半減
		}
		
		// 早押しの場合はロックを獲得
		if quizStyle == "fastest" {
			_, err = tx.Exec("INSERT INTO quiz_locks (question_id, user_id) VALUES ($1, $2)", req.QuestionID, req.UserID)
			if err != nil {
				// ロック獲得失敗（並行して他の人が先に解いた可能性）
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

	// 4. 回答の記録
	_, err = tx.Exec(`
		INSERT INTO quiz_answers (question_id, user_id, is_correct, points) 
		VALUES ($1, $2, $3, $4)`, req.QuestionID, req.UserID, isCorrect, awardedPoints)
	if err != nil {
		http.Error(w, "Failed to record answer", http.StatusInternalServerError)
		return
	}

	tx.Commit()

	// 5. 結果の返却
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AnswerResponse{
		IsCorrect:     isCorrect,
		PointsAwarded: awardedPoints,
		Explanation:   q.Explanation,
		IsLocked:      false,
	})
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

	// Init DB and create tables if they don't exist
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
	mux.HandleFunc("/api/quizzes/answer", app.answerHandler)

	// CORS Support
	handler := cors.Default().Handler(mux)

	fmt.Println("Backend Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func initDB(url string) *sql.DB {
	var db *sql.DB
	var err error

	// 最大10回、2秒おきにリトライする
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", url)
		if err == nil {
			err = db.Ping()
			if err == nil {
				return db // 接続成功
			}
		}
		log.Printf("DB wait... (%d/10): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}

	log.Fatalf("DB connection failed after retries: %v", err)
	return nil
}
