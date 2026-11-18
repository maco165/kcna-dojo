// 答えたあとに出す「出てきたコマンド」の部品とデータを、問題を開いたときに先に読む。
// 答えてから読むと、説明が後から差し込まれて「次へ」が下へずれるため。最初に読む JS には入らない (読むのは問題の画面を出してから)
export const preloadNotes = () => {
  void import('../components/CommandNotes');
};
