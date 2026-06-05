import re
with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State additions
state_add = """  const [viewMode, setViewMode] = useState('quiz'); // 'quiz' or 'history'
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
  const [historyData, setHistoryData] = useState([]);
"""
code = code.replace("const [error, setError] = useState('')", state_add + "  const [error, setError] = useState('')")

# 2. Fetch answered questions after registration
# in useEffect that checks saved info
eff_target = """      setUserId(parseInt(savedUserId));
      setTosAgreed(true);
      setHostTosAgreed(true);
      setIsRegistered(true);
    }
  }, []);"""
eff_new = """      setUserId(parseInt(savedUserId));
      setTosAgreed(true);
      setHostTosAgreed(true);
      setIsRegistered(true);
      fetchAnsweredQuestions(parseInt(savedUserId));
    }
  }, []);

  const fetchAnsweredQuestions = async (uid) => {
    try {
      const res = await axios.get(`http://localhost:8080/api/user/${uid}/answered`);
      setAnsweredQuestionIds(res.data || []);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`http://localhost:8080/api/user/${userId}/history`);
      setHistoryData(res.data || []);
    } catch (e) {}
  };
"""
code = code.replace(eff_target, eff_new)

# handleRegister
reg_target = """      setUserId(res.data.id);
      setIsRegistered(true);
    } catch (err) {"""
reg_new = """      setUserId(res.data.id);
      setIsRegistered(true);
      fetchAnsweredQuestions(res.data.id);
    } catch (err) {"""
code = code.replace(reg_target, reg_new)

# handleOptionSelect (add to answered list)
ans_target = """      setScore(prev => prev + res.data.points_awarded);
      setShowAnswer(true);

    } catch (err) {
      setError('通信エラーが発生しました。');"""
ans_new = """      setScore(prev => prev + res.data.points_awarded);
      setShowAnswer(true);
      setAnsweredQuestionIds(prev => [...prev, quizData.questions[currentQIndex].id]);
    } catch (err) {
      if (err.response && err.response.status === 409) {
          setError('この問題は既に回答済みです。');
      } else {
          setError('通信エラーが発生しました。');
      }"""
code = code.replace(ans_target, ans_new)

# 3. Block active answered questions
q_render_target = """    if (quizData.play_status === 'waiting') {
      return (
        <div className="bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-700">
          <div className="animate-pulse mb-6">⏳</div>
          <h2 className="text-2xl font-black text-white mb-2">イベント待機中</h2>
          <p className="text-slate-400">管理者がクイズを開始するまでお待ちください。</p>
        </div>
      );
    }"""
q_render_new = """    if (quizData.play_status === 'waiting') {
      return (
        <div className="bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-700">
          <div className="animate-pulse mb-6">⏳</div>
          <h2 className="text-2xl font-black text-white mb-2">イベント待機中</h2>
          <p className="text-slate-400">管理者がクイズを開始するまでお待ちください。</p>
        </div>
      );
    }

    const currentQ = quizData.questions[currentQIndex];
    const isAnswered = currentQ && answeredQuestionIds.includes(currentQ.id);

    if (isAnswered && quizData.play_status !== 'ended' && !showAnswer) {
      return (
        <div className="bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-700">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-emerald-400 mb-2">回答済みです</h2>
          <p className="text-slate-400">この問題は既に回答しています。<br/>クイズイベントが「終了」になるまで、問題内容や正解の確認はできません。</p>
          {quizData.mode === 'spot' && (
             <button onClick={() => { setQuizCode(null); setQuizData(null); }} className="mt-6 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-xl font-bold text-white transition-colors">
               他の問題を探す
             </button>
          )}
        </div>
      );
    }
"""
code = code.replace(q_render_target, q_render_new)

# 4. Navbar & History Tab
nav_target = """        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">📸</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-tight">Pashatoku<span className="text-emerald-400">.</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campus Quiz Rally</p>
            </div>
          </div>
          {isRegistered && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400 font-bold">Player</p>
                <p className="text-sm font-bold text-emerald-400">{name}</p>
              </div>
              <button 
                onClick={handleResetRegistration}
                className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-all"
              >
                リセット
              </button>
            </div>
          )}
        </div>
      </header>"""
nav_new = """        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">📸</span>
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white leading-tight">Pashatoku<span className="text-emerald-400">.</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campus Quiz Rally</p>
              </div>
            </div>
            {isRegistered && (
              <button 
                onClick={handleResetRegistration}
                className="sm:hidden text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-all"
              >
                リセット
              </button>
            )}
          </div>
          {isRegistered && (
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button 
                  onClick={() => setViewMode('quiz')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'quiz' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  🎯 クイズ
                </button>
                <button 
                  onClick={() => { setViewMode('history'); fetchHistory(); }}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'history' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  📋 履歴・結果
                </button>
              </div>
              <div className="text-right hidden sm:block ml-2 border-l border-slate-700 pl-4">
                <p className="text-xs text-slate-400 font-bold">Player</p>
                <p className="text-sm font-bold text-emerald-400">{name}</p>
              </div>
              <button 
                onClick={handleResetRegistration}
                className="hidden sm:block text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-all"
              >
                リセット
              </button>
            </div>
          )}
        </div>
      </header>"""
code = code.replace(nav_target, nav_new)

