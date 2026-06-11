import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from 'html5-qrcode'
import Cookies from 'js-cookie'
import TermsModal from './TermsModal'

// GPS距離計算 (Haversine formula)
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球の半径 (m)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function App() {
  const [tosAgreed, setTosAgreed] = useState(false)
  const [hostTosAgreed, setHostTosAgreed] = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [userId, setUserId] = useState(null)
  
  const [isRegistered, setIsRegistered] = useState(false)
    const [viewMode, setViewMode] = useState('quiz'); // 'quiz' or 'history'
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [error, setError] = useState('')
  const [quizCode, setQuizCode] = useState(null)
  
  const [quizData, setQuizData] = useState(null)
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  
  // 回答状態管理
  const [selectedOption, setSelectedOption] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [awardedPoints, setAwardedPoints] = useState(0)
  
  // ロックとヒントとGPS
  const [isLocked, setIsLocked] = useState(false)
  const [lockMessage, setLockMessage] = useState('')
  const [hintUsed, setHintUsed] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [gpsVerified, setGpsVerified] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null);
  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [isGlobalEnded, setIsGlobalEnded] = useState(false);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(null);

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await axios.get(`http://${window.location.hostname}:8080/api/global_timer`);
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
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl) setQuizCode(codeFromUrl);
  }, []);

  useEffect(() => {
    const savedName = Cookies.get('pashatoku_name');
    const savedId = Cookies.get('pashatoku_studentid');
    const savedUserId = Cookies.get('pashatoku_user_id');
    const savedTos = Cookies.get('pashatoku_tos_agreed');
    
    if (savedName && savedId && savedUserId && savedTos === 'true') {
      setName(savedName);
      setStudentId(savedId);
      setUserId(parseInt(savedUserId));
      setTosAgreed(true);
      setHostTosAgreed(true);
      setIsRegistered(true);
      fetchAnsweredQuestions(parseInt(savedUserId));
    }
  }, []);

  const fetchAnsweredQuestions = async (uid) => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/user/${uid}/answered`);
      setAnsweredQuestionIds(res.data || []);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/user/${userId}/history`);
      setHistoryData(res.data || []);
    } catch (e) {}
  };


  useEffect(() => {
    if (isRegistered && !quizCode && !quizData) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        let code = decodedText;
        try {
          const url = new URL(decodedText);
          const params = new URLSearchParams(url.search);
          if (params.has('code')) code = params.get('code');
        } catch (e) {}
        
        if (code) {
          setQuizCode(code);
          scanner.clear();
        }
      }, (err) => {});
      return () => scanner.clear();
    }
  }, [isRegistered, quizCode, quizData]);

  // External Scan Polling
  useEffect(() => {
    let interval;
    if (isRegistered && !quizCode && !quizData) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`http://${window.location.hostname}:8080/api/user/${userId}/external_scan`);
          if (res.data && res.data.code) {
            let code = res.data.code;
            try {
              const url = new URL(code);
              const params = new URLSearchParams(url.search);
              if (params.has('code')) code = params.get('code');
            } catch(e) {}
            setQuizCode(code);
          }
        } catch (e) {}
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [isRegistered, quizCode, quizData, userId]);

  // ポーリング処理 (ステータス同期)
  useEffect(() => {
    let interval;
    if (quizCode && quizData && !isFinished) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`http://${window.location.hostname}:8080/api/quizzes/status?code=${quizCode}`);
          const { play_status, visibility } = res.data;
          
          if (visibility === 'closed') {
            setError('このクイズイベントは閉鎖されました。');
            setQuizData(null);
            setQuizCode(null);
            return;
          }

          if (quizData.play_status !== play_status) {
            if (play_status === 'started' && quizData.play_status === 'waiting') {
              // 管理者が「開始」にした場合、問題を再取得する
              startQuiz();
            } else {
              setQuizData(prev => ({...prev, play_status}));
            }
          }
        } catch (err) {
          // ネットワークエラー等は無視して次回に再試行
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [quizCode, quizData, isFinished]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!tosAgreed || !hostTosAgreed) {
      setError('すべての規約に同意する必要があります。');
      return;
    }
    try {
      const res = await axios.post(`http://${window.location.hostname}:8080/api/user/register`, {
        name, student_id: studentId
      });
      Cookies.set('pashatoku_name', name, { expires: 30 });
      Cookies.set('pashatoku_studentid', studentId, { expires: 30 });
      Cookies.set('pashatoku_user_id', res.data.id.toString(), { expires: 30 });
      Cookies.set('pashatoku_tos_agreed', 'true', { expires: 30 });
      
      setUserId(res.data.id);
      setIsRegistered(true);
      fetchAnsweredQuestions(res.data.id);
    } catch (err) {
      setError(err.response?.data || '登録に失敗しました。');
    }
  };

  const handleResetRegistration = () => {
    Cookies.remove('pashatoku_name');
    Cookies.remove('pashatoku_studentid');
    Cookies.remove('pashatoku_user_id');
    Cookies.remove('pashatoku_tos_agreed');
    setIsRegistered(false);
    setQuizCode(null);
    setQuizData(null);
  };

  const verifyGps = (targetLat, targetLng, radius) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('このブラウザはGPSをサポートしていません。');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistanceFromLatLonInM(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
          if (dist <= radius) {
            resolve(true);
          } else {
            reject(`指定エリアから離れすぎています (距離: 約${Math.round(dist)}m)`);
          }
        },
        (err) => reject('位置情報の取得に失敗しました。GPS設定をオンにしてください。'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const startQuiz = async () => {
    setIsLoadingQuiz(true);
    setError('');
    try {
      const res = await axios.get(`http://${window.location.hostname}:8080/api/quizzes?code=${quizCode}`);
      setQuizData(res.data);
      setCurrentQIndex(0);
      setGpsVerified(false);
    } catch (err) {
      if (err.response && err.response.status === 403) {
          setError('このイベントは現在閉鎖されているか、アクセスできません。');
      } else {
          setError('クイズが見つかりません。');
      }
      setQuizCode(null);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  useEffect(() => {
    if (!quizData || quizData.play_status !== 'started' || !quizData.questions || quizData.questions.length === 0) return;
    const q = quizData.questions[currentQIndex];
    if (quizData.mode === 'gps' && q.lat && q.lng && !gpsVerified) {
      setGpsError('現在地を検証しています...');
      verifyGps(q.lat, q.lng, q.radius || 50)
        .then(() => {
          setGpsVerified(true);
          setGpsError('');
        })
        .catch(err => {
          setGpsError(err);
        });
    } else {
      setGpsVerified(true);
    }
  }, [quizData, currentQIndex, gpsVerified]);

  const handleOptionSelect = async (index) => {
    if (showAnswer || isLocked) return;
    
    try {
      const payload = {
        user_id: userId,
        question_id: quizData.questions[currentQIndex].id,
        selected_index: index,
        answer_text: "",
        used_hint: hintUsed
      };
      
      const res = await axios.post(`http://${window.location.hostname}:8080/api/quizzes/answer`, payload);
      
      if (res.data.is_locked) {
        setIsLocked(true);
        setLockMessage(res.data.message);
        return;
      }

      setSelectedOption(index);
      setIsCorrect(res.data.is_correct);
      setAwardedPoints(res.data.points_awarded);
      setExplanation(res.data.explanation);
      setScore(prev => prev + res.data.points_awarded);
      setShowAnswer(true);
      setAnsweredQuestionIds(prev => [...prev, quizData.questions[currentQIndex].id]);
    } catch (err) {
      if (err.response && err.response.status === 409) {
          setError('この問題は既に回答済みです。');
      } else {
          setError('通信エラーが発生しました。');
      }
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setSelectedOption(null);
      setShowAnswer(false);
      setHintUsed(false);
      setExplanation('');
      setIsLocked(false);
      setLockMessage('');
      setGpsVerified(false);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6 font-sans relative">
      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />
      {globalTimeLeft !== null && !isGlobalEnded && (
        <div className="fixed top-0 left-0 w-full bg-red-900/90 backdrop-blur-md text-red-100 text-center py-2 font-black z-50 shadow-[0_4px_20px_rgba(220,38,38,0.4)] flex justify-center items-center gap-3 border-b border-red-500/50">
          <span>🌍 サービス全体終了まで</span>
          <span className="text-xl tracking-widest font-mono">
            {Math.floor(globalTimeLeft / 86400) > 0 ? `${Math.floor(globalTimeLeft / 86400)}日 ` : ''}
            {Math.floor((globalTimeLeft % 86400) / 3600).toString().padStart(2, '0')}:{(Math.floor((globalTimeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(globalTimeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      {quizData && quizData.timer_end_at && quizData.play_status === 'started' && timeLeft !== null && (
        <div className={`fixed left-0 w-full bg-red-600/90 backdrop-blur-md text-white text-center py-2 font-black shadow-lg flex justify-center items-center gap-3 ${globalTimeLeft !== null && !isGlobalEnded ? 'top-10 z-40' : 'top-0 z-50'}`}>
          <span>⏳ イベント終了まで</span>
          <span className="text-xl tracking-widest">{Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:{(Math.floor((timeLeft % 3600) / 60)).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      )}

      <header className={`mb-10 text-center relative w-full max-w-md ${(timeLeft !== null && globalTimeLeft !== null && !isGlobalEnded) ? 'mt-24' : (timeLeft !== null || (globalTimeLeft !== null && !isGlobalEnded) ? 'mt-14' : 'mt-4')}`}>
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
      </header>

      {isGlobalEnded ? (
         <div className="w-full max-w-md text-center animate-in zoom-in duration-500 mt-10">
           <div className="bg-red-900/40 p-10 rounded-3xl shadow-2xl border border-red-500/50">
             <div className="text-6xl mb-6 inline-block">🛑</div>
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
      ) : !isRegistered ? (
        // --- 登録フォーム ---
        <form onSubmit={handleRegister} className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <h2 className="text-xl font-bold mb-6 text-center">参加者エントリー</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ユーザー名</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">学籍番号</label>
              <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
            </div>
            
            <div className="mt-6 bg-slate-900 p-4 rounded-xl border border-slate-700 text-sm">
              <p className="text-slate-400 mb-4 text-xs">以下の規約に同意していただく必要があります。</p>
              <div className="flex items-start space-x-3 mb-3">
                <input type="checkbox" checked={tosAgreed} onChange={(e) => setTosAgreed(e.target.checked)} className="mt-1 w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded"/>
                <span className="text-slate-300">
                  <button type="button" onClick={() => setActiveModal('pashatoku')} className="text-blue-400 underline font-bold">パシャトク利用規約</button> に同意する
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <input type="checkbox" checked={hostTosAgreed} onChange={(e) => setHostTosAgreed(e.target.checked)} className="mt-1 w-5 h-5 text-emerald-600 bg-slate-800 border-slate-600 rounded"/>
                <span className="text-slate-300">
                  <button type="button" onClick={() => setActiveModal('host')} className="text-emerald-400 underline font-bold">主催者の提示する利用規約</button> に同意する
                </span>
              </div>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-4 text-center font-bold">{error}</p>}
          <button type="submit" className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 py-4 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all">
            同意して参加する
          </button>
          <div className="mt-6 text-center">
             <a href="/admin/create" className="text-slate-500 text-xs hover:text-white underline">管理者: クイズを管理・作成する</a>
          </div>
        </form>
      ) : !quizData ? (
        // --- QRスキャン / 待機 ---
        <div className="w-full max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl mb-6 relative">
            <p className="text-emerald-400 font-bold">✓ エントリー完了: {name} さん</p>
            <button onClick={handleResetRegistration} className="text-xs text-slate-500 underline hover:text-white mt-2 block mx-auto">
              登録情報をリセットしてやり直す
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mb-4 font-bold bg-red-900/20 py-2 rounded-xl">{error}</p>}

          {!quizCode ? (
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-slate-300">問題のQRコードをスキャン</h3>
              <div id="reader" className="overflow-hidden rounded-xl bg-black"></div>
              <div className="mt-6">
                <p className="text-slate-400 text-sm mb-2">またはクイズコードを入力</p>
                <input 
                  type="text" placeholder="クイズコード"
                  className="w-full text-center bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 font-bold text-white outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) setQuizCode(e.target.value); }}
                  onBlur={(e) => { if (e.target.value) setQuizCode(e.target.value); }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-blue-600 p-10 rounded-3xl shadow-2xl animate-in zoom-in">
              <h2 className="text-3xl font-black mb-2">Quiz Found!</h2>
              <p className="text-xl font-mono mb-6 bg-black/20 py-2 rounded-xl">Code: {quizCode}</p>
              <button onClick={startQuiz} disabled={isLoadingQuiz} className="w-full bg-white text-blue-600 px-10 py-4 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">
                {isLoadingQuiz ? '読込中...' : '開始する'}
              </button>
              <button onClick={() => setQuizCode(null)} className="block mx-auto mt-6 text-blue-200 text-sm hover:text-white">キャンセル</button>
            </div>
          )}
        </div>
      ) : isFinished ? (
        // --- 結果画面 ---
        <div className="w-full max-w-md text-center animate-in zoom-in duration-500">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-10 rounded-3xl shadow-2xl border border-white/10">
            <h2 className="text-3xl font-black mb-2 text-white">Quiz Finished!</h2>
            <p className="text-indigo-200 mb-8 font-bold">{quizData.title}</p>
            <div className="bg-black/20 rounded-3xl p-8 mb-8 backdrop-blur-md shadow-inner border border-white/5">
              <p className="text-lg font-bold mb-2 text-indigo-100">Total Score</p>
              <p className="text-7xl font-black tracking-tighter text-white">
                {score}<span className="text-2xl text-indigo-300 ml-1">pt</span>
              </p>
            </div>
            <button onClick={() => window.location.reload()} className="w-full bg-white text-indigo-600 px-8 py-4 rounded-xl font-black shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all">
              トップへ戻る
            </button>
          </div>
        </div>
      ) : quizData.play_status === 'waiting' ? (
        // --- 待機画面 ---
        <div className="w-full max-w-md text-center animate-in zoom-in duration-500">
           <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700">
             <div className="animate-spin text-5xl mb-6 inline-block">⏳</div>
             <h2 className="text-2xl font-black mb-4 text-emerald-400">待機中</h2>
             <p className="text-slate-300 font-bold mb-2">{quizData.title}</p>
             <p className="text-slate-500 text-sm">管理者が開始するまで、この画面のままお待ちください。</p>
           </div>
         </div>
      ) : quizData.play_status === 'ended' ? (
        // --- 終了画面 ---
        <div className="w-full max-w-md text-center animate-in zoom-in duration-500">
           <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700">
             <div className="text-5xl mb-6 inline-block">🏁</div>
             <h2 className="text-2xl font-black mb-4 text-slate-300">イベント終了</h2>
             <p className="text-slate-400 font-bold mb-6">このイベントは終了しました。</p>
             <button onClick={() => window.location.reload()} className="w-full bg-slate-700 text-white px-8 py-4 rounded-xl font-black hover:bg-slate-600 transition-all">トップへ戻る</button>
           </div>
         </div>
      ) : (
        // --- クイズプレイ画面 ---
        <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-500">
          <div className="mb-4 flex justify-between items-center text-slate-400 font-bold text-sm">
            <span className="truncate pr-4 text-blue-400">{quizData.title}</span>
            <span className="whitespace-nowrap bg-slate-800 px-3 py-1 rounded-lg">Q. {currentQIndex + 1} / {quizData.questions.length}</span>
          </div>

          {!gpsVerified ? (
             <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 text-center">
                <div className="animate-pulse text-4xl mb-4">📍</div>
                <h3 className="text-xl font-bold text-white mb-2">GPSチェック中</h3>
                <p className="text-slate-400 mb-6">{gpsError}</p>
                {gpsError && gpsError.includes('失敗') === false && (
                   <button onClick={() => { setGpsVerified(false); setGpsError('再検証中...'); verifyGps(quizData.questions[currentQIndex].lat, quizData.questions[currentQIndex].lng, quizData.questions[currentQIndex].radius || 50).then(()=>setGpsVerified(true)).catch(e=>setGpsError(e)) }} className="bg-blue-600 px-6 py-2 rounded-xl font-bold text-white">再試行</button>
                )}
             </div>
          ) : quizData.questions[currentQIndex] && answeredQuestionIds.some(id => String(id) === String(quizData.questions[currentQIndex].id)) && !showAnswer ? (
             <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700 text-center animate-in zoom-in">
                <div className="text-5xl mb-6 inline-block">🔒</div>
                <h2 className="text-2xl font-black mb-4 text-emerald-400">回答済みです</h2>
                <p className="text-slate-400 font-bold mb-6">この問題はすでに回答しています。</p>
                <button onClick={() => { setQuizData(null); setQuizCode(null); }} className="w-full bg-slate-700 text-white px-8 py-4 rounded-xl font-black hover:bg-slate-600 transition-all shadow-lg border border-slate-600">スキャン画面に戻る</button>
             </div>
          ) : (
            <>
              {/* 問題文パネル */}
              <div className="bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-6 relative overflow-hidden">
                {quizData.style === 'fastest' && (
                   <div className="absolute top-0 left-0 w-full bg-red-600/90 text-white text-[10px] font-black text-center py-1 tracking-widest uppercase shadow-md">
                      ⚠️ 早押しバトル！最初に正解した人のみ得点！
                   </div>
                )}

                <div className={`mt-4 flex justify-between items-start mb-4 ${quizData.style === 'fastest' ? 'mt-6' : ''}`}>
                   <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30">
                     配点: {quizData.questions[currentQIndex].points} pt
                   </span>
                   {quizData.questions[currentQIndex].penalty_points > 0 && (
                     <span className="bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-lg border border-red-500/30">
                       誤答: -{quizData.questions[currentQIndex].penalty_points} pt
                     </span>
                   )}
                </div>

                <h2 className="text-xl font-bold leading-relaxed mb-4">
                  {quizData.questions[currentQIndex].text}
                </h2>

                {quizData.questions[currentQIndex].media_url && (
                  <img src={quizData.questions[currentQIndex].media_url} alt="Question Media" className="w-full h-auto rounded-xl mb-4 border border-slate-700 shadow-md" />
                )}

                {/* ヒント機能 */}
                {quizData.questions[currentQIndex].hint && !showAnswer && !isLocked && (
                  <div className="mt-4">
                    {!hintUsed ? (
                      <button onClick={() => setHintUsed(true)} className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold py-2 rounded-xl transition-colors border border-slate-600 border-dashed">
                        💡 ヒントを見る (得点が半減します)
                      </button>
                    ) : (
                      <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-xl text-yellow-200 text-sm font-bold animate-in fade-in">
                        💡 ヒント: {quizData.questions[currentQIndex].hint}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ロック状態 */}
              {isLocked ? (
                 <div className="bg-red-900/40 border border-red-500/50 p-8 rounded-3xl text-center shadow-xl animate-in zoom-in">
                    <div className="text-5xl mb-4">🔒</div>
                    <h3 className="text-2xl font-black text-red-400 mb-2">LOCKED</h3>
                    <p className="text-red-200 font-bold">{lockMessage}</p>
                    <button onClick={nextQuestion} className="mt-8 bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-500">次の問題へ進む</button>
                 </div>
              ) : (
                 // 選択肢
                <div className="space-y-4">
                  {quizData.questions[currentQIndex].options.map((opt, i) => {
                    const isSelected = i === selectedOption;
                    let btnClass = "w-full text-left p-5 rounded-2xl font-bold border-2 transition-all flex items-center ";
                    
                    if (!showAnswer) {
                      btnClass += "bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-750 active:scale-95";
                    } else {
                      if (isSelected) {
                        btnClass += isCorrect 
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                          : "bg-red-500/20 border-red-500 text-red-400";
                      } else {
                        btnClass += "bg-slate-800 border-slate-800 opacity-50";
                      }
                    }

                    return (
                      <button key={i} disabled={showAnswer} onClick={() => handleOptionSelect(i)} className={btnClass}>
                        <span className={`inline-block w-8 h-8 flex-shrink-0 text-center leading-8 bg-slate-900 rounded-full mr-4 text-sm font-black border ${isSelected ? (isCorrect ? 'border-emerald-500' : 'border-red-500') : 'border-slate-700'}`}>
                          {['A', 'B', 'C', 'D'][i]}
                        </span>
                        <span>{opt}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 回答結果と解説 */}
              {showAnswer && !isLocked && (
                <div className="mt-6 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl animate-in slide-in-from-bottom-4">
                  <div className="text-center mb-4">
                    <p className={`text-2xl font-black ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isCorrect ? '🎉 正解！' : '❌ 不正解...'}
                    </p>
                    <p className="text-slate-300 font-bold mt-1">
                      獲得ポイント: <span className={awardedPoints > 0 ? 'text-emerald-400' : 'text-red-400'}>{awardedPoints > 0 ? `+${awardedPoints}` : awardedPoints} pt</span>
                    </p>
                  </div>
                  
                  {explanation && (
                    <div className="bg-slate-900 p-4 rounded-xl text-sm text-slate-300 mb-6 border border-slate-700">
                      <p className="font-bold text-blue-400 mb-1">📝 解説</p>
                      <p className="leading-relaxed">{explanation}</p>
                    </div>
                  )}

                  <button onClick={nextQuestion} className="w-full bg-blue-600 text-white px-8 py-4 rounded-xl font-black shadow-lg hover:bg-blue-500 transition-all">
                    {currentQIndex < quizData.questions.length - 1 ? '次の問題へ' : '結果を見る'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
