// ===== 動き（JavaScript）はこのファイルが担当 =====
// ブラウザ内でユーザー操作に反応し、PHPサーバー(api.php)とデータをやり取りする。

const API = "api.php"; // 通信相手のサーバー側プログラム

// よく使うHTML要素を取得しておく
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const dueInput = document.getElementById("todo-due"); // 入金期限の入力欄
const eventInput = document.getElementById("todo-event"); // 日時(予定)の入力欄
const costInput = document.getElementById("todo-cost"); // 費用(円)の入力欄
const priorityInput = document.getElementById("todo-priority"); // 優先度の選択欄
const difficultyInput = document.getElementById("todo-difficulty"); // 難度の選択欄
const estimateInput = document.getElementById("todo-estimate"); // 所要時間の数値
const estimateUnitInput = document.getElementById("todo-estimate-unit"); // 所要時間の単位(分/時間/日)
const quickInput = document.getElementById("todo-quick"); // 「すぐ終わる?」の選択欄（前提）
const detailFields = document.getElementById("detail-fields"); // 難度・所要時間のまとまり

// 「すぐ終わる?」が「はい」のときは、難度・所要時間の入力欄を隠す
function updateDetailVisibility() {
  const isQuick = quickInput.value === "yes";
  detailFields.style.display = isQuick ? "none" : "flex";
}
quickInput.addEventListener("change", updateDetailVisibility);
updateDetailVisibility(); // 最初の表示状態をそろえる

// 分数を「1日2時間30分」のような読みやすい文字列に変換する
function formatEstimate(min) {
  if (!min || min <= 0) return "";
  const days = Math.floor(min / 1440);   // 1日 = 1440分
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  let out = "";
  if (days > 0) out += days + "日";
  if (hours > 0) out += hours + "時間";
  if (mins > 0) out += mins + "分";
  return out;
}

// 金額を「¥1,500」のように桁区切りで表示する
function formatYen(cost) {
  if (!cost || cost <= 0) return "";
  return "¥" + Number(cost).toLocaleString("ja-JP");
}

// 日時 "2026-06-20T14:30" を "2026-06-20 14:30"（24時間表記）に整える
function formatEvent(eventAt) {
  if (!eventAt) return "";
  return eventAt.replace("T", " ");
}

// 期限まであと何日かを返す（今日=0、過去はマイナス。期限なしは null）
function daysUntil(dueAt) {
  if (!dueAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);            // 時刻を切り捨てて「日」で比較
  const due = new Date(dueAt + "T00:00:00");
  return Math.round((due - today) / 86400000); // 86400000ミリ秒 = 1日
}

// 一覧を「期限が近い順」に並べ替える（自動の優先順位づけ）
function sortTodos(todos) {
  const rank = { high: 0, mid: 1, low: 2 }; // 優先度の並び順
  return todos.slice().sort((a, b) => {
    // 完了したものは下へ
    if (a.done !== b.done) return a.done ? 1 : -1;
    // 期限が近い順。期限なしは一番うしろ（Infinity）
    const da = a.dueAt ? new Date(a.dueAt + "T00:00:00").getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt + "T00:00:00").getTime() : Infinity;
    if (da !== db) return da - db;
    // 期限が同じ（または両方なし）なら優先度が高い順
    return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
  });
}
const list = document.getElementById("todo-list");       // 表の本体(tbody)
const table = document.getElementById("todo-table");     // 表全体
const emptyMessage = document.getElementById("empty-message");

// --- サーバーから一覧を取得して画面に描画する ---
async function loadTodos() {
  const res = await fetch(API);            // GETリクエスト：一覧をください
  const todos = await res.json();          // PHPが返したJSONを配列に変換
  render(todos);
}

