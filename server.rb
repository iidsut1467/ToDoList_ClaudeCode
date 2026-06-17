# ===== サーバー処理（Ruby版）=====
# api.php と全く同じ役割を Ruby で実装したもの。
# Mac標準のRubyだけで動く（インストール不要）。
# 静的ファイル(index.html/style.css/app.js)の配信と、
# /api.php へのデータ操作の両方をこの1ファイルで担当する。

require "webrick"
require "json"

# Mac標準のRuby(WEBrick)は初期状態でDELETEを許可していないため、
# POST等と同じく proc を呼ぶよう許可を1つ追加しておく
module WEBrick
  module HTTPServlet
    class ProcHandler
      alias do_DELETE do_GET
    end
  end
end

DIR  = File.expand_path(File.dirname(__FILE__))
DATA = File.join(DIR, "data.json")

# --- 保存ファイルを読み込む（無ければ空配列） ---
def load_data
  return [] unless File.exist?(DATA)
  JSON.parse(File.read(DATA))
rescue StandardError
  []
end

# --- 保存ファイルに書き込む（日本語はそのまま、見やすく整形） ---
def save_data(todos)
  File.write(DATA, JSON.pretty_generate(todos))
end

# DocumentRoot を指定すると index.html などの静的ファイルを自動配信してくれる
server = WEBrick::HTTPServer.new(Port: 8000, DocumentRoot: DIR)

# /api.php というパスだけは「動的処理」で上書きする
# （フロントの app.js が api.php に向けて通信しているため、名前を合わせている）
server.mount_proc "/api.php" do |req, res|
  res["Content-Type"] = "application/json; charset=utf-8"
  todos = load_data

  case req.request_method
  when "GET" # 一覧を返す
    res.body = JSON.generate(todos)

  when "POST" # 新規追加
    input = (JSON.parse(req.body) rescue {})
    text  = (input["text"] || "").strip
    if text.empty?
      res.status = 400
      res.body = JSON.generate({ "error" => "テキストが空です" })
    else
      new_id = (todos.map { |t| t["id"] }.max || 0) + 1
      due_at = (input["dueAt"] || "").strip # 期限（任意）。未入力なら空文字
      # 優先度（high/mid/low のいずれか。不正値や未指定は mid に補正）
      priority = input["priority"] || "mid"
      priority = "mid" unless ["high", "mid", "low"].include?(priority)
      # 前提：すぐ終わるか否か（真偽値）
      quick = input["quick"] == true
      # 難度（easy/normal/hard のいずれか。それ以外は「未設定」として空に）
      difficulty = input["difficulty"] || ""
      difficulty = "" unless ["easy", "normal", "hard"].include?(difficulty)
      # 所要時間（分。数値以外や負数は 0 に補正）
      estimate_min = input["estimateMin"].to_i
      estimate_min = 0 if estimate_min < 0
      # すぐ終わるタスクは難度・所要時間を持たない
      if quick
        difficulty = ""
        estimate_min = 0
      end
      # 親タスクのID（0＝最上位の根タスク。子タスク追加時に親IDが入る）
      parent_id = input["parentId"].to_i
      todos << { "id" => new_id, "text" => text, "done" => false, "dueAt" => due_at, "priority" => priority, "quick" => quick, "difficulty" => difficulty, "estimateMin" => estimate_min, "parentId" => parent_id }
      save_data(todos)
      res.body = JSON.generate({ "ok" => true, "id" => new_id })
    end

  when "PUT" # 更新（完了状態の切替 / 名前の編集）。送られてきた項目だけ更新する
    input = (JSON.parse(req.body) rescue {})
    todos.each do |t|
      next unless t["id"] == input["id"]
      t["done"] = !!input["done"] if input.key?("done")
      if input.key?("text")
        new_text = input["text"].to_s.strip
        t["text"] = new_text unless new_text.empty?
      end
    end
    save_data(todos)
    res.body = JSON.generate({ "ok" => true })

  when "DELETE" # 削除（指定タスクと、その子孫すべてを削除）
    input = (JSON.parse(req.body) rescue {})
    to_delete = [input["id"]]
    loop do
      before = to_delete.size
      todos.each do |t|
        pid = t["parentId"] || 0
        to_delete << t["id"] if to_delete.include?(pid) && !to_delete.include?(t["id"])
      end
      break if to_delete.size == before
    end
    todos.reject! { |t| to_delete.include?(t["id"]) }
    save_data(todos)
    res.body = JSON.generate({ "ok" => true })

  else
    res.status = 405
    res.body = JSON.generate({ "error" => "Method Not Allowed" })
  end
end

# Ctrl+C できれいに停止
trap("INT") { server.shutdown }

puts "ToDoサーバー起動: http://localhost:8000/  （停止は Ctrl+C）"
server.start
