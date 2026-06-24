import { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

function QuizCreator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [title, setTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [mode, setMode] = useState('normal'); 
  const [style, setStyle] = useState('free'); 
  
  const [timerDays, setTimerDays] = useState(0);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const [questions, setQuestions] = useState([
    { 
      code: '',
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
      radius: 50 
    }
  ]);
  
  const [createdCode, setCreatedCode] = useState(null);
  const [createdQuiz, setCreatedQuiz] = useState(null);
  const [error, setError] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  const editCode = urlParams.get('code');
  const isEditMode = Boolean(editId && editCode);

  useEffect(() => {
    if (isAuthenticated && isEditMode) {
      axios.get(`http://localhost:8080/api/admin/quizzes/${editId}`)
        .then(res => {
          const qz = res.data;
          setTitle(qz.title);
          setCustomCode(qz.code);
          setMode(qz.mode);
          setStyle(qz.style);
          if (qz.timer_duration_sec) {
            const d = Math.floor(qz.timer_duration_sec / 86400);
            const h = Math.floor((qz.timer_duration_sec % 86400) / 3600);
            const m = Math.floor((qz.timer_duration_sec % 3600) / 60);
            const s = qz.timer_duration_sec % 60;
            setTimerDays(d);
            setTimerHours(h);
            setTimerMinutes(m);
            setTimerSeconds(s);
          }
          if (qz.questions && qz.questions.length > 0) {
            setQuestions(qz.questions.map(q => ({
              ...q,
              options: q.options || ['', '', '', ''],
              lat: q.lat || '',
              lng: q.lng || '',
              radius: q.radius || 50
            })));
          }
        })
        .catch(err => {
          setError('編集するクイズの取得に失敗しました。');
        });
    }
  }, [isAuthenticated, isEditMode, editId, editCode]);

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
      code: '', text: '', options: ['', '', '', ''], correct_index: 0,
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

  const generateRandomCode = (index) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for(let i=0; i<5; i++){
       code += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    updateQuestion(index, 'code', code);
  }

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
      let timerDurationSec = null;
      const totalSec = (parseInt(timerDays) || 0) * 86400 + 
                       (parseInt(timerHours) || 0) * 3600 + 
                       (parseInt(timerMinutes) || 0) * 60 + 
                       (parseInt(timerSeconds) || 0);
      if (totalSec > 0) {
          timerDurationSec = Math.min(totalSec, 8035200); // Max 93 days
      }

      const payload = {
        title,
        mode,
        style,
        timer_duration_sec: timerDurationSec,
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

      if (isEditMode) {
        const res = await axios.put(`http://localhost:8080/api/admin/quizzes/${editId}`, payload);
        setCreatedCode(res.data.code);
        setCreatedQuiz(res.data);
      } else {
        const res = await axios.post('http://localhost:8080/api/quizzes', payload);
        setCreatedCode(res.data.code);
        setCreatedQuiz(res.data);
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 409) {
        setError('指定したクイズコードは既に使用されています。別のコードを指定してください。');
      } else {
        setError(`クイズの${isEditMode ? '更新' : '作成'}に失敗しました。`);
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
    const isSpotMode = createdQuiz && createdQuiz.mode === 'spot';

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans print:bg-white print:text-black print:p-0">
        <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-700 print:hidden">
          <h2 className="text-3xl font-black mb-4 text-emerald-400">作成完了！</h2>
          
          {!isSpotMode ? (
            <>
              <div className="bg-white p-6 rounded-2xl inline-block mb-6 shadow-lg">
                <QRCodeSVG value={quizUrl} size={200} />
              </div>
              <div className="mb-8 bg-slate-900 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 mb-1 font-bold">クイズコード</p>
                <p className="text-2xl font-black tracking-widest text-emerald-400">{createdCode}</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400 mb-4 font-bold">スポット専用問題コード（パシャトクモード）</p>
              <div className="max-h-64 overflow-y-auto mb-6 bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-4">
                {createdQuiz.questions.map((q, idx) => (
                  <div key={q.id || idx} className="bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-600 text-left">
                    <div>
                      <p className="text-xs text-slate-400 font-bold mb-1">Q{idx + 1}: {q.text.substring(0, 15)}...</p>
                      <p className="text-xl font-black tracking-widest text-emerald-400">{q.code}</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <QRCodeSVG value={`${window.location.origin}/?code=${q.code}`} size={60} />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => window.print()} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-500 transition-all mb-4 flex items-center justify-center gap-2">
                🖨️ QRコードを印刷
              </button>
            </>
          )}

          <div className="flex gap-4">
             <button onClick={() => window.location.reload()} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-500 transition-all">続けて作成</button>
             <a href="/admin" className="flex-1 bg-slate-700 text-white py-4 rounded-xl font-bold hover:bg-slate-600 transition-all flex items-center justify-center">ダッシュボードへ戻る</a>
          </div>
        </div>

        {/* 印刷用UI */}
        {isSpotMode && (
          <div className="hidden print:block w-full">
            {createdQuiz.questions.map((q, idx) => (
              <div key={`print-${q.id || idx}`} className="break-after-page flex flex-col items-center justify-center min-h-screen w-full bg-white text-black p-10 print:h-screen">
                <h1 className="text-6xl font-black mb-10 text-center">{createdQuiz.title}</h1>
                <h2 className="text-4xl font-bold mb-16 text-center">Q{idx + 1}: {q.text}</h2>
                <QRCodeSVG value={`${window.location.origin}/?code=${q.code}`} size={500} />
                <p className="text-4xl font-black tracking-widest mt-16 font-mono bg-gray-100 px-8 py-4 rounded-2xl border-4 border-gray-300">
                  {q.code}
                </p>
                <p className="text-2xl mt-12 text-gray-500 font-bold">PASHATOKU.COM</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              {isEditMode ? 'イベント編集' : 'イベント作成'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isEditMode ? '既存のクイズイベントを編集します' : '新しいクイズイベントを設定します'}
            </p>
          </div>
          <a href="/admin" className="text-slate-400 hover:text-white font-bold bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">← 戻る</a>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
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
              <label className="block text-sm font-bold text-slate-400 mb-2">タイマー設定 (自動終了機能)</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input type="number" min="0" max="93" value={timerDays} onChange={(e) => setTimerDays(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center" />
                  <span className="block text-center text-xs text-slate-500 mt-1">日</span>
                </div>
                <div className="flex-1">
                  <input type="number" min="0" max="23" value={timerHours} onChange={(e) => setTimerHours(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center" />
                  <span className="block text-center text-xs text-slate-500 mt-1">時間</span>
                </div>
                <div className="flex-1">
                  <input type="number" min="0" max="59" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center" />
                  <span className="block text-center text-xs text-slate-500 mt-1">分</span>
                </div>
                <div className="flex-1">
                  <input type="number" min="0" max="59" value={timerSeconds} onChange={(e) => setTimerSeconds(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center" />
                  <span className="block text-center text-xs text-slate-500 mt-1">秒</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">※全て0の場合はタイマーなし。最大93日まで。「開始」ボタンでカウントがスタートします。</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">カスタムクイズコード (任意)</label>
              <input 
                type="text" value={customCode} onChange={(e) => setCustomCode(e.target.value)}
                placeholder="例：WEBTEST_2026"
                disabled={isEditMode}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none font-mono disabled:opacity-50"
              />
            </div>
          </div>

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
                  {mode === 'spot' && (
                     <div className="bg-pink-900/20 p-4 rounded-xl border border-pink-500/30 flex items-end gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-pink-400 mb-1">🎯 スポット専用問題コード (5文字)</label>
                          <input type="text" value={q.code} onChange={(e)=>updateQuestion(qIndex, 'code', e.target.value)} maxLength={5} placeholder="空の場合は自動生成" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"/>
                        </div>
                        <button type="button" onClick={()=>generateRandomCode(qIndex)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-bold text-slate-200 h-[38px] transition-colors">ランダム生成</button>
                     </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">問題文 <span className="text-red-400">*</span></label>
                    <textarea value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} placeholder="問題文を入力..." rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none resize-none"/>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">画像URL / メディア (任意)</label>
                      <input type="text" value={q.media_url} onChange={(e) => updateQuestion(qIndex, 'media_url', e.target.value)} placeholder="https://..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 outline-none text-sm"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">ヒントテキスト (任意)</label>
                      <input type="text" value={q.hint} onChange={(e) => updateQuestion(qIndex, 'hint', e.target.value)} placeholder="ヒントを見ると得点が半減します" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 outline-none text-sm"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <div>
                      <label className="block text-xs font-bold text-emerald-400 mb-2">配点</label>
                      <input type="number" value={q.points} onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white text-center font-bold" min="1"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-400 mb-2">誤答ペナルティ</label>
                      <input type="number" value={q.penalty_points} onChange={(e) => updateQuestion(qIndex, 'penalty_points', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white text-center font-bold" min="0"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">形式</label>
                      <select value={q.question_type} onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none text-white font-bold">
                        <option value="radio">4択問題</option>
                      </select>
                    </div>
                  </div>

                  {mode === 'gps' && (
                    <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30">
                      <p className="text-xs text-blue-400 font-bold mb-3">📍 位置情報設定（GPSモード）</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">緯度 (Latitude)</label>
                          <input type="text" value={q.lat} onChange={(e) => updateQuestion(qIndex, 'lat', e.target.value)} placeholder="35.6812" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"/>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">経度 (Longitude)</label>
                          <input type="text" value={q.lng} onChange={(e) => updateQuestion(qIndex, 'lng', e.target.value)} placeholder="139.7671" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"/>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">許容半径 (メートル)</label>
                          <input type="number" value={q.radius} onChange={(e) => updateQuestion(qIndex, 'radius', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-center"/>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-3 uppercase">選択肢と正解 <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all ${q.correct_index === oIndex ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-900 border-slate-700'}`}>
                          <input type="radio" name={`correct-${qIndex}`} checked={q.correct_index === oIndex} onChange={() => updateQuestion(qIndex, 'correct_index', oIndex)} className="w-5 h-5 text-purple-600 bg-slate-800 border-slate-600"/>
                          <input type="text" value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} placeholder={`選択肢 ${['A', 'B', 'C', 'D'][oIndex]}`} className="flex-1 bg-transparent outline-none font-bold"/>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">解説 (回答後に表示)</label>
                    <textarea value={q.explanation} onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)} placeholder="正解の理由や参考リンクなど..." rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none text-sm resize-none"/>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addQuestion} className="w-full border-2 border-dashed border-slate-600 bg-slate-800/50 text-slate-300 hover:text-white hover:border-purple-500 hover:bg-slate-800 py-6 rounded-3xl font-black text-lg transition-all shadow-inner">
            + 新しい問題を追加する
          </button>

          {error && <p className="text-red-400 text-center font-bold bg-red-900/20 py-4 rounded-xl">{error}</p>}

          <div className="sticky bottom-6 mt-10">
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-6 rounded-3xl font-black text-2xl shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all">
              💾 保存してクイズを{isEditMode ? '更新' : '作成'}する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuizCreator;
