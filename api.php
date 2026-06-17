<?php
// ===== サーバー処理（PHP）はこのファイルが担当 =====
// ブラウザ(JavaScript)からのリクエストを受け取り、データを保存・読み出して返す。
// 保存先は同じフォルダの data.json（最初の学習用。あとでMySQL等に差し替え可能）。

header("Content-Type: application/json; charset=utf-8");

$dataFile = __DIR__ . "/data.json";

// --- 保存ファイルを読み込む（{budget, todos} 形式で返す。旧形式=配列にも対応） ---
function loadStore($file) {
    $default = ["budget" => 0, "todos" => []];
    if (!file_exists($file)) {
        return $default;
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) {
        return $default;
    }
    // 新形式（オブジェクト：todos を持つ）
    if (array_key_exists("todos", $data)) {
        return [
            "budget" => (int)($data["budget"] ?? 0),
            "todos"  => is_array($data["todos"]) ? $data["todos"] : [],
        ];
    }
    // 旧形式（todos の配列だけ）→ 予算0で包む（後方互換）
    return ["budget" => 0, "todos" => $data];
}

// --- 保存ファイルに書き込む ---
function saveData($file, $data) {
    // JSON_PRETTY_PRINT＝人が読める整形、UNESCAPED_UNICODE＝日本語をそのまま保存
    file_put_contents(
        $file,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );
}

// --- リクエストの本文(JSON)を配列にして取り出す ---
function getInput() {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

$method = $_SERVER["REQUEST_METHOD"];
$store = loadStore($dataFile);
$todos = $store["todos"];

switch ($method) {

    // 予算と一覧({budget, todos})を返す
    case "GET":
        echo json_encode($store, JSON_UNESCAPED_UNICODE);
        break;

    // 新規追加
    case "POST":
        $input = getInput();
        $text = trim($input["text"] ?? "");
        if ($text === "") {
            http_response_code(400);
            echo json_encode(["error" => "テキストが空です"]);
            break;
        }
        // 一意なIDを採番（既存の最大値＋1）
        $newId = 1;
        foreach ($todos as $t) {
            if ($t["id"] >= $newId) {
                $newId = $t["id"] + 1;
            }
        }
        $dueAt = trim($input["dueAt"] ?? ""); // 入金期限（任意）。未入力なら空文字
        $eventAt = trim($input["eventAt"] ?? ""); // 日時・予定（任意）"YYYY-MM-DDTHH:MM"
        // 費用（円・整数。数値以外や負数は 0 に補正）
        $cost = (int)($input["cost"] ?? 0);
        if ($cost < 0) {
            $cost = 0;
        }
        // 優先度（high/mid/low のいずれか。不正値や未指定は mid に補正）
        $priority = $input["priority"] ?? "mid";
        if (!in_array($priority, ["high", "mid", "low"], true)) {
            $priority = "mid";
        }
        // 前提：すぐ終わるか否か（真偽値）
        $quick = (bool)($input["quick"] ?? false);
        // 難度（easy/normal/hard のいずれか。それ以外は「未設定」として空に）
        $difficulty = $input["difficulty"] ?? "";
        if (!in_array($difficulty, ["easy", "normal", "hard"], true)) {
            $difficulty = "";
        }
        // 所要時間（分。数値以外や負数は 0 に補正）
        $estimateMin = (int)($input["estimateMin"] ?? 0);
        if ($estimateMin < 0) {
            $estimateMin = 0;
        }
        // すぐ終わるタスクは難度・所要時間を持たない
        if ($quick) {
            $difficulty = "";
            $estimateMin = 0;
        }
        // 親タスクのID（0＝最上位の根タスク。子タスク追加時に親IDが入る）
        $parentId = (int)($input["parentId"] ?? 0);
        $todos[] = ["id" => $newId, "text" => $text, "done" => false, "dueAt" => $dueAt, "eventAt" => $eventAt, "cost" => $cost, "priority" => $priority, "quick" => $quick, "difficulty" => $difficulty, "estimateMin" => $estimateMin, "parentId" => $parentId];
        $store["todos"] = $todos;
        saveData($dataFile, $store);
        echo json_encode(["ok" => true, "id" => $newId]);
        break;

    // 更新（予算の設定 / 完了状態の切替 / 名前の編集）。送られてきた項目だけ更新する
    case "PUT":
        $input = getInput();
        // 予算の設定（budget が送られてきたとき）
        if (array_key_exists("budget", $input)) {
            $budget = (int)$input["budget"];
            if ($budget < 0) {
                $budget = 0;
            }
            $store["budget"] = $budget;
            saveData($dataFile, $store);
            echo json_encode(["ok" => true]);
            break;
        }
        $id = $input["id"] ?? null;
        foreach ($todos as &$t) {
            if ($t["id"] === $id) {
                // done が送られてきたときだけ完了状態を更新
                if (array_key_exists("done", $input)) {
                    $t["done"] = (bool)$input["done"];
                }
                // text が送られてきたときだけ名前を更新（空文字は無視）
                if (array_key_exists("text", $input)) {
                    $newText = trim($input["text"]);
                    if ($newText !== "") {
                        $t["text"] = $newText;
                    }
                }
            }
        }
        unset($t); // 参照を解除（PHPのforeach&定番の後始末）
        $store["todos"] = $todos;
        saveData($dataFile, $store);
        echo json_encode(["ok" => true]);
        break;

    // 削除（指定タスクと、その子孫すべてを削除）
    case "DELETE":
        $input = getInput();
        $id = $input["id"] ?? null;
        // 削除対象のIDを集める。親が対象なら子も対象に加える、を変化が無くなるまで繰り返す
        $toDelete = [$id];
        do {
            $changed = false;
            foreach ($todos as $t) {
                $pid = $t["parentId"] ?? 0;
                if (in_array($pid, $toDelete, true) && !in_array($t["id"], $toDelete, true)) {
                    $toDelete[] = $t["id"];
                    $changed = true;
                }
            }
        } while ($changed);
        // 集めたIDを除いた配列に作り直す
        $todos = array_values(array_filter($todos, function ($t) use ($toDelete) {
            return !in_array($t["id"], $toDelete, true);
        }));
        $store["todos"] = $todos;
        saveData($dataFile, $store);
        echo json_encode(["ok" => true]);
        break;

    default:
        http_response_code(405); // 対応していないメソッド
        echo json_encode(["error" => "Method Not Allowed"]);
}
