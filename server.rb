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
      todos << { "id" => new_id, "text" => text, "done" => false }
      save_data(todos)
      res.body = JSON.generate({ "ok" => true, "id" => new_id })
    end

  when "PUT" # 完了状態の更新
    input = (JSON.parse(req.body) rescue {})
    todos.each { |t| t["done"] = !!input["done"] if t["id"] == input["id"] }
    save_data(todos)
    res.body = JSON.generate({ "ok" => true })

  when "DELETE" # 削除
    input = (JSON.parse(req.body) rescue {})
    todos.reject! { |t| t["id"] == input["id"] }
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
