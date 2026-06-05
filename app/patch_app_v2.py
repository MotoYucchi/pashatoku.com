import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Global Timer State
state_target = """  const [timeLeft, setTimeLeft] = useState(null);"""
state_new = """  const [timeLeft, setTimeLeft] = useState(null);
  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [isGlobalEnded, setIsGlobalEnded] = useState(false);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(null);

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/global_timer');
        setGlobalTimerEndAt(res.data.end_at);
      } catch (e) { }
    };
    fetchGlobal();
    const int = setInterval(fetchGlobal, 30000); // Fetch every 30s
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    if (globalTimerEndAt) {
      const end = new Date(globalTimerEndAt).getTime();
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((end - now) / 1000);
        if (diff <= 0) {
          clearInterval(interval);
          setGlobalTimeLeft(0);
          setIsGlobalEnded(true);
        } else {
          setGlobalTimeLeft(diff);
          setIsGlobalEnded(false);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setGlobalTimeLeft(null);
      setIsGlobalEnded(false);
    }
  }, [globalTimerEndAt]);
"""
code = code.replace(state_target, state_new)

# 2. Global Timer View
banner_target = """      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />"""
banner_new = """      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />
      {globalTimeLeft !== null && !isGlobalEnded && (
        <div className="fixed top-0 left-0 w-full bg-red-900/90 backdrop-blur-md text-red-100 text-center py-2 font-black z-50 shadow-[0_4px_20px_rgba(220,38,38,0.4)] flex justify-center items-center gap-3 border-b border-red-500/50">
          <span>🌍 サービス全体終了まで</span>
          <span className="text-xl tracking-widest font-mono">
            {Math.floor(globalTimeLeft / 86400) > 0 ? `${Math.floor(globalTimeLeft / 86400)}日 ` : ''}
            {Math.floor((globalTimeLeft % 86400) / 3600).toString().padStart(2, '0')}:{(Math.floor((globalTimeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(globalTimeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}"""
code = code.replace(banner_target, banner_new)

# 3. Global Ended State injection
render_target = """      {viewMode === 'history' && isRegistered ? ("""
render_new = """      {isGlobalEnded ? (
         <div className="w-full max-w-md text-center animate-in zoom-in duration-500 mt-10">
           <div className="bg-red-900/40 p-10 rounded-3xl shadow-2xl border border-red-500/50">
             <div className="text-6xl mb-6 inline-block">🛑</div>
             <h2 className="text-3xl font-black mb-4 text-red-400">サービス終了</h2>
             <p className="text-red-200 font-bold mb-6">全イベントの制限時間が終了しました。</p>
             <button onClick={() => { setViewMode('history'); setIsGlobalEnded(false); fetchHistory(); }} className="w-full bg-red-700 text-white px-8 py-4 rounded-xl font-black hover:bg-red-600 transition-all shadow-lg border border-red-500">履歴・結果を見る</button>
           </div>
         </div>
      ) : viewMode === 'history' && isRegistered ? ("""
code = code.replace(render_target, render_new)

# 4. isAnswered logic
answered_target = """              </div>
           ) : (
             <>
               {/* 問題文パネル */}
               <div className="bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-6 relative overflow-hidden">"""
answered_new = """              </div>
           ) : quizData.questions[currentQIndex] && answeredQuestionIds.some(id => String(id) === String(quizData.questions[currentQIndex].id)) && !showAnswer ? (
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
code = code.replace(answered_target, answered_new)

# 5. Back to Scan Button
btn_target = """                  </button>
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
btn_new = """                  </button>
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
code = code.replace(btn_target, btn_new)

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
