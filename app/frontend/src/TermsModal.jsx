import React from 'react';

function TermsModal({ isOpen, onClose, type }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-3xl w-full max-w-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 rounded-t-3xl backdrop-blur-md">
          <h2 className="text-xl font-black text-white">
            {type === 'pashatoku' ? 'パシャトク 利用規約' : '主催者 利用規約'}
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-300 leading-relaxed space-y-6">
          {type === 'pashatoku' ? (
            // パシャトク側の利用規約（しっかりと作り込んだ版）
            <>
              <section>
                <h3 className="text-emerald-400 font-bold mb-2">第1条（適用）</h3>
                <p>本利用規約（以下「本規約」）は、PASHATOKU.COM（以下「本サービス」）が提供するクイズプラットフォームの利用条件を定めるものです。利用者は、本規約に同意した上で本サービスを利用するものとします。</p>
              </section>

              <section>
                <h3 className="text-emerald-400 font-bold mb-2">第2条（ユーザー情報の取り扱いとCookieの利用）</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>本サービスでは、利用者の利便性向上およびセッション管理を目的として、Cookie（クッキー）を利用してユーザーの登録情報（氏名・学籍番号・同意状況など）を保存します。</li>
                  <li>保存されたCookie情報は、本サービスの利用に必要な範囲内でのみ使用し、第三者に提供・販売することは一切ありません。</li>
                  <li>利用者はブラウザの設定によりCookieを無効にできますが、その場合、本サービスの一部機能が正常に動作しない場合があります。</li>
                </ol>
              </section>

              <section>
                <h3 className="text-emerald-400 font-bold mb-2">第3条（免責事項）</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>本サービスは、システムに登録されるクイズの内容、正確性、合法性、および主催者が提供する情報に関して一切の責任を負いません。クイズの内容に起因するトラブルについては、利用者と主催者間で解決するものとします。</li>
                  <li>システムのメンテナンス、障害、通信回線の不具合等により本サービスが停止した場合において、利用者に生じたいかなる損害についても、当プラットフォームは責任を負いません。</li>
                </ol>
              </section>

              <section>
                <h3 className="text-emerald-400 font-bold mb-2">第4条（禁止事項）</h3>
                <p>利用者は、以下の行為をしてはなりません。</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>法令または公序良俗に違反する行為</li>
                  <li>本サービスのシステムに過度な負荷をかける、または不正にアクセスする行為</li>
                  <li>他の利用者の情報を不正に収集・利用する行為</li>
                </ul>
              </section>

              <section>
                <h3 className="text-emerald-400 font-bold mb-2">第5条（規約の変更）</h3>
                <p>当プラットフォームは、必要と判断した場合には、利用者に通知することなくいつでも本規約を変更することができるものとします。変更後の規約は、本サービス上に掲示された時点から効力を生じるものとします。</p>
              </section>
            </>
          ) : (
            // 主催者側の利用規約（カスタマイズ用テンプレート）
            <>
              <p className="mb-4 text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-700">
                以下の規約はテンプレートです。必要に応じて主催者が内容を書き換えてご使用ください。
              </p>

              <section>
                <h3 className="text-blue-400 font-bold mb-2">イベント・クイズ参加に関する規約（例）</h3>
                <p>本クイズイベント（以下「本イベント」）に参加される皆様は、以下の事項に同意したものとみなします。</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>本イベントで取得した成績データは、社内・学内の成績評価および分析の目的で使用される場合があります。</li>
                  <li>本イベントで出題される問題のスクリーンショット、録画、およびSNSへの無断転載を固く禁じます。</li>
                  <li>その他、イベントの進行を妨げる行為があった場合、主催者の判断により参加資格を取り消す場合があります。</li>
                </ul>
              </section>

              {/* 
              // --- 独自の規約を追加する場合は以下をコメントアウト解除して編集 ---
              <section className="mt-6">
                <h3 className="text-blue-400 font-bold mb-2">第X条（個人情報の取り扱い）</h3>
                <p>主催者は、参加者から取得した情報（氏名等）を以下の目的でのみ利用します...</p>
              </section>
              */}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/80 rounded-b-3xl text-center backdrop-blur-md">
          <button 
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-10 rounded-xl transition-colors shadow-lg active:scale-95"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermsModal;
