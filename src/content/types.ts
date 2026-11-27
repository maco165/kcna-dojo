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

/** 実践の章の手順を分ける OS */
export type HandsOnOs = 'windows' | 'mac' | 'linux';

/** つまずいた時の 1 件: 症状 (見えるエラー)・確かめ方・直し方 */
export type HandsOnTrouble = { symptom: string; check: string; fix: string };

/**
 * 実践の章の 1 手順。code があるときは、lines (コードの全部の行の意味)・output (実機の出力)・read (出力の読み方)・trouble (1 件以上)・source が必須。
 * unverified (実機で確かめていないことの表示) があるときだけ、output を省ける
 */
export type HandsOnStep = {
  /** 章の中で重ならない id。手順の印はこの id で残すので、公開したあとは変えない */
  id: string;
  text: string;
  /** なぜこの手順をするのか */
  why: string;
  /** この OS の人だけの手順 (無ければ全員) */
  os?: HandsOnOs;
  /** どの端末で打つか。host は自分の PC、vm は仮想マシンの中 */
  where?: 'host' | 'vm';
  /** title はファイルの名前 (保存するファイルの中身のとき) */
  code?: { language: 'bash' | 'powershell' | 'yaml' | 'text'; text: string; title?: string };
  /** コードの 1 行と、その意味 (空の行と # で始まる行を除く全部の行を、並びのとおりに持つ) */
  lines?: { code: string; text: string }[];
  output?: string;
  read?: string;
  trouble?: HandsOnTrouble[];
  source?: string;
  unverified?: string;
};

/** 答えは折りたたんで出す。verify は、できたことの確かめ方 */
export type HandsOnChallenge = { task: string; hint: string; answer: string; verify: string };

/** 実践の章 (src/content/hands-on/*.json。章ごとに 1 ファイル)。検査は scripts/check-content.mjs */
export type HandsOnChapter = {
  id: string;
  /** 章の番号 (並びの順。0 から) */
  order: number;
  title: string;
  /** ページの題名に使う短い名前。title が 35 字を超えるときだけ持つ */
  short?: string;
  summary: string;
  goal: string;
  /** この章で分かる特徴 */
  features: string[];
  /** かかる時間の目安 (分) */
  minutes: number;
  needs: string[];
  /** 先に読むハンドブックのトピック (id と短い呼び名) */
  reads: { topic: string; label: string }[];
  steps: HandsOnStep[];
  /** 後片付け。完了の条件には入れない */
  cleanup: HandsOnStep[];
  challenges: HandsOnChallenge[];
  sources: { label: string; url: string }[];
};

/** 一覧と題名に使う軽い章 (vite.config.ts の ?meta。手順は id と OS だけ) */
export type HandsOnMeta = Pick<HandsOnChapter, 'id' | 'order' | 'title' | 'short' | 'summary' | 'minutes'> & { /** その章が入れる k3s の版 (入れないなら無し、版を決めずに入れるなら null) */ k3s?: string | null; steps: Pick<HandsOnStep, 'id' | 'os'>[] };
