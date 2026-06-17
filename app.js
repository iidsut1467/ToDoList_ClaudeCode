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
const list = document.getElementById("todo-list");
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

  // 空かどうかでメッセージの表示を切り替え
  emptyMessage.style.display = todos.length === 0 ? "block" : "none";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    // チェックボックス（完了の切り替え）
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id, checkbox.checked));

    // テキスト
    const span = document.createElement("span");
    span.textContent = todo.text;

    // 削除ボタン
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, span);

    // 「すぐ終わる」タスク（前提の選択。trueのときバッジ表示）
    if (todo.quick) {
      const qk = document.createElement("span");
      qk.className = "quick";
      qk.textContent = "⚡ すぐ終わる";
      li.append(qk);
    }

    // 期限（設定されていれば表示。古いデータには無いので安全に取り出す）
    if (todo.dueAt) {
      const due = document.createElement("span");
      due.className = "due";
      due.textContent = "📅 " + todo.dueAt;
      li.append(due);
    }

    // 優先度（設定されていれば色付きバッジで表示）
    if (todo.priority) {
      const labels = { high: "優先度: 高", mid: "優先度: 中", low: "優先度: 低" };
      if (labels[todo.priority]) {
        const pr = document.createElement("span");
        pr.className = "priority " + todo.priority;
        pr.textContent = labels[todo.priority];
        li.append(pr);
      }
    }

    // 難度（設定されていればバッジで表示）
    if (todo.difficulty) {
      const labels = { easy: "難度: 易", normal: "難度: 普通", hard: "難度: 難" };
      if (labels[todo.difficulty]) {
        const df = document.createElement("span");
        df.className = "difficulty " + todo.difficulty;
        df.textContent = labels[todo.difficulty];
        li.append(df);
      }
    }

    // 所要時間（分で保存。0より大きければ読みやすく表示）
    if (todo.estimateMin > 0) {
      const es = document.createElement("span");
      es.className = "estimate";
      es.textContent = "⏱ " + formatEstimate(todo.estimateMin);
      li.append(es);
    }

    li.append(del);
    list.appendChild(li);
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
