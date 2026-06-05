import re
with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'r', encoding='utf-8') as f:
    code = f.read()

handler = """
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
"""

code = code.replace("func (app *App) answerHandler", handler + "\nfunc (app *App) answerHandler")

mux_target = """		} else if strings.HasSuffix(r.URL.Path, "/history") {
		    app.userHistoryHandler(w, r)
		}
	})"""
mux_new = """		} else if strings.HasSuffix(r.URL.Path, "/history") {
		    app.userHistoryHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/answered") {
		    app.userAnsweredHandler(w, r)
		}
	})"""
code = code.replace(mux_target, mux_new)

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/backend/main.go', 'w', encoding='utf-8') as f:
    f.write(code)
