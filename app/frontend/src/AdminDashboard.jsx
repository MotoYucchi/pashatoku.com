import { useState, useEffect } from 'react';
import axios from 'axios';

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [sortField, setSortField] = useState('total_score');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [globalTimerDays, setGlobalTimerDays] = useState(0);
  const [globalTimerHours, setGlobalTimerHours] = useState(0);
  const [globalTimerMinutes, setGlobalTimerMinutes] = useState(0);
  const [globalTimerSeconds, setGlobalTimerSeconds] = useState(0);
  
  const fetchGlobalTimer = async () => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/global_timer`);
      setGlobalTimerEndAt(res.data.end_at);
    } catch (e) { console.error(e); }
  };
  
  const updateGlobalTimer = async (sec) => {
    try {
      const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
      await axios.post(`http://${window.location.hostname}:8080/api/admin/global_timer`, { duration_sec: sec }, {
        headers: { Authorization: `Bearer ${adminPass}` }
      });
      fetchGlobalTimer();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
      fetchGlobalTimer();
    }
    const int = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(int);
  }, [isAuthenticated]);

  const fetchQuizzes = async () => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/admin/quizzes`);
      setQuizzes(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
    if (password === adminPass) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('パスワードが間違っています。');
    }
  };

  const updateQuizStatus = async (id, field, value) => {
    try {
      await axios.patch(`http://${window.location.hostname}:8080/api/admin/quizzes/${id}/status`, { [field]: value });
      fetchQuizzes();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const viewResults = async (quiz) => {
    setSelectedQuiz(quiz);
    setLoading(true);
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/admin/quizzes/${quiz.id}/results`);
      setResults(res.data || []);
    } catch (err) {
      console.error("Failed to fetch results", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for new field
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-sm">
          <h2 className="text-2xl font-black mb-6 text-center text-purple-400">管理者ログイン</h2>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-400 mb-2">パスワード</label>
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          {authError && <p className="text-red-400 text-sm mb-4 font-bold text-center">{authError}</p>}
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold transition-all">ログイン</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">
        
        {/* 左側：イベント一覧 */}
        <div className="w-full xl:w-1/3 flex flex-col gap-6">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">イベント管理・結果閲覧</p>
            </div>
            <a href="/admin/create" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap">
              + 新規作成
            </a>
          </div>

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
              <h2 className="text-xl font-bold text-slate-200">クイズイベント一覧</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="p-6 hover:bg-slate-750 transition-colors">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">{quiz.title}</h3>
                    <div className="flex flex-wrap gap-2 text-xs font-mono mb-4">
                      <span className="bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">Code: {quiz.code}</span>
                      <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">{quiz.mode}</span>
                    </div>
                    
                    {/* ステータス管理コントロール */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                      {/* 公開状態 */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-400">1. イベント公開</span>
                        <button 
                          onClick={() => updateQuizStatus(quiz.id, 'visibility', quiz.visibility === 'open' ? 'closed' : 'open')}
                          className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${quiz.visibility === 'open' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'}`}
                        >
                          {quiz.visibility === 'open' ? '🟢 開放中 (Open)' : '🔴 閉鎖中 (Closed)'}
                        </button>
                      </div>
                      
                      {/* 進行状態 */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-400">2. クイズ進行</span>
                        {quiz.play_status === 'started' && quiz.timer_end_at && (
                          <div className="text-sm font-bold bg-slate-900 px-3 py-1 rounded-md border border-slate-700">
                            ⏳ 残り: {(() => {
                              const end = new Date(quiz.timer_end_at);
                              const diff = Math.floor((end - now) / 1000);
                              if (diff <= 0) return <span className="text-red-400">時間切れ</span>;
                              const d = Math.floor(diff / 86400);
                              const h = Math.floor((diff % 86400) / 3600);
                              const m = Math.floor((diff % 3600) / 60);
                              const s = diff % 60;
                              let str = '';
                              if (d > 0) str += `${d}日 `;
                              str += `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                              return <span className="text-emerald-400">{str}</span>;
                            })()}
                          </div>
                        )}
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                          <button 
                            onClick={() => updateQuizStatus(quiz.id, 'play_status', 'waiting')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${quiz.play_status === 'waiting' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            待機
                          </button>
                          <button 
                            onClick={() => updateQuizStatus(quiz.id, 'play_status', 'started')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${quiz.play_status === 'started' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            開始
                          </button>
                          <button 
                            onClick={() => updateQuizStatus(quiz.id, 'play_status', 'ended')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${quiz.play_status === 'ended' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            終了
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => viewResults(quiz)}
                    className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl text-sm font-bold transition-all text-slate-200 flex items-center justify-center gap-2 mb-2"
                  >
                    📊 ユーザー毎の得点・結果を見る
                  </button>
                  <a 
                    href={`/admin/edit?code=${quiz.code}&id=${quiz.id}`}
                    className="w-full bg-slate-800 border border-slate-600 hover:bg-slate-700 py-2 rounded-xl text-sm font-bold transition-all text-slate-300 flex items-center justify-center gap-2"
                  >
                    ✏️ クイズを編集する
                  </a>
                </div>
              ))}
              {quizzes.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-bold">イベントがありません。新しく作成してください。</div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：結果一覧 */}
        <div className="w-full xl:w-2/3">
          {selectedQuiz ? (
            <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden sticky top-6">
              <div className="p-6 border-b border-slate-700 bg-slate-900 flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-black text-emerald-400">イベント結果</h2>
                  <p className="text-slate-400 text-sm mt-1">{selectedQuiz.title}</p>
                </div>
                <div className="text-sm text-slate-500 font-mono">
                  参加者: {results.length}名
                </div>
              </div>
              <div className="p-0 overflow-x-auto">
                {loading ? (
                  <p className="text-center text-slate-500 p-10">読込中...</p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                        <th className="p-4 w-16 text-center">順位</th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('student_id')}>
                          学籍番号 {sortField === 'student_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('user_name')}>
                          名前 {sortField === 'user_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('total_score')}>
                          合計点 {sortField === 'total_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('attempt_count')}>
                          解答数 {sortField === 'attempt_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('correct_count')}>
                          正解数 {sortField === 'correct_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('accuracy')}>
                          正答率 {sortField === 'accuracy' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {sortedResults.length > 0 ? sortedResults.map((res, i) => (
                        <tr key={i} className="hover:bg-slate-750/50 transition-colors">
                          <td className="p-4 text-center font-black text-slate-500">{i + 1}</td>
                          <td className="p-4 font-mono text-sm text-slate-300">{res.student_id}</td>
                          <td className="p-4 font-bold text-white">{res.user_name}</td>
                          <td className="p-4 font-black text-emerald-400 text-lg">{res.total_score} <span className="text-xs font-normal text-emerald-700">pt</span></td>
                          <td className="p-4 text-slate-300">{res.attempt_count}</td>
                          <td className="p-4 text-slate-300">{res.correct_count}</td>
                          <td className="p-4 font-mono text-blue-400">{res.accuracy ? res.accuracy.toFixed(1) : 0}%</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="p-10 text-center text-slate-500 font-bold">まだ回答者がいません。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-3xl border border-slate-700/50 shadow-inner p-10 text-center text-slate-500 font-bold h-full flex flex-col justify-center items-center min-h-[400px]">
              <span className="text-4xl mb-4">📊</span>
              <p>左側のリストから「結果を見る」を選択してください。</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;
