export const validateUser = (name, studentId, idLength = 7) => {
  // 名前: 16文字以内、特定の記号(・)OK、絵文字・半角カナ・その他記号NG
  const nameRegex = /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF・]{1,16}$/;
  
  // 学籍番号: 半角英数字のみ
  const idRegex = new RegExp(`^[a-zA-Z0-9]{${idLength}}$`);

  if (!nameRegex.test(name)) return "名前の形式が正しくありません（絵文字・記号不可）";
  if (!idRegex.test(studentId)) return `学籍番号は${idLength}文字の半角英数字で入力してください`;
  
  return null; // エラーなし
};
