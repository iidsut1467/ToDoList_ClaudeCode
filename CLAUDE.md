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

## 環境構築の経緯・つまずきポイント（参考）
このMac（Apple Silicon / arm64）でゼロから整えたときの記録。別環境でも似た流れになる。
- もともと PHP も Homebrew も未導入だった。
- **Homebrew** を新規インストール（場所は `/opt/homebrew`）。インストール後、新しいシェルで使うには PATH を通す必要がある:
  ```
  eval "$(/opt/homebrew/bin/brew shellenv)"
  ```
  （`~/.zprofile` に追記済み。これをやらないと `brew: command not found` になる。）
- `brew install php` で PHP を導入。
- つまずいた点メモ:
  - ターミナルのパスワード入力（Homebrewインストール時の `Password:` など）は **打っても画面に何も出ない**。出なくてもそのまま打って Enter でよい。
  - 新しく入れたツールが `command not found` になるのは、たいてい PATH 未反映。新しいウィンドウを開くか、上の `eval ...` を実行する。
  - git push のトークン貼り付けも画面に表示されない（正常）。
- GitHub CLI（`gh`）は未導入。GitHub連携は手動（HTTPS + Personal Access Token）。

## これからやりたいこと（ロードマップ）
ToDoListに **拡張性** を持たせながら、以下の機能を追加していく。

追加したい機能:
1. 期限（いつまでに行うものか）
2. タイマー／リマインダーの導入
3. 期限による現時点からの優先順位（残り時間で自動算出）
4. 優先順位の指標の導入（手動で付ける優先度）
5. タスクの難度
6. おおよその所要時間の記入
7. 各自のカレンダーとの連携

### 拡張の方針（設計メモ）
- データの1件は現在こうなっている:
  `{id, text, done, dueAt, priority, quick, difficulty, estimateMin}`。
  - `dueAt`: 期限（"YYYY-MM-DD" / 空文字）
  - `priority`: 優先度（"high"/"mid"/"low"。既定 mid）
  - `quick`: すぐ終わるか否か（真偽値。**前提の選択**）
  - `difficulty`: 難度（"easy"/"normal"/"hard"。quick=true や未設定は ""）
  - `estimateMin`: 所要時間（分。quick=true は 0）
  - **古いデータでも壊れないよう、新項目は「無ければ既定値」で扱う**（後方互換）。
- 入力フォームは「**すぐ終わる?**」を前提に置き、「いいえ」のときだけ難度・所要時間を表示する（app.jsの`updateDetailVisibility`）。
- バックエンドは `api.php` と `server.rb` の **2つを常に同じ仕様に揃える**（片方だけ直さない）。不正値・未指定はサーバー側で既定値に補正する。
- フロントは `app.js` の `render()`（表示）と入力フォーム、サーバー側の保存項目をセットで増やす。
- カレンダー連携は外部API（Google Calendar等）の認証が絡み一番重いので最後に着手。

### 進める順番と進捗
- ✅ フェーズ1（土台）: 期限 / 優先度 / 難度 / 所要時間（分・時間・日）/ すぐ終わる? の入力・表示。難度は色分け表示。
- ✅ フェーズ2: 期限による自動並べ替え（近い順→優先度順）と残り日数表示（近い=橙 / 超過=赤）。
- ⬜ フェーズ3: タイマー／リマインダー（ブラウザ通知）。
- ⬜ フェーズ4: カレンダー連携。
