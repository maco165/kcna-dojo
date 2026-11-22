// 問題データの型。JSON の検査は scripts/check-content.mjs が持ち、ここと同じ欄を見る。

export type Domain =
  | 'Kubernetes Fundamentals'
  | 'Container Orchestration'
  | 'Cloud Native Application Delivery'
  | 'Cloud Native Architecture';

/** 空欄を 1 つ持つコードを埋める問題。空欄は code の中の `{{blank}}` (ちょうど 1 つ)。 */
export type FillQuestion = {
  id: string;
  type: 'fill';
  prompt: string;
  /** コードの種類。表示の見出しに使う */
  language: 'bash' | 'yaml' | 'dockerfile';
  code: string;
  /** 正解。どれか 1 つに一致すれば正解 (前後の空白は無視、大文字と小文字は区別) */
  answers: string[];
  /** 押して入れられる候補 */
  candidates?: string[];
  /** 正解のあとに見せる実行結果の例 */
  output?: string;
  explanation: string;
  /** 候補ごとの「なぜ違うか」 */
  wrongNotes?: Record<string, string>;
  source: string;
};

export type Choice = { id: string; text: string; why?: string };

/** 4 択。code があれば問題文の下に出す (出力を読んで答える問題など)。選択肢は出すたびに混ぜる (src/lib/shuffle.ts) */
export type ChoiceQuestion = {
  id: string;
  type: 'choice';
  prompt: string;
  code?: { language: string; text: string };
  choices: Choice[];
  answer: string;
  explanation: string;
  source: string;
  /** true なら選択肢を混ぜない (「上のどれでもない」など、位置に意味があるとき) */
  fixedOrder?: boolean;
};

export type Question = FillQuestion | ChoiceQuestion;

export type QuizLesson = {
  id: string;
  kind: 'quiz';
  title: string;
  summary: string;
  domain: Domain;
  questions: Question[];
};

/** expect は打ったあとに見えるはずのもの (コマンドのある手順には必ず付ける)。stuck はうまくいかないときに最初に見るところ */
export type LabStep = { text: string; command?: string; expect?: string; stuck?: string };

/** 家のクラスタで手を動かす実習。手順を全部確かめたら完了にする */
export type LabLesson = {
  id: string;
  kind: 'lab';
  title: string;
  summary: string;
  domain: Domain;
  /** この実習で分かること */
  goal: string;
  /** 用意するもの */
  needs: string[];
  steps: LabStep[];
  source: string;
};

export type Lesson = QuizLesson | LabLesson;

export type WeekContent = {
  week: number;
  lessons: Lesson[];
};

/**
 * 週の一覧・進み具合・題名に使う軽いレッスン (問題は id・形・問題文だけ)。最初に読む JS を軽くするため、
 * ホームと本体は週のファイルを ?light で読み (vite.config.ts の lightLessons)、問題の全文は lessons.ts から読む
 */
export type QuestionMeta = Pick<Question, 'id' | 'type' | 'prompt'>;
export type QuizLessonMeta = Omit<QuizLesson, 'questions'> & { questions: QuestionMeta[] };
export type LessonMeta = QuizLessonMeta | LabLesson;
export type WeekIndex = { week: number; lessons: LessonMeta[] };
