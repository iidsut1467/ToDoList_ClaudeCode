# ToDoList_ClaudeCode — プロジェクト引き継ぎメモ

学習用のシンプルなToDoアプリ。このファイルは **どのPC（Mac / Windows / 別のMac）でも作業を引き継げるように** 内容をまとめたもの。
別環境では `git clone https://github.com/iidsut1467/ToDoList_ClaudeCode.git` してから作業を始める。

## 作っている人について
- プログラミング／ターミナル操作の初心者。やり取りは日本語。
- コマンドは1行ずつコピペできる形で示し、「何が起きるか／次に何を押すか」まで添えると親切。
- ターミナルのパスワードやトークンは入力しても画面に何も表示されない（正常）ことを毎回伝える。

## このアプリの構成
- フロント: `index.html` / `app.js` / `style.css`。`app.js` が `api.php` に対して fetch で通信する。
- バックエンドは **同じ機能を2通り** 用意（どちらか片方を起動して使う）:
  - `api.php` … PHP版
  - `server.rb` … Ruby版（静的ファイルの配信もこの1ファイルで行う）
- データは同フォルダの `data.json` に保存される（実行時に自動生成。`.gitignore` で共有対象から除外済み）。

## 起動方法

### Mac の場合（PHP版・現在の主運用）
```
cd "ToDoListのフォルダのパス"
php -S localhost:8000
```
ブラウザで http://localhost:8000/ を開く。停止は Ctrl+C。
- PHPが入っていない場合: Homebrew を入れてから `brew install php`。
- Ruby版を使うなら Mac標準Rubyで `ruby server.rb` でも動く。

### Windows の場合
PHPかRubyのどちらかが必要（標準では入っていないことが多い）。

PHP版を使う例（PowerShell）:
```
# PHPの導入（未導入なら。winget が使える場合）
winget install PHP.PHP

# アプリ起動
cd "ToDoListのフォルダのパス"
php -S localhost:8000
```
ブラウザで http://localhost:8000/ を開く。停止は Ctrl+C。
- `php` が `not found` の場合はPHPのパス（環境変数 PATH）が通っていない。新しいウィンドウを開き直すか、PATH設定を確認する。
- Ruby版を使う場合は Ruby を導入し（`winget install RubyInstallerTeam.Ruby` など）、`ruby server.rb`。

## GitHub への反映（変更を保存して送る）
```
git add -A
git commit -m "変更内容のメモ"
git push
```
- リポジトリ: https://github.com/iidsut1467/ToDoList_ClaudeCode
- 認証は HTTPS + Personal Access Token（classic, scope=`repo`）。
  初回pushで Username=`iidsut1467` / Password=トークン(`ghp_...`) を入力。
  Macは `git config --global credential.helper osxkeychain`、Windowsは標準の Git Credential Manager で保存される（次回以降は入力不要）。
- git のユーザー設定: name=`iidsut1467`, email=`iidsut1467@gmail.com`。
  別PCで未設定なら:
  ```
  git config --global user.name "iidsut1467"
  git config --global user.email "iidsut1467@gmail.com"
  ```

## これからやりたいこと
- 細かいところを詰めていく（機能追加・改善など）。