// --- 受け取った配列を木構造（根→節→葉）に組み立てて表示する ---
function render(todos) {
  list.innerHTML = ""; // いったん空にしてから作り直す

  // 空のときは表を隠してメッセージを出す
  const hasItems = todos.length > 0;
  emptyMessage.style.display = hasItems ? "none" : "block";
  table.style.display = hasItems ? "table" : "none";

  // 親IDごとに子をまとめる（parentId が無い古いデータは 0＝最上位扱い）
  const childrenMap = {};
  for (const todo of todos) {
    const pid = todo.parentId || 0;
    (childrenMap[pid] = childrenMap[pid] || []).push(todo);
  }

  // 親→子→孫… の順に、深さ(depth)を付けて行を並べる
  function renderLevel(parentId, depth) {
    const siblings = sortTodos(childrenMap[parentId] || []);
    for (const todo of siblings) {
      list.appendChild(buildRow(todo, depth));
      renderLevel(todo.id, depth + 1); // その子をすぐ下に続けて表示
    }
  }
  renderLevel(0, 0);
}

// --- 1件分の行(tr)を組み立てる。depth は階層の深さ（0＝根） ---
function buildRow(todo, depth) {
  const tr = document.createElement("tr");
  tr.className = "todo-item" + (todo.done ? " done" : "");

  // 完了（チェックボックス）
  const tdCheck = document.createElement("td");
  tdCheck.className = "col-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.addEventListener("change", () => toggleTodo(todo.id, checkbox.checked));
  tdCheck.append(checkbox);

  // やること（テキスト）。深さ分だけ字下げし、子には枝記号 └ を付ける
  const tdText = document.createElement("td");
  tdText.className = "col-text text-cell";
  tdText.style.paddingLeft = (8 + depth * 24) + "px";
  tdText.textContent = (depth > 0 ? "└ " : "") + todo.text;

  // 内容（入力されている項目だけをバッジで表示。未入力・既定値は出さない）
  const tdDetail = document.createElement("td");
  tdDetail.className = "detail-cell";

  // 入金期限（残り日数を添え、近い/超過で色を変える）
  if (todo.dueAt) {
    const due = document.createElement("span");
    due.className = "due";
    const d = daysUntil(todo.dueAt);
    let suffix = "";
    if (d > 0) {
      suffix = "（あと" + d + "日）";
      if (d <= 2) due.classList.add("soon"); // 2日以内はオレンジ
    } else if (d === 0) {
      suffix = "（今日まで）";
      due.classList.add("soon");
    } else {
      suffix = "（" + -d + "日超過）";
      due.classList.add("overdue"); // 期限切れは赤
    }
    due.textContent = "📅 入金期限 " + todo.dueAt + " " + suffix;
    tdDetail.append(due);
  }

  // 日時（イベント等の予定。24時間表記）
  if (todo.eventAt) {
    const ev = document.createElement("span");
    ev.className = "event";
    ev.textContent = "📆 " + formatEvent(todo.eventAt);
    tdDetail.append(ev);
  }

  // 費用（円。0より大きいときだけ）
  if (todo.cost > 0) {
    const cs = document.createElement("span");
    cs.className = "cost";
    cs.textContent = "💴 " + formatYen(todo.cost);
    tdDetail.append(cs);
  }

  // 優先度（既定の「中」は出さない＝高・低のときだけ表示）
  const prLabels = { high: "高", low: "低" };
  if (prLabels[todo.priority]) {
    const pr = document.createElement("span");
    pr.className = "priority " + todo.priority;
    pr.textContent = "優先度: " + prLabels[todo.priority];
    tdDetail.append(pr);
  }

  // 難度／区分（すぐ終わる→その表示。難度は既定の「普通」を出さず易・難のみ）
  if (todo.quick) {
    const qk = document.createElement("span");
    qk.className = "quick";
    qk.textContent = "⚡ すぐ終わる";
    tdDetail.append(qk);
  } else {
    const dfLabels = { easy: "易", hard: "難" };
    if (dfLabels[todo.difficulty]) {
      const df = document.createElement("span");
      df.className = "difficulty " + todo.difficulty;
      df.textContent = "難度: " + dfLabels[todo.difficulty];
      tdDetail.append(df);
    }
  }

  // 所要時間（0より大きければ読みやすく表示）
  if (todo.estimateMin > 0) {
    const es = document.createElement("span");
    es.className = "estimate";
    es.textContent = "⏱ " + formatEstimate(todo.estimateMin);
    tdDetail.append(es);
  }

  // 操作（＋子タスク / 編集 / 削除）
  const tdActions = document.createElement("td");
  tdActions.className = "col-actions";

  const addBtn = document.createElement("button");
  addBtn.className = "action add-child";
  addBtn.textContent = "＋子";
  addBtn.title = "子タスクを追加";
  addBtn.addEventListener("click", () => addChild(todo.id));

  const editBtn = document.createElement("button");
  editBtn.className = "action edit";
  editBtn.textContent = "編集";
  editBtn.title = "名前を編集";
  editBtn.addEventListener("click", () => editTodo(todo.id, todo.text));

  const del = document.createElement("button");
  del.className = "delete";
  del.textContent = "×";
  del.title = "削除（子タスクも一緒に消えます）";
  del.addEventListener("click", () => deleteTodo(todo.id));

  tdActions.append(addBtn, editBtn, del);

  tr.append(tdCheck, tdText, tdDetail, tdActions);
  return tr;
}

