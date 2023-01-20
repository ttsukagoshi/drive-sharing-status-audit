/*
Copyright 2023 TSUKAGOSHI Taro

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// 各シート名
const SHEET_NAME_CONFIG = '01_設定'; // DriveフォルダIDなどの設定情報を記載したシート
const SHEET_NAME_BASIC = '02_基本権限'; // アクセス権があるユーザやグループ一覧
const SHEET_NAME_INDIVIDUAL = '03_個別権限'; // SHEET_NAME_BASICで指定したユーザやグループ以外に、個別にアクセス権を付与するファイルIDとユーザやグループの一覧

// メール通知の件名につける接頭文字列
const MAIL_SUB_PREFIX = '[AUDIT]';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('権限監査ツール')
    .addItem('権限監査ツール実行（手動）', 'auditSharingStatus')
    .addToUi();
}

/**
 * 権限監査ツール。
 * これを時間トリガーで毎日作動させる。
 */
function auditSharingStatus() {
  // 本スプレッドシート
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mailBodySuffix = `\n\n---\nこのメールはスプレッドシート「${ss.getName()}」により自動で送信されています。設定を確認・変更する場合は\n${ss.getUrl()}\nにアクセスしてください。`; // メール本文末尾につける文言
  // 設定情報を取得
  const configPre = ss
    .getSheetByName(SHEET_NAME_CONFIG)
    .getDataRange()
    .getValues();
  configPre.shift();
  const config = configPre.reduce((configObj, row) => {
    configObj[row[0]] = row[1]; // A列（row[0]）がキー、B列（row[1]）が値
    return configObj;
  }, {});
  try {
    // 許可されているユーザとグループの一覧を配列として取得
    const allowedBasicUsersGroups = ss
      .getSheetByName(SHEET_NAME_BASIC)
      .getDataRange()
      .getValues()
      .flat();
    allowedBasicUsersGroups.shift();

    // ファイルやフォルダごとに個別に許可されているユーザとグループの一覧を
    // ファイル／フォルダIDをキー、値をユーザ一覧の配列としたオブジェクトとして取得
    const allowedIndividualUsersGroupsPre = ss
      .getSheetByName(SHEET_NAME_INDIVIDUAL)
      .getDataRange()
      .getValues();
    allowedIndividualUsersGroupsPre.shift();
    const allowedIndividualUsersGroups =
      allowedIndividualUsersGroupsPre.length === 0
        ? null
        : allowedIndividualUsersGroupsPre.reduce((obj, row) => {
            obj[row[0]] = row[1].split(','); // A列（row[0]）がキーとなるファイル・フォルダID、B列（row[1]）が値となるユーザ一覧（カンマ区切り）
            return obj;
          }, {});

    // 監査するフォルダ内の検査
    let alertFilesList = []; // 想定外の権限が付与されているファイル／フォルダの情報を格納する配列
    alertFilesList = checkFileFolderSharingStatus_(
      config.TARGET_PARENT_FOLDER_ID,
      allowedBasicUsersGroups,
      allowedIndividualUsersGroups,
      alertFilesList
    );

    if (alertFilesList.length > 0) {
      // 想定外の権限が付与されているファイル／フォルダが1つ以上あった場合
      const mailAlertSubject = `${MAIL_SUB_PREFIX} ！想定外の共有が検出されました（権限監査ツール）`;
      const mailAlertBody =
        `権限監査ツールの検査対象となっているGoogle Driveフォルダ内に、想定外の共有が検出されました。\n※このメールは自動送信されています\n\n問題が検出されたファイル／フォルダは次のとおりです：\n\n${alertFilesList
          .map(
            (file) =>
              `名前：${file.name}\nURL：${file.url}\nオーナー：${
                file.owner
              }\n編集者：${file.editors.join(
                ', '
              )}\n閲覧者／閲覧者（コメント）：${file.viewers.join(', ')}`
          )
          .join('\n\n')}` + mailBodySuffix;
      console.error(`${mailAlertSubject}\n${mailAlertBody}`);
      MailApp.sendEmail(
        config.NOTIFICATION_EMAIL_TO,
        mailAlertSubject,
        mailAlertBody
      );
    } else {
      // 問題が検出されなかった場合も、実行確認のために完了通知を出す
      const mailCompleteSubject = `${MAIL_SUB_PREFIX} 検査完了（権限監査ツール）`;
      const mailCompleteBody =
        `権限監査ツールの検査対象となっているGoogle Driveフォルダ内を検査し、問題はありませんでした。\n※このメールは自動送信されています\n\n権限監査ツールの設定は次のとおりとなっています：\n\n監査対象の親フォルダ：${DriveApp.getFolderById(
          config.TARGET_PARENT_FOLDER_ID
        ).getName()}\nメール通知先：${
          config.NOTIFICATION_EMAIL_TO
        }\n基本権限（このユーザ／グループへの共有は許可されています）：${allowedBasicUsersGroups.join(
          ', '
        )}\n個別権限（これらのファイル／フォルダには個別に追加の権限設定が許可されています）：${
          allowedIndividualUsersGroups
            ? `\n${Object.keys(allowedIndividualUsersGroups)
                .map((key) => {
                  const file = DriveApp.getFileById(key);
                  return `名前：${file.getName()}\nURL：${file.getUrl()}\n追加権限:${allowedIndividualUsersGroups[
                    key
                  ].join(', ')}`;
                })
                .join('\n==\n')}`
            : '（なし）'
        }` + mailBodySuffix;
      console.info(`${mailCompleteSubject}\n${mailCompleteBody}`);
      MailApp.sendEmail(
        config.NOTIFICATION_EMAIL_TO,
        mailCompleteSubject,
        mailCompleteBody
      );
    }
  } catch (error) {
    // Apps Scriptの実行ログに記載
    console.error(error.stack);
    // メール通知
    MailApp.sendEmail(
      config.NOTIFICATION_EMAIL_TO,
      `${MAIL_SUB_PREFIX} エラー（権限監査ツール）`,
      error.stack + mailBodySuffix
    );
  }
}

