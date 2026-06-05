import re

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/AdminDashboard.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

state_target = """  const [now, setNow] = useState(new Date());"""
state_new = """  const [now, setNow] = useState(new Date());
  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [globalTimerDays, setGlobalTimerDays] = useState(0);
  const [globalTimerHours, setGlobalTimerHours] = useState(0);
  const [globalTimerMinutes, setGlobalTimerMinutes] = useState(0);
  const [globalTimerSeconds, setGlobalTimerSeconds] = useState(0);"""
code = code.replace(state_target, state_new)

fetch_target = """  useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
    }"""
fetch_new = """  const fetchGlobalTimer = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/global_timer');
      setGlobalTimerEndAt(res.data.end_at);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
      fetchGlobalTimer();
    }"""
code = code.replace(fetch_target, fetch_new)

funcs_target = """  const updateQuizStatus = async (id, field, value) => {"""
funcs_new = """  const updateGlobalTimer = async (sec) => {
    try {
      const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
      await axios.post('http://localhost:8080/api/admin/global_timer', { duration_sec: sec }, {
        headers: { Authorization: `Bearer ${adminPass}` }
      });
      fetchGlobalTimer();
    } catch (e) { console.error(e); }
  };

  const updateQuizStatus = async (id, field, value) => {"""
code = code.replace(funcs_target, funcs_new)

ui_target = """          <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-xl mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-emerald-400">クイズイベント一覧</h2>
              <a href="/admin/create" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap">
                ✨ 新規作成
              </a>
            </div>"""
ui_new = """          {/* サービス全体タイマー設定 */}
          <div className="bg-red-900/20 rounded-3xl p-6 border border-red-500/30 shadow-xl mb-6">
            <h2 className="text-xl font-black text-red-400 mb-4">🌍 サービス全体強制タイマー</h2>
            <p className="text-slate-400 text-sm mb-4">設定した時間がゼロになると、全参加者の画面が強制終了画面に切り替わります。</p>
            {globalTimerEndAt && (
              <div className="bg-slate-900 p-4 rounded-xl border border-red-500 mb-4 text-center">
                <p className="text-slate-300 text-sm mb-1">現在の残り時間</p>
                <div className="text-3xl font-black text-red-400">
                  {(() => {
                     const end = new Date(globalTimerEndAt);
                     const diff = Math.floor((end - now) / 1000);
                     if (diff <= 0) return "終了しました";
                     return `${Math.floor(diff/86400)}日 ${Math.floor((diff%86400)/3600).toString().padStart(2, '0')}:${Math.floor((diff%3600)/60).toString().padStart(2, '0')}:${(diff%60).toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <div><label className="block text-xs text-slate-500 mb-1">日</label><input type="number" min="0" value={globalTimerDays} onChange={e=>setGlobalTimerDays(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">時間</label><input type="number" min="0" value={globalTimerHours} onChange={e=>setGlobalTimerHours(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">分</label><input type="number" min="0" value={globalTimerMinutes} onChange={e=>setGlobalTimerMinutes(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">秒</label><input type="number" min="0" value={globalTimerSeconds} onChange={e=>setGlobalTimerSeconds(parseInt(e.target.value)||0)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" /></div>
              <button onClick={() => updateGlobalTimer(globalTimerDays*86400 + globalTimerHours*3600 + globalTimerMinutes*60 + globalTimerSeconds)} className="ml-2 bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded font-bold shadow-lg">開始/更新</button>
              <button onClick={() => updateGlobalTimer(0)} className="ml-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded font-bold">停止/クリア</button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-xl mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-emerald-400">クイズイベント一覧</h2>
              <a href="/admin/create" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap">
                ✨ 新規作成
              </a>
            </div>"""
code = code.replace(ui_target, ui_new)

with open('c:/MyLibrary/Dev/pashatoku.com-1/app/frontend/src/AdminDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
