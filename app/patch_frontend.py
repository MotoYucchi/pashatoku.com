import os
import re

app_file = r'c:\MyLibrary\Dev\pashatoku.com-1\app\frontend\src\App.jsx'
admin_file = r'c:\MyLibrary\Dev\pashatoku.com-1\app\frontend\src\AdminDashboard.jsx'

with open(app_file, 'r', encoding='utf-8') as f:
    app_code = f.read()

# 1. App.jsx: Replace localhost with window.location.hostname
app_code = app_code.replace("'http://localhost:8080/api/", "http://:8080/api/")
app_code = app_code.replace("http://localhost:8080/api/", "http://:8080/api/")

# 2. App.jsx: Add global timer states
state_target = "const [gpsVerified, setGpsVerified] = useState(false)"
state_inject = '''const [gpsVerified, setGpsVerified] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null);
  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [isGlobalEnded, setIsGlobalEnded] = useState(false);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(null);'''
app_code = app_code.replace(state_target, state_inject)

# 3. App.jsx: Add global timer effects
effect_target = '''useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);'''
effect_inject = '''useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await axios.get(http://:8080/api/global_timer);
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);'''
app_code = app_code.replace(effect_target, effect_inject)

# 4. App.jsx: Banner Injection
banner_target = "      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />"
banner_inject = '''      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />
      {globalTimeLeft !== null && !isGlobalEnded && (
        <div className="fixed top-0 left-0 w-full bg-red-900/90 backdrop-blur-md text-red-100 text-center py-2 font-black z-50 shadow-[0_4px_20px_rgba(220,38,38,0.4)] flex justify-center items-center gap-3 border-b border-red-500/50">
          <span>?? サービス全体終了まで</span>
          <span className="text-xl tracking-widest font-mono">
            {Math.floor(globalTimeLeft / 86400) > 0 ? ${Math.floor(globalTimeLeft / 86400)}日  : ''}
            {Math.floor((globalTimeLeft % 86400) / 3600).toString().padStart(2, '0')}:{(Math.floor((globalTimeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(globalTimeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      {quizData && quizData.timer_end_at && quizData.play_status === 'started' && timeLeft !== null && (
        <div className="fixed top-0 left-0 w-full bg-red-600/90 backdrop-blur-md text-white text-center py-2 font-black z-50 shadow-lg flex justify-center items-center gap-3">
          <span>? イベント終了まで</span>
          <span className="text-xl tracking-widest">{Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:{(Math.floor((timeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      )}'''
app_code = app_code.replace(banner_target, banner_inject)

# Header padding
header_target = '''<header className="mb-10 text-center relative w-full max-w-md mt-4">'''
header_inject = '''<header className={mb-10 text-center relative w-full max-w-md }>'''
app_code = app_code.replace(header_target, header_inject)

# 5. App.jsx: History Tab & Global Ended Modal
history_target = '''        <p className="text-slate-400 text-sm mt-2">Interactive Quiz System</p>
      </header>

      {!isRegistered ? ('''
history_inject = '''        <p className="text-slate-400 text-sm mt-2">Interactive Quiz System</p>
        {isRegistered && (
          <div className="mt-6 flex justify-center space-x-4">
            <button onClick={() => setViewMode('quiz')} className={px-6 py-2 rounded-xl font-black text-sm transition-all }>クイズ</button>
            <button onClick={() => { setViewMode('history'); fetchHistory(); }} className={px-6 py-2 rounded-xl font-black text-sm transition-all }>履歴・結果</button>
          </div>
        )}
      </header>

      {isGlobalEnded ? (
         <div className="w-full max-w-md text-center animate-in zoom-in duration-500 mt-10">
           <div className="bg-red-900/40 p-10 rounded-3xl shadow-2xl border border-red-500/50">
             <div className="text-6xl mb-6 inline-block">??</div>
             <h2 className="text-3xl font-black mb-4 text-red-400">サービス終了</h2>
             <p className="text-red-200 font-bold mb-6">全イベントの制限時間が終了しました。</p>
             <button onClick={() => { setViewMode('history'); setIsGlobalEnded(false); fetchHistory(); }} className="w-full bg-red-700 text-white px-8 py-4 rounded-xl font-black hover:bg-red-600 transition-all shadow-lg border border-red-500">履歴・結果を見る</button>
           </div>
         </div>
      ) : viewMode === 'history' && isRegistered ? (
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
      ) : !isRegistered ? ('''
app_code = app_code.replace(history_target, history_inject)

# 6. App.jsx: Answered Lock screen
answered_target = '''                   <button onClick={() => { setGpsVerified(false); setGpsError('再検証中...'); verifyGps(quizData.questions[currentQIndex].lat, quizData.questions[currentQIndex].lng, quizData.questions[currentQIndex].radius || 50).then(()=>setGpsVerified(true)).catch(e=>setGpsError(e)) }} className="bg-blue-600 px-6 py-2 rounded-xl font-bold text-white">再試行</button>
                )}
             </div>
          ) : ('''
