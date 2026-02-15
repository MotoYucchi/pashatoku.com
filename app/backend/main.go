package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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

type Quiz struct {
	ID    int    `json:"id"`
	Code  string `json:"code"`
	Title string `json:"title"`
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

	quizSchema := `CREATE TABLE IF NOT EXISTS quizzes (
		id SERIAL PRIMARY KEY,
		code CHAR(3) UNIQUE NOT NULL,
		title TEXT NOT NULL
	);`
	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}
	fmt.Println("Database tables initialized.")
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

// GET /api/quiz
func (app *App) getQuizHandler(w http.ResponseWriter, r *http.Request) {
	// 将来的にはURLパラメータから3桁コードを受け取ってQuizDBを検索する予定
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Ready to fetch quizzes from QuizDB"})
}

func main() {
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
	mux.HandleFunc("/api/quiz", app.getQuizHandler)
	mux.HandleFunc("/api/user/register", app.registerUserHandler)

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
