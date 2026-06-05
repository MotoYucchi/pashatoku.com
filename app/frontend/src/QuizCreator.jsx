import { useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

function QuizCreator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // クイズ全体の設定
  const [title, setTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [mode, setMode] = useState('normal'); // normal, spot, gps
  const [style, setStyle] = useState('free'); // free, time_attack, fastest
  
  // 設問リスト
  const [questions, setQuestions] = useState([
    { 
      text: '', 
      options: ['', '', '', ''], 
      correct_index: 0,
      points: 1,
      question_type: 'radio',
      media_url: '',
      hint: '',
      penalty_points: 0,
      explanation: '',
      lat: '',
      lng: '',
      radius: 50 // メートル
    }
  ]);
  
  const [createdCode, setCreatedCode] = useState(null);
  const [error, setError] = useState('');

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

  const addQuestion = () => {
    setQuestions([...questions, { 
      text: '', options: ['', '', '', ''], correct_index: 0,
      points: 1, question_type: 'radio', media_url: '', hint: '', penalty_points: 0, explanation: '', lat: '', lng: '', radius: 50
    }]);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!title) {
      setError('タイトルを入力してください。');
      return;
    }
    for (let q of questions) {
      if (!q.text) {
        setError('問題文が未入力の箇所があります。');
        return;
      }
      if (q.question_type === 'radio') {
        for (let opt of q.options) {
          if (!opt) {
            setError('選択肢が未入力の箇所があります。');
            return;
          }
        }
      }
    }

    try {
      const payload = {
        title,
        mode,
        style,
        questions: questions.map(q => {
          const formattedQ = {
            ...q,
            correct_index: Number(q.correct_index),
            points: Number(q.points),
            penalty_points: Number(q.penalty_points),
            radius: Number(q.radius)
          };
          if (mode === 'gps' && q.lat && q.lng) {
            formattedQ.lat = parseFloat(q.lat);
            formattedQ.lng = parseFloat(q.lng);
          } else {
            formattedQ.lat = null;
            formattedQ.lng = null;
          }
          return formattedQ;
        })
      };
      
      if (customCode.trim() !== '') {
        payload.code = customCode.trim();
      }

      const res = await axios.post('http://localhost:8080/api/quizzes', payload);
      setCreatedCode(res.data.code);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 409) {
        setError('指定したクイズコードは既に使用されています。別のコードを指定してください。');
      } else {
        setError('クイズの作成に失敗しました。');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-sm">
          <h2 className="text-2xl font-black mb-6 text-center text-purple-400">管理者ログイン</h2>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-400 mb-2">パスワード</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          {authError && <p className="text-red-400 text-sm mb-4 font-bold text-center">{authError}</p>}
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold transition-all">
            ログイン
          </button>
        </form>
      </div>
    );
  }

  if (createdCode) {
    const quizUrl = `${window.location.origin}/?code=${createdCode}`;
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-700">
          <h2 className="text-3xl font-black mb-4 text-emerald-400">作成完了！</h2>
          <div className="bg-white p-6 rounded-2xl inline-block mb-6 shadow-lg">
            <QRCodeSVG value={quizUrl} size={200} />
          </div>
          <div className="mb-8 bg-slate-900 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1 font-bold">クイズコード</p>
            <p className="text-2xl font-black tracking-widest text-emerald-400">{createdCode}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-emerald-500 transition-all mb-4"
          >
            新しく別のクイズを作成する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              管理ダッシュボード
            </h1>
            <p className="text-slate-400 text-sm mt-1">クイズ・イベントの作成</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* --- クイズの基本設定 --- */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-emerald-400 mb-4 border-b border-slate-700 pb-2">1. イベント基本設定</h2>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">クイズタイトル <span className="text-red-400">*</span></label>
              <input 
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="例：第1回 キャンパスウォークラリー"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">読み取りモード</label>
                <select 
                  value={mode} onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-white font-bold"
                >
                  <option value="normal">一括開放 (通常モード)</option>
                  <option value="spot">スポット回収 (パシャトクモード)</option>
                  <option value="gps">位置情報チェック付き回収 (GPS)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">プレイスタイル</label>
                <select 
                  value={style} onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-white font-bold"
                >
                  <option value="free">時間制限なし</option>
                  <option value="time_attack">タイムアタック</option>
                  <option value="fastest">早押し (誰かが正解するとロック)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">カスタムクイズコード (任意)</label>
              <input 
                type="text" value={customCode} onChange={(e) => setCustomCode(e.target.value)}
                placeholder="例：WEBTEST_2026"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* --- 各問題の設定 --- */}
          <div className="space-y-8">
            <h2 className="text-xl font-black text-emerald-400 ml-2">2. 問題の作成</h2>
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-lg relative">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                  <h3 className="text-xl font-black text-purple-400">問題 {qIndex + 1}</h3>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(qIndex)} className="text-red-400 hover:text-red-300 text-sm font-bold bg-red-400/10 px-3 py-1 rounded-lg">削除</button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* 問題文 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">問題文 <span className="text-red-400">*</span></label>
                    <textarea 
                      value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                      placeholder="問題文を入力..." rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                    />
                  </div>

                  {/* メディアとヒント */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">画像URL / メディア (任意)</label>
                      <input 
                        type="text" value={q.media_url} onChange={(e) => updateQuestion(qIndex, 'media_url', e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">ヒントテキスト (任意)</label>
                      <input 
                        type="text" value={q.hint} onChange={(e) => updateQuestion(qIndex, 'hint', e.target.value)}
                        placeholder="ヒントを見ると得点が半減します"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* スコア・ペナルティ */}
                  <div className="grid grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <div>
                      <label className="block text-xs font-bold text-emerald-400 mb-2">正解時の獲得点数</label>
                      <input 
                        type="number" value={q.points} onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white text-center font-bold" min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-400 mb-2">誤答時の減点 (ペナルティ)</label>
                      <input 
                        type="number" value={q.penalty_points} onChange={(e) => updateQuestion(qIndex, 'penalty_points', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white text-center font-bold" min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">問題の形式</label>
                      <select 
                        value={q.question_type} onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white font-bold"
                      >
                        <option value="radio">4択問題</option>
                        {/* 将来的に text（記述）なども追加 */}
                      </select>
                    </div>
                  </div>

                  {/* GPS設定 (ModeがGPSの時のみ表示) */}
                  {mode === 'gps' && (
                    <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30">
                      <p className="text-xs text-blue-400 font-bold mb-3">📍 位置情報設定（GPSモード）</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">緯度 (Latitude)</label>
                          <input 
                            type="text" value={q.lat} onChange={(e) => updateQuestion(qIndex, 'lat', e.target.value)}
                            placeholder="35.6812" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">経度 (Longitude)</label>
                          <input 
                            type="text" value={q.lng} onChange={(e) => updateQuestion(qIndex, 'lng', e.target.value)}
                            placeholder="139.7671" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">許容半径 (メートル)</label>
                          <input 
                            type="number" value={q.radius} onChange={(e) => updateQuestion(qIndex, 'radius', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 選択肢 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-3 uppercase">選択肢と正解 <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all ${q.correct_index === oIndex ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-900 border-slate-700'}`}>
                          <input 
                            type="radio" 
                            name={`correct-${qIndex}`} checked={q.correct_index === oIndex}
                            onChange={() => updateQuestion(qIndex, 'correct_index', oIndex)}
                            className="w-5 h-5 text-purple-600 bg-slate-800 border-slate-600"
                          />
                          <input 
                            type="text" value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            placeholder={`選択肢 ${['A', 'B', 'C', 'D'][oIndex]}`}
                            className="flex-1 bg-transparent outline-none font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 解説 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">解説 (回答後に表示)</label>
                    <textarea 
                      value={q.explanation} onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                      placeholder="正解の理由や参考リンクなど..." rows={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button 
            type="button" onClick={addQuestion}
            className="w-full border-2 border-dashed border-slate-600 bg-slate-800/50 text-slate-300 hover:text-white hover:border-purple-500 hover:bg-slate-800 py-6 rounded-3xl font-black text-lg transition-all shadow-inner"
          >
            + 新しい問題を追加する
          </button>

          {error && <p className="text-red-400 text-center font-bold bg-red-900/20 py-4 rounded-xl">{error}</p>}

          <div className="sticky bottom-6 mt-10">
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-6 rounded-3xl font-black text-2xl shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-95 transition-all"
            >
              クイズイベントを作成する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuizCreator;
