# Google ドライブ権限監査ツール

[![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg?style=flat-square)](https://github.com/google/clasp) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![CodeQL](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/codeql.yml/badge.svg)](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/codeql.yml) [![Deploy](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/deploy.yml/badge.svg)](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/deploy.yml) [![Lint Code Base](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/linter.yml/badge.svg)](https://github.com/ttsukagoshi/drive-sharing-status-audit/actions/workflows/linter.yml)

指定した Google Drive フォルダ内で意図しない共有がないかを監視するための、Google スプレッドシートと Google Apps Script （GAS）による簡易の権限監査ツール。

## 使い方

### 1. サンプルスプレッドシートをコピーする

ツールは、GAS 付き Google スプレッドシートの形式です →[[Sample] 権限監査ツール - Google ドライブ - Google スプレッドシート](https://docs.google.com/spreadsheets/d/1gYgDP2LgGbsJgJ8U5AsEG_g0WEGhPTfsGyzEJ9sMC-Q/edit?usp=sharing)。このスプレッドシートを`メニュー`＞`コピーを作成`にてご自身がオーナーのスプレッドシートとしてコピーしてください。その際、Apps Script も合わせてコピーされます。

### 2. 【必須】基本設定

シート「`01_設定`」で、監査対象の Google ドライブフォルダ ID（`TARGET_PARENT_FOLDER_ID`）と、通知先のメールアドレス（`NOTIFICATION_EMAIL_TO`）を設定します。黄色セルが、編集部分です。

Google ドライブのフォルダ ID は、その URL から簡単に知ることができます。

```
https://drive.google.com/drive/folders/xxxxx
```

であれば、`xxxxx`がそのフォルダ ID です。

監査状況を通知するメールアドレスは複数指定することもできます。その場合は、メールアドレス同士をカンマ`,`で区切ってください。例：`myemail@address.com,my-team@address.com`

### 3. 【必須】アクセスが許可されたアカウントを登録

シート「`02_基本権限`」で、監査対象となるファイル／フォルダにアクセスが許可されているアカウント（ユーザ／グループ）を記載します。行数が足りなければ、適宜追加して問題ありません。

### 4. 【任意】例外的に許可するアカウントをファイル／フォルダごとに登録

シート「`03_個別権限`」は、特定のファイル／フォルダについて、2.で設定した以外のアカウントへ例外的に共有したい場合に利用します。特になければ、空白のままで大丈夫です。

A 列にファイル／フォルダ ID を、B 列にアカウントを記載します。複数アカウントを記載したい場合は、[2. の通知先メールアドレス](#2-必須基本設定)と同様に、カンマ（`,`）でつなぎます（例：「myemail@address.com,my-team@address.com」）

### 5. テスト実行

スプレッドシートのメニューから「`権限監査ツール`」＞「`権限監査ツール実行（手動）`」で想定通りのメール通知が届くことを確認します。

初回実行時は、ツールが実行するのに必要な権限の承認が求められます。承認後、メニューから再度「`実行`」を選択すると、実際にツールが実行されます。

> 無料の Gmail アカウントをお使いの場合、承認の段階で Google から「Google 未承認のアプリの実行」に関する警告がでます。以下を踏まえて、確認の上で承認してください。
>
> - 本ツールは、アナリティクスを含む利用者の情報を一切収集していません。
> - ご自身でコピーして作成したスプレッドシートは、完全にご自身のものであり、開発者側からは閲覧・アクセスできません。

#### 意図しない共有がなかった（問題なかった）場合

件名「`[AUDIT] 検査完了（権限監査ツール）`」というメールが届きます。

#### 意図しない共有があった場合

件名「`[AUDIT] ！想定外の共有が検出されました（権限監査ツール）`」というメールが届きます。

#### 何らかのエラーが発生した場合

件名「`[AUDIT] エラー（権限監査ツール）`」というメールが届きます。

### 6. 【任意】定期的に実行するためのトリガーを設定

定期的に本ツールを実行させたいのであれば、スプレッドシートのメニューから「`拡張機能`」＞「`Apps Script`」を開き、画面左のメニューで「`トリガー`」を選択します。「`トリガーを追加`」から、関数「`auditSharingStatus`」を任意の頻度で実行するよう、設定してください。

なお、本ツールは 1 日おきに実行するように設計されたものです。設定するトリガーの頻度や、監査対象となるファイル数によっては、スクリプトの実行時間等が[GAS の利用制限](https://developers.google.com/apps-script/guides/services/quotas)の上限を超過する可能性があることにはご留意ください。

## 利用条件等

本ツールは[Apache License 2.0 のもとで配布](https://github.com/ttsukagoshi/drive-sharing-status-audit/blob/main/LICENSE)されており、本ツールを利用することに伴ういかなる利益や損害も利用者自身に帰することとされています。事前にライセンスの内容をよくご確認の上で、ご活用ください。
