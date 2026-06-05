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
    }
  }, []);

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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!tosAgreed || !hostTosAgreed) {
      setError('すべての規約に同意する必要があります。');
      return;
    }
    try {
      const res = await axios.post('http://localhost:8080/api/user/register', {
        name, student_id: studentId
      });
      Cookies.set('pashatoku_name', name, { expires: 30 });
      Cookies.set('pashatoku_studentid', studentId, { expires: 30 });
      Cookies.set('pashatoku_user_id', res.data.id.toString(), { expires: 30 });
      Cookies.set('pashatoku_tos_agreed', 'true', { expires: 30 });
      
      setUserId(res.data.id);
      setIsRegistered(true);
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
      const res = await axios.get(`http://localhost:8080/api/quizzes?code=${quizCode}`);
      setQuizData(res.data);
      setCurrentQIndex(0);
      setGpsVerified(false); // 次の問題の描画時にGPSチェックを走らせる
    } catch (err) {
      setError('クイズが見つかりません。');
      setQuizCode(null);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // 質問が変わるたびにGPSチェックが必要なら走らせる
  useEffect(() => {
    if (!quizData) return;
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
      
      const res = await axios.post('http://localhost:8080/api/quizzes/answer', payload);
      
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

    } catch (err) {
      setError('通信エラーが発生しました。');
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

      <header className="mb-10 text-center relative w-full max-w-md mt-4">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          PASHATOKU.COM
        </h1>
        <p className="text-slate-400 text-sm mt-2">Interactive Quiz System</p>
      </header>

      {!isRegistered ? (
        // --- 登録フォーム (省略せずにそのまま実装) ---
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
             <a href="/create" className="text-slate-500 text-xs hover:text-white underline">管理者: クイズを管理・作成する</a>
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
            <div className="bg-blue-600 p-10 rounded-3xl shadow-2xl animate-bounce">
              <h2 className="text-3xl font-black mb-2">Quiz Found!</h2>
              <p className="text-xl font-mono mb-6 bg-black/20 py-2 rounded-xl">Code: {quizCode}</p>
              <button onClick={startQuiz} disabled={isLoadingQuiz} className="w-full bg-white text-blue-600 px-10 py-4 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">
                {isLoadingQuiz ? '読込中...' : '開始する'}
              </button>
              <button onClick={() => setQuizCode(null)} className="block mx-auto mt-6 text-blue-200 text-sm hover:text-white">キャンセル</button>
            </div>
          )}
        </div>
      ) : !isFinished ? (
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
      ) : (
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
      )}
    </div>
  )
}

export default App
