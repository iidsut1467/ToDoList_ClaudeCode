// ===== 動き（JavaScript）はこのファイルが担当 =====
// ブラウザ内でユーザー操作に反応し、PHPサーバー(api.php)とデータをやり取りする。

const API = "api.php"; // 通信相手のサーバー側プログラム

// よく使うHTML要素を取得しておく
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const dueInput = document.getElementById("todo-due"); // 期限の入力欄
const priorityInput = document.getElementById("todo-priority"); // 優先度の選択欄
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
  const priority = priorityInput.value; // "high" / "mid" / "low"

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, dueAt, priority }),
  });

  input.value = "";
  dueInput.value = "";             // 期限欄もリセット
  priorityInput.value = "mid";     // 優先度は「中」に戻す
  loadTodos();                     // 追加後に一覧を更新
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