// Enterキーだけでは追加しない（誤入力防止）。追加は「追加」ボタンで確定する。
form.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
  }
});

// --- 追加：フォーム送信時（「追加」ボタンで確定） ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();              // ページ再読み込みを止める
  const text = input.value.trim();
  if (!text) return;

  const dueAt = dueInput.value;        // 入金期限 "2026-06-20"。未入力なら空文字
  const eventAt = eventInput.value;    // 日時(予定) "2026-06-20T14:30"。未入力なら空文字
  const cost = Math.max(0, Math.round(Number(costInput.value) || 0)); // 費用(円・整数)
  const priority = priorityInput.value;     // "high" / "mid" / "low"
  const quick = quickInput.value === "yes"; // 前提：すぐ終わるか否か

  // 「すぐ終わる」なら難度・所要時間は不要（空・0）。
  // 「いいえ」のときだけ難度と所要時間を取り込む。
  let difficulty = "";
  let estimateMin = 0;
  if (!quick) {
    difficulty = difficultyInput.value; // "easy" / "normal" / "hard"
    const unitToMin = { min: 1, hour: 60, day: 1440 };
    const amount = Number(estimateInput.value) || 0;
    estimateMin = Math.max(0, Math.round(amount * (unitToMin[estimateUnitInput.value] || 1)));
  }

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // フォームからの追加は最上位（根）タスク。parentId は 0
    body: JSON.stringify({ text, dueAt, eventAt, cost, priority, quick, difficulty, estimateMin, parentId: 0 }),
  });

  input.value = "";
  dueInput.value = "";                 // 入金期限もリセット
  eventInput.value = "";               // 日時もリセット
  costInput.value = "";                // 費用もリセット
  priorityInput.value = "mid";         // 優先度は「中」に戻す
  quickInput.value = "no";             // すぐ終わる? は「いいえ」に戻す
  difficultyInput.value = "normal";    // 難度は「普通」に戻す
  estimateInput.value = "";            // 所要時間もリセット
  estimateUnitInput.value = "min";     // 単位は「分」に戻す
  updateDetailVisibility();            // 詳細欄の表示も戻す
  loadTodos();                         // 追加後に一覧を更新
});

// --- 完了状態の切り替え ---
async function toggleTodo(id, done) {
  await fetch(API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, done }),
  });
  loadTodos();
}

// --- 名前(テキスト)の編集 ---
async function editTodo(id, currentText) {
  const text = prompt("タスク名を編集:", currentText);
  if (text === null) return;          // キャンセルされた
  const trimmed = text.trim();
  if (!trimmed) return;               // 空のままは無視
  await fetch(API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text: trimmed }),
  });
  loadTodos();
}

// --- 子タスク(節・葉)を追加 ---
async function addChild(parentId) {
  const text = prompt("子タスクの名前:");
  if (text === null) return;          // キャンセルされた
  const trimmed = text.trim();
  if (!trimmed) return;               // 空のままは無視
  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 子タスクは既定値で作成し、必要なら後から編集する。parentId に親のIDを指定
    body: JSON.stringify({ text: trimmed, parentId }),
  });
  loadTodos();
}

// --- 削除（子タスクも一緒に消えるので確認する） ---
async function deleteTodo(id) {
  if (!confirm("このタスクを削除します。子タスクがある場合は一緒に削除されます。よろしいですか？")) {
    return;
  }
  await fetch(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  loadTodos();
}

// 最初の表示
loadTodos();
