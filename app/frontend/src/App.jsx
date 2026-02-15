import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from 'html5-qrcode'

function App() {
  // ユーザー入力用
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [idLength, setIdLength] = useState(7) // 学校オプション用
  
  // ステータス管理
  const [isRegistered, setIsRegistered] = useState(false)
  const [error, setError] = useState('')
  const [quizCode, setQuizCode] = useState(null)

  // QRスキャナーの初期化
  useEffect(() => {
    if (isRegistered && !quizCode) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        if (/^\d{3}$/.test(decodedText)) { // 3桁コードの判定
          setQuizCode(decodedText);
          scanner.clear();
        }
      }, (err) => { /* スキャン失敗時は何もしない */ });
      return () => scanner.clear();
    }
  }, [isRegistered, quizCode]);

  // 登録処理
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post('http://localhost:8080/api/user/register', {
        name: name,
        student_id: studentId
      });
      console.log('Registered:', res.data);
      setIsRegistered(true);
    } catch (err) {
      setError(err.response?.data || '登録に失敗しました。形式を確認してください。');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          PASHATOKU.COM
        </h1>
        <p className="text-slate-400 text-sm mt-2">Quiz Platform Template</p>
      </header>

      {!isRegistered ? (
        // --- 登録フォーム ---
        <form onSubmit={handleRegister} className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <h2 className="text-xl font-bold mb-6 text-center">参加者エントリー</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">ユーザー名 (16文字以内)</label>
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="漢字・かな・カナ・英数・・"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">学籍番号 (半角英数字 {idLength}文字)</label>
              <input 
                type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)}
                placeholder="ABC1234"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-4 text-center font-bold">{error}</p>}

          <button type="submit" className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-4 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all">
            クイズに参加する
          </button>
        </form>
      ) : (
        // --- QRスキャン画面 ---
        <div className="w-full max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl mb-6">
            <p className="text-emerald-400 font-bold">✓ エントリー完了: {name} さん</p>
          </div>
          
          {!quizCode ? (
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-slate-300">QRコードをスキャン</h3>
              <div id="reader" className="overflow-hidden rounded-xl bg-black"></div>
              <p className="mt-4 text-slate-500 text-xs">クイズの3桁コードをカメラに映してください</p>
            </div>
          ) : (
            <div className="bg-blue-600 p-10 rounded-3xl shadow-2xl animate-bounce">
              <h2 className="text-3xl font-black mb-2">Quiz Found!</h2>
              <p className="text-xl">Code: {quizCode}</p>
              <button className="mt-6 bg-white text-blue-600 px-8 py-2 rounded-full font-bold">開始する</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
