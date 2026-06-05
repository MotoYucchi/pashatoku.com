import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Timer State and Effect
timer_code = """  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (quizData && quizData.timer_end_at && quizData.play_status === 'started') {
      const end = new Date(quizData.timer_end_at).getTime();
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((end - now) / 1000);
        if (diff <= 0) {
          clearInterval(interval);
          setTimeLeft(0);
          setQuizData(prev => ({...prev, play_status: 'ended'}));
        } else {
          setTimeLeft(diff);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [quizData]);

"""
code = code.replace("  const [gpsVerified, setGpsVerified] = useState(false)\n", "  const [gpsVerified, setGpsVerified] = useState(false)\n" + timer_code)

# 2. Global Timer Banner
banner_code = """      {quizData && quizData.timer_end_at && quizData.play_status === 'started' && timeLeft !== null && (
        <div className="fixed top-0 left-0 w-full bg-red-600/90 backdrop-blur-md text-white text-center py-2 font-black z-50 shadow-lg flex justify-center items-center gap-3">
          <span>⏳ イベント終了まで</span>
          <span className="text-xl tracking-widest">{Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:{(Math.floor((timeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      )}
"""
code = code.replace("      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />\n", "      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />\n" + banner_code)

# 3. Header viewMode Toggle
header_target = """      <header className="mb-10 text-center relative w-full max-w-md mt-4">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          PASHATOKU.COM
        </h1>
        <p className="text-slate-400 text-sm mt-2">Interactive Quiz System</p>
      </header>"""
header_new = """      <header className={`mb-10 text-center relative w-full max-w-md ${timeLeft !== null ? 'mt-14' : 'mt-4'}`}>
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          PASHATOKU.COM
        </h1>
        <p className="text-slate-400 text-sm mt-2">Interactive Quiz System</p>
        
        {isRegistered && (
          <div className="mt-6 flex justify-center space-x-4">
            <button onClick={() => setViewMode('quiz')} className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${viewMode === 'quiz' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>クイズ</button>
            <button onClick={() => { setViewMode('history'); fetchHistory(); }} className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${viewMode === 'history' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>履歴・結果</button>
          </div>
        )}
      </header>"""
code = code.replace(header_target, header_new)

# 4. History View rendering
history_view_code = """      {viewMode === 'history' && isRegistered ? (
         <div className="w-full max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-2xl font-black mb-6 text-emerald-400 text-center">参加履歴・結果</h2>
           {historyData.length === 0 ? (
             <p className="text-slate-400 text-center py-8">まだ参加したイベントがありません。</p>
           ) : historyData.map(h => (
             <div key={h.quiz_id} className="bg-slate-800 p-6 rounded-2xl mb-4 border border-slate-700 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="font-bold text-lg text-blue-300">{h.title}</h3>
                   {h.play_status === 'ended' ? <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">終了済</span> : <span className="bg-emerald-900 text-emerald-300 text-xs px-2 py-1 rounded">開催中</span>}
                </div>
                <p className="text-sm text-slate-400 mb-4">合計スコア: <span className="text-xl font-black text-white">{h.total_score || 0}</span> pt</p>
                {h.play_status === 'ended' && (
                  <p className="text-xs text-slate-500">※イベントが終了したため、詳細な結果はこのイベントに参加した人のみ閲覧可能です。(今後のアップデートで詳細表示機能が追加される予定です)</p>
                )}
             </div>
           ))}
         </div>
      ) : !isRegistered ? ("""
code = code.replace("      {!isRegistered ? (", history_view_code)

# 5. isAnswered & Back to Scan Button
is_answered_target = """              </div>
           ) : (
             <>
               {/* 問題文パネル */}
               <div className="bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-6 relative overflow-hidden">"""
is_answered_new = """              </div>
           ) : quizData.questions[currentQIndex] && answeredQuestionIds.includes(quizData.questions[currentQIndex].id) && !showAnswer ? (
             <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700 text-center animate-in zoom-in">
                <div className="text-5xl mb-6 inline-block">🔒</div>
                <h2 className="text-2xl font-black mb-4 text-emerald-400">回答済みです</h2>
                <p className="text-slate-400 font-bold mb-6">この問題はすでに回答しています。</p>
                <button onClick={() => { setQuizData(null); setQuizCode(null); }} className="w-full bg-slate-700 text-white px-8 py-4 rounded-xl font-black hover:bg-slate-600 transition-all">スキャン画面に戻る</button>
             </div>
           ) : (
             <>
               {/* 問題文パネル */}
               <div className="bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-6 relative overflow-hidden">"""
code = code.replace(is_answered_target, is_answered_new)

back_to_scan_target = """                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;"""
back_to_scan_new = """                  </button>
                </div>
              )}
              
              {/* スキャンに戻るボタン */}
              <button onClick={() => { if(window.confirm('本当にスキャン画面に戻りますか？現在の問題の進行状況は失われる場合があります。')) { setQuizData(null); setQuizCode(null); } }} className="mt-8 w-full bg-slate-800 text-slate-400 px-8 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700 shadow-sm">スキャン画面に戻る</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;"""
code = code.replace(back_to_scan_target, back_to_scan_new)

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