answered_inject = '''                   <button onClick={() => { setGpsVerified(false); setGpsError('再検証中...'); verifyGps(quizData.questions[currentQIndex].lat, quizData.questions[currentQIndex].lng, quizData.questions[currentQIndex].radius || 50).then(()=>setGpsVerified(true)).catch(e=>setGpsError(e)) }} className="bg-blue-600 px-6 py-2 rounded-xl font-bold text-white">再試行</button>
                )}
             </div>
          ) : quizData.questions[currentQIndex] && answeredQuestionIds.some(id => String(id) === String(quizData.questions[currentQIndex].id)) && !showAnswer ? (
             <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700 text-center animate-in zoom-in">
                <div className="text-5xl mb-6 inline-block">??</div>
                <h2 className="text-2xl font-black mb-4 text-emerald-400">回答済みです</h2>
                <p className="text-slate-400 font-bold mb-6">この問題はすでに回答しています。</p>
                <button onClick={() => { setQuizData(null); setQuizCode(null); }} className="w-full bg-slate-700 text-white px-8 py-4 rounded-xl font-black hover:bg-slate-600 transition-all shadow-lg border border-slate-600">スキャン画面に戻る</button>
             </div>
          ) : ('''
app_code = app_code.replace(answered_target, answered_inject)

with open(app_file, 'w', encoding='utf-8') as f:
    f.write(app_code)


with open(admin_file, 'r', encoding='utf-8') as f:
    admin_code = f.read()

# 1. AdminDashboard.jsx: Replace localhost
admin_code = admin_code.replace("'http://localhost:8080/api/", "http://:8080/api/")
admin_code = admin_code.replace("http://localhost:8080/api/", "http://:8080/api/")

# 2. AdminDashboard.jsx: Inject states
admin_state_target = "const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'"
admin_state_inject = '''const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [globalTimerDays, setGlobalTimerDays] = useState(0);
  const [globalTimerHours, setGlobalTimerHours] = useState(0);
  const [globalTimerMinutes, setGlobalTimerMinutes] = useState(0);
  const [globalTimerSeconds, setGlobalTimerSeconds] = useState(0);
  
  const fetchGlobalTimer = async () => {
    try {
      const res = await axios.get(http://:8080/api/global_timer);
      setGlobalTimerEndAt(res.data.end_at);
    } catch (e) { console.error(e); }
  };
  
  const updateGlobalTimer = async (sec) => {
    try {
      const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
      await axios.post(http://:8080/api/admin/global_timer, { duration_sec: sec }, {
        headers: { Authorization: Bearer  }
      });
      fetchGlobalTimer();
    } catch (e) { console.error(e); }
  };'''
admin_code = admin_code.replace(admin_state_target, admin_state_inject)

# 3. AdminDashboard.jsx: Inject fetch in useEffect
admin_effect_target = '''useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
    }'''
admin_effect_inject = '''useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
      fetchGlobalTimer();
    }'''
admin_code = admin_code.replace(admin_effect_target, admin_effect_inject)

# 4. AdminDashboard.jsx: Inject UI
admin_ui_target = '''<div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-slate-200">クイズイベント一覧</h2>'''
admin_ui_inject = '''{/* サービス全体タイマー設定 */}
          <div className="bg-red-900/20 rounded-3xl p-6 border border-red-500/30 shadow-xl mb-6">
            <h2 className="text-xl font-black text-red-400 mb-4">?? サービス全体強制タイマー</h2>
            <p className="text-slate-400 text-sm mb-4">設定した時間がゼロになると、全参加者の画面が強制終了画面に切り替わります。</p>
            {globalTimerEndAt && (
              <div className="bg-slate-900 p-4 rounded-xl border border-red-500 mb-4 text-center">
                <p className="text-slate-300 text-sm mb-1">現在の残り時間</p>
                <div className="text-3xl font-black text-red-400">
                  {(() => {
                     const end = new Date(globalTimerEndAt);
                     const diff = Math.floor((end - now) / 1000);
                     if (diff <= 0) return "終了しました";
                     return ${Math.floor(diff/86400)}日 ::;
                  })()}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <div><label className="block text-xs text-slate-500 mb-1">日</label><input type="number" min="0" value={globalTimerDays} onChange={e=>setGlobalTimerDays(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">時間</label><input type="number" min="0" value={globalTimerHours} onChange={e=>setGlobalTimerHours(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">分</label><input type="number" min="0" value={globalTimerMinutes} onChange={e=>setGlobalTimerMinutes(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">秒</label><input type="number" min="0" value={globalTimerSeconds} onChange={e=>setGlobalTimerSeconds(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none" /></div>
              <button onClick={() => updateGlobalTimer(globalTimerDays*86400 + globalTimerHours*3600 + globalTimerMinutes*60 + globalTimerSeconds)} className="ml-2 bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded font-bold shadow-lg transition-all">開始/更新</button>
              <button onClick={() => updateGlobalTimer(0)} className="ml-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-1.5 rounded font-bold transition-all">停止/クリア</button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-slate-200">クイズイベント一覧</h2>'''
admin_code = admin_code.replace(admin_ui_target, admin_ui_inject)

with open(admin_file, 'w', encoding='utf-8') as f:
    f.write(admin_code)

print("Patch applied successfully.")