/**
 * 指定したGoogleドライブフォルダ内のすべてのファイルやサブフォルダの共有状況を確認し、
 * 想定外の権限が付与されているファイル／フォルダの名前・URL・オーナー・共有相手といった
 * メタ情報が含まれたオブジェクトの配列を、既存の配列に追加して返す
 * @param {string} targetFolderId 検査するフォルダID
 * @param {string[]} allowedBasicUsersGroups 許可されているユーザとグループの一覧
 * @param {*} allowedIndividualUsersGroups ファイル／フォルダごとに個別に許可されているユーザとグループの一覧。
 * ファイル／フォルダIDをキー、値をユーザ一覧の配列としたオブジェクト
 * @param {any[]} alertFiles 既存の、想定外の権限が付与されているファイル／フォルダのメタ情報が含まれたオブジェクトの配列
 * @returns {any[]} 追加された想定外の権限が付与されているファイル／フォルダのメタ情報が含まれたオブジェクトの配列
 */
function checkFileFolderSharingStatus_(
  targetFolderId,
  allowedBasicUsersGroups,
  allowedIndividualUsersGroups,
  alertFiles
) {
  const targetFolder = DriveApp.getFolderById(targetFolderId);
  const targetFilesSubfolders = [
    targetFolder.getFiles(),
    targetFolder.getFolders(),
  ];
  while (targetFilesSubfolders[0].hasNext()) {
    const file = targetFilesSubfolders[0].next();

    // ファイルの一般的な共有条件（PRIVATE=非公開、DOMAIN=組織内、ANYONE=一般公開）
    // DriveApp.Accessの値のそれぞれの意味について、
    // 詳細は https://developers.google.com/apps-script/reference/drive/access を参照のこと
    const fileSharingAccess = file.getSharingAccess();

    // その他、当該ファイルのIDや共有アカウントといったメタ情報
    const fileId = file.getId();
    const fileOwner = file.getOwner().getEmail();
    const fileEditors = file.getEditors().map((editor) => editor.getEmail());
    const fileViewers = file.getViewers().map((viewer) => viewer.getEmail());

    if (fileSharingAccess !== DriveApp.Access.PRIVATE) {
      // ファイルが「非公開」以外の状態であれば、その時点で想定外の権限が付与されていると見なす
      alertFiles.push({
        name: file.getName(),
        url: file.getUrl(),
        owner: fileOwner,
        editors: fileEditors,
        viewers: fileViewers,
      });
    } else if (
      !allowedBasicUsersGroups.includes(fileOwner) ||
      fileEditors.filter((editor) => !allowedBasicUsersGroups.includes(editor))
        .length > 0 ||
      fileViewers.filter((viewer) => !allowedBasicUsersGroups.includes(viewer))
        .length > 0
    ) {
      // オーナー、編集者、閲覧者（コメント）、閲覧者いずれかに、
      // 想定したユーザ／グループ以外のアカウントが含まれている場合
      if (
        allowedIndividualUsersGroups &&
        allowedIndividualUsersGroups[fileId] &&
        (!allowedIndividualUsersGroups[fileId].includes(fileOwner) ||
          fileEditors.filter(
            (editor) => !allowedIndividualUsersGroups[fileId].includes(editor)
          ).length > 0 ||
          fileViewers.filter(
            (viewer) => !allowedIndividualUsersGroups[fileId].includes(viewer)
          ).length > 0)
      ) {
        // さらにその中で、ファイル／フォルダごとに個別に許可した一覧に該当項目があり、かつ
        // その個別に許可したユーザ／グループ以外のアカウントが含まれている場合
        alertFiles.push({
          name: file.getName(),
          url: file.getUrl(),
          owner: fileOwner,
          editors: fileEditors,
          viewers: fileViewers,
        });
      } else {
        alertFiles.push({
          name: file.getName(),
          url: file.getUrl(),
          owner: fileOwner,
          editors: fileEditors,
          viewers: fileViewers,
        });
      }
    }
  }
  while (targetFilesSubfolders[1].hasNext()) {
    const folder = targetFilesSubfolders[1].next();

    // ファイルの一般的な共有条件（PRIVATE=非公開、DOMAIN=組織内、ANYONE=一般公開）
    // DriveApp.Accessの値のそれぞれの意味について、
    // 詳細は https://developers.google.com/apps-script/reference/drive/access を参照のこと
    const folderSharingAccess = folder.getSharingAccess();

    // その他、当該ファイルのIDや共有アカウントといったメタ情報
    const folderId = folder.getId();
    const folderOwner = folder.getOwner().getEmail();
    const folderEditors = folder
      .getEditors()
      .map((editor) => editor.getEmail());
    const folderViewers = folder
      .getViewers()
      .map((viewer) => viewer.getEmail());

    if (folderSharingAccess !== DriveApp.Access.PRIVATE) {
      // ファイルが「非公開」以外の状態であれば、その時点で想定外の権限が付与されていると見なす
      alertFiles.push({
        name: folder.getName(),
        url: folder.getUrl(),
        owner: folderOwner,
        editors: folderEditors,
        viewers: folderViewers,
      });
    } else if (
      !allowedBasicUsersGroups.includes(folderOwner) ||
      folderEditors.filter(
        (editor) => !allowedBasicUsersGroups.includes(editor)
      ).length > 0 ||
      folderViewers.filter(
        (viewer) => !allowedBasicUsersGroups.includes(viewer)
      ).length > 0
    ) {
      // オーナー、編集者、閲覧者（コメント）、閲覧者いずれかに、
      // 想定したユーザ／グループ以外のアカウントが含まれている場合
      if (
        allowedIndividualUsersGroups &&
        allowedIndividualUsersGroups[folderId] &&
        (!allowedIndividualUsersGroups[folderId].includes(folderOwner) ||
          folderEditors.filter(
            (editor) => !allowedIndividualUsersGroups[folderId].includes(editor)
          ).length > 0 ||
          folderViewers.filter(
            (viewer) => !allowedIndividualUsersGroups[folderId].includes(viewer)
          ).length > 0)
      ) {
        // さらにその中で、ファイル／フォルダごとに個別に許可した一覧に該当項目があり、かつ
        // その個別に許可したユーザ／グループ以外のアカウントが含まれている場合
        alertFiles.push({
          name: folder.getName(),
          url: folder.getUrl(),
          owner: folderOwner,
          editors: folderEditors,
          viewers: folderViewers,
        });
      } else {
        alertFiles.push({
          name: folder.getName(),
          url: folder.getUrl(),
          owner: folderOwner,
          editors: folderEditors,
          viewers: folderViewers,
        });
      }
    }

    // 再帰的に当該フォルダ内ののファイル／サブフォルダも確認する。
    alertFiles = checkFileFolderSharingStatus_(
      folderId,
      allowedBasicUsersGroups,
      allowedIndividualUsersGroups,
      alertFiles
    );
  }
  return alertFiles;
}

if (typeof module === 'object') {
  module.exports = {
    onOpen,
    auditSharingStatus,
  };
}
