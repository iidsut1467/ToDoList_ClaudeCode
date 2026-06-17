<?php
// ===== サーバー処理（PHP）はこのファイルが担当 =====
// ブラウザ(JavaScript)からのリクエストを受け取り、データを保存・読み出して返す。
// 保存先は同じフォルダの data.json（最初の学習用。あとでMySQL等に差し替え可能）。

header("Content-Type: application/json; charset=utf-8");

$dataFile = __DIR__ . "/data.json";

// --- 保存ファイルを読み込む（無ければ空配列） ---
function loadData($file) {
    if (!file_exists($file)) {
        return [];
    }
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
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
$todos = loadData($dataFile);

switch ($method) {

    // 一覧を返す
    case "GET":
        echo json_encode($todos, JSON_UNESCAPED_UNICODE);
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
        $dueAt = trim($input["dueAt"] ?? ""); // 期限（任意）。未入力なら空文字
        // 優先度（high/mid/low のいずれか。不正値や未指定は mid に補正）
        $priority = $input["priority"] ?? "mid";
        if (!in_array($priority, ["high", "mid", "low"], true)) {
            $priority = "mid";
        }
        // 難度（easy/normal/hard のいずれか。不正値や未指定は normal に補正）
        $difficulty = $input["difficulty"] ?? "normal";
        if (!in_array($difficulty, ["easy", "normal", "hard"], true)) {
            $difficulty = "normal";
        }
        $todos[] = ["id" => $newId, "text" => $text, "done" => false, "dueAt" => $dueAt, "priority" => $priority, "difficulty" => $difficulty];
        saveData($dataFile, $todos);
        echo json_encode(["ok" => true, "id" => $newId]);
        break;

    // 完了状態の更新
    case "PUT":
        $input = getInput();
        $id = $input["id"] ?? null;
        $done = (bool)($input["done"] ?? false);
        foreach ($todos as &$t) {
            if ($t["id"] === $id) {
                $t["done"] = $done;
            }
        }
        unset($t); // 参照を解除（PHPのforeach&定番の後始末）
        saveData($dataFile, $todos);
        echo json_encode(["ok" => true]);
        break;

    // 削除
    case "DELETE":
        $input = getInput();
        $id = $input["id"] ?? null;
        // 指定IDを除いた配列に作り直す
        $todos = array_values(array_filter($todos, function ($t) use ($id) {
            return $t["id"] !== $id;
        }));
        saveData($dataFile, $todos);
        echo json_encode(["ok" => true]);
        break;

    default:
        http_response_code(405); // 対応していないメソッド
        echo json_encode(["error" => "Method Not Allowed"]);
}
