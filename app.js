// ===== 動き（JavaScript）はこのファイルが担当 =====
// ブラウザ内でユーザー操作に反応し、PHPサーバー(api.php)とデータをやり取りする。

const API = "api.php"; // 通信相手のサーバー側プログラム

// よく使うHTML要素を取得しておく
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const dueInput = document.getElementById("todo-due"); // 期限の入力欄
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

// --- 受け取った配列をもとに <li> を組み立てる ---
function render(todos) {
  list.innerHTML = ""; // いったん空にしてから作り直す

  // 空のときは表を隠してメッセージを出す
  const hasItems = todos.length > 0;
  emptyMessage.style.display = hasItems ? "none" : "block";
  table.style.display = hasItems ? "table" : "none";

  for (const todo of sortTodos(todos)) {
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

    // やること（テキスト）
    const tdText = document.createElement("td");
    tdText.className = "col-text text-cell";
    tdText.textContent = todo.text;

    // 期限（残り日数を添え、近い/超過で色を変える）
    const tdDue = document.createElement("td");
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
      due.textContent = "📅 " + todo.dueAt + " " + suffix;
      tdDue.append(due);
    }

    // 優先度（色付きバッジ）
    const tdPr = document.createElement("td");
    const prLabels = { high: "高", mid: "中", low: "低" };
    if (prLabels[todo.priority]) {
      const pr = document.createElement("span");
      pr.className = "priority " + todo.priority;
      pr.textContent = prLabels[todo.priority];
      tdPr.append(pr);
    }

    // 難度／区分（すぐ終わるならその表示、そうでなければ難度）
    const tdDf = document.createElement("td");
    if (todo.quick) {
      const qk = document.createElement("span");
      qk.className = "quick";
      qk.textContent = "⚡ すぐ終わる";
      tdDf.append(qk);
    } else {
      const dfLabels = { easy: "易", normal: "普通", hard: "難" };
      if (dfLabels[todo.difficulty]) {
        const df = document.createElement("span");
        df.className = "difficulty " + todo.difficulty;
        df.textContent = dfLabels[todo.difficulty];
        tdDf.append(df);
      }
    }

    // 所要時間（0より大きければ読みやすく表示）
    const tdEs = document.createElement("td");
    if (todo.estimateMin > 0) {
      const es = document.createElement("span");
      es.className = "estimate";
      es.textContent = "⏱ " + formatEstimate(todo.estimateMin);
      tdEs.append(es);
    }

    // 削除ボタン
    const tdDel = document.createElement("td");
    tdDel.className = "col-del";
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.addEventListener("click", () => deleteTodo(todo.id));
    tdDel.append(del);

    tr.append(tdCheck, tdText, tdDue, tdPr, tdDf, tdEs, tdDel);
    list.appendChild(tr);
  }
}

// --- 追加：フォーム送信時 ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();              // ページ再読み込みを止める
  const text = input.value.trim();
  if (!text) return;

  const dueAt = dueInput.value;        // 例 "2026-06-20"。未入力なら空文字
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
    body: JSON.stringify({ text, dueAt, priority, quick, difficulty, estimateMin }),
  });

  input.value = "";
  dueInput.value = "";                 // 期限欄もリセット
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

// --- 削除 ---
async function deleteTodo(id) {
  await fetch(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  loadTodos();
}

// 最初の表示
loadTodos();