# 5. History View Rendering
history_view = """
  if (viewMode === 'history') {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
        {/* Header is outside, so we just render content here. Wait, header is part of App return. */}
        <main className="flex-1 max-w-3xl mx-auto w-full p-6">
          <h2 className="text-2xl font-black text-white mb-6">参加履歴・結果</h2>
          <div className="space-y-6">
            {historyData.length === 0 ? (
              <p className="text-slate-400 text-center py-8">まだ参加したクイズがありません。</p>
            ) : historyData.map(h => (
              <div key={h.quiz_id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 mb-1">{h.title}</h3>
                    <p className="text-xs text-slate-400">コード: {h.code} | ステータス: {h.play_status === 'ended' ? '終了' : h.play_status === 'waiting' ? '待機中' : '進行中'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">獲得ポイント</p>
                    <p className="text-2xl font-black text-white">{h.total_score} <span className="text-sm font-normal text-slate-400">pt</span></p>
                  </div>
                </div>
                
                {h.play_status === 'ended' ? (
                  <div className="mt-4 space-y-4">
                    <h4 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">出題とあなたの回答</h4>
                    {h.questions && h.questions.map((q, i) => (
                      <div key={q.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm font-bold text-white mb-3">Q{i+1}. {q.text}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          {q.options.map((opt, oIdx) => {
                            let bg = "bg-slate-800 border-slate-700 text-slate-400";
                            const userAns = parseInt(q.hint);
                            if (q.correct_index === oIdx) bg = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                            else if (userAns === oIdx) bg = "bg-red-500/20 border-red-500 text-red-400";
                            return (
                              <div key={oIdx} className={`px-3 py-2 rounded-lg border text-sm flex justify-between ${bg}`}>
                                <span>{opt}</span>
                                {q.correct_index === oIdx && <span>✅</span>}
                                {userAns === oIdx && q.correct_index !== oIdx && <span>❌</span>}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-300">
                            <strong>💡 解説:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-center">
                    <p className="text-sm text-slate-400">🔒 クイズが終了するまで問題や正解の詳細は確認できません。</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }
"""

main_render = """  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">"""
code = code.replace(main_render, main_render + "\n" + history_view)


# 6. We need to handle viewMode condition correctly. The main render function has the header, and then `<main className="flex-1 max-w-xl mx-auto w-full p-6">`.
# Wait, my `history_view` above returned a whole new `div` with no header!
# Let me fix that. I will inject `history_view` inside the `<main>` instead.
# Actually, `App.jsx` structure:
# return (
#   <div className="min-h-screen ...">
#     <header>...</header>
#     {viewMode === 'history' ? (
#        <main ... history content ... </main>
#     ) : (
#        <main className="flex-1 max-w-xl mx-auto w-full p-6">
#           ... existing quiz content ...
#        </main>
#     )}
#   </div>
# )

# Revert my bad inject:
code = code.replace(main_render + "\n" + history_view, main_render)

# Let's find `<main className="flex-1 max-w-xl mx-auto w-full p-6">`
main_start = """      <main className="flex-1 max-w-xl mx-auto w-full p-6">"""
main_new = """      {viewMode === 'history' ? (
        <main className="flex-1 max-w-3xl mx-auto w-full p-6">
          <h2 className="text-2xl font-black text-white mb-6">参加履歴・結果</h2>
          <div className="space-y-6">
            {historyData.length === 0 ? (
              <p className="text-slate-400 text-center py-8">まだ参加したクイズがありません。</p>
            ) : historyData.map(h => (
              <div key={h.quiz_id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 mb-1">{h.title}</h3>
                    <p className="text-xs text-slate-400">コード: {h.code} | ステータス: {h.play_status === 'ended' ? '終了' : h.play_status === 'waiting' ? '待機中' : '進行中'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">獲得ポイント</p>
                    <p className="text-2xl font-black text-white">{h.total_score} <span className="text-sm font-normal text-slate-400">pt</span></p>
                  </div>
                </div>
                
                {h.play_status === 'ended' ? (
                  <div className="mt-4 space-y-4">
                    <h4 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">出題とあなたの回答</h4>
                    {h.questions && h.questions.map((q, i) => (
                      <div key={q.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm font-bold text-white mb-3">Q{i+1}. {q.text}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          {q.options.map((opt, oIdx) => {
                            let bg = "bg-slate-800 border-slate-700 text-slate-400";
                            const userAns = parseInt(q.hint);
                            if (q.correct_index === oIdx) bg = "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold";
                            else if (userAns === oIdx) bg = "bg-red-500/20 border-red-500 text-red-400 font-bold";
                            return (
                              <div key={oIdx} className={`px-3 py-2 rounded-lg border text-sm flex justify-between ${bg}`}>
                                <span>{opt}</span>
                                {q.correct_index === oIdx && <span>✅</span>}
                                {userAns === oIdx && q.correct_index !== oIdx && <span>❌</span>}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-300 mt-3">
                            <strong>💡 解説:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-center">
                    <p className="text-sm text-slate-400">🔒 クイズが終了するまで問題や正解の詳細は確認できません。</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      ) : (
      <main className="flex-1 max-w-xl mx-auto w-full p-6">"""

code = code.replace(main_start, main_new)

main_end = """        )}
      </main>
    </div>
  )
}

export default App"""
main_end_new = """        )}
      </main>
      )}
    </div>
  )
}

export default App"""
code = code.replace(main_end, main_end_new)


with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
