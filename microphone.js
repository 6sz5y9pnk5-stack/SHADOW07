/* SHADOW microphone permission diagnostic. Requests access only after explicit user action. */
;(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShadowMicDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function classifyError(error) {
    const name = String(error && error.name || 'UnknownError');
    const message = String(error && error.message || error || '詳細なし');
    let cause = '原因未特定';
    if (/AudioSession category is not compatible with audio capture/i.test(message)) cause = '音声セッション競合：実行ホスト／WebKit側の音声カテゴリが録音に対応していない可能性';
    else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') cause = '権限拒否・安全でない接続・埋め込み画面の権限ポリシーを確認';
    else if (name === 'InvalidStateError') cause = '文書が完全にアクティブでない、または音声セッション状態が不適合';
    else if (name === 'NotFoundError') cause = '利用できるマイク入力が見つからない';
    else if (name === 'NotReadableError' || name === 'AbortError') cause = 'OS・ブラウザー・別アプリ等がマイクを利用できない可能性';
    else if (name === 'SecurityError' || name === 'TypeError') cause = '安全なコンテキストやユーザーメディア機能の利用条件を確認';
    return {name, message, cause};
  }
  async function requestPermission(env) {
    const e = env || (typeof window !== 'undefined' ? window : {});
    const nav = e.navigator || {};
    const doc = e.document || {};
    const result = {
      ok: false,
      code: 'NOT_RUN',
      secureContext: e.isSecureContext === true,
      visible: doc.visibilityState ? doc.visibilityState === 'visible' : null,
      embedded: e.self && e.top ? e.self !== e.top : null,
      permissionsPolicySupported: false,
      microphoneAllowedByPolicy: null,
      streamAcquired: false,
      trackCount: 0,
      audioSessionSupported: !!(nav.audioSession && 'type' in nav.audioSession),
      audioSessionBefore: nav.audioSession && typeof nav.audioSession.type === 'string' ? nav.audioSession.type : null,
      audioSessionRequested: false,
      audioSessionSet: false,
      audioSessionRestore: null,
      error: null,
      note: ''
    };
    if (e.isSecureContext !== true) {
      result.code = 'INSECURE_CONTEXT';
      result.note = '安全なコンテキストではありません。HTTPSで開いて再検査してください。';
      return result;
    }
    if (!nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function') {
      result.code = 'API_UNAVAILABLE';
      result.note = 'この実行環境では getUserMedia API が利用できません。';
      return result;
    }
    if (doc.visibilityState && doc.visibilityState !== 'visible') {
      result.code = 'DOCUMENT_NOT_VISIBLE';
      result.note = 'ページが前面表示されていません。画面を表示して再検査してください。';
      return result;
    }
    // Detect an iframe/Permissions Policy block before asking the user to retry.
    // Older Safari builds may expose neither API, so absence is reported as unknown.
    const policy = doc.permissionsPolicy || doc.featurePolicy || null;
    if (policy && typeof policy.allowsFeature === 'function') {
      result.permissionsPolicySupported = true;
      try { result.microphoneAllowedByPolicy = policy.allowsFeature('microphone'); } catch (_) {}
      if (result.microphoneAllowedByPolicy === false) {
        result.code = 'PERMISSION_POLICY_BLOCKED';
        result.note = 'この文書ではPermissions Policyによりマイクが禁止されています。親ページ／埋め込み元の設定が必要です。';
        return result;
      }
    }
    let stream;
    let audioSession = nav.audioSession || null;
    let previousAudioSessionType = audioSession && typeof audioSession.type === 'string' ? audioSession.type : null;
    try {
      // Safari/WebKit can reject getUserMedia before prompting if the page audio session
      // is explicitly set to playback. Request the capture-compatible mode first.
      if (audioSession && 'type' in audioSession) {
        result.audioSessionRequested = true;
        try { audioSession.type = 'play-and-record'; } catch (_) {}
        result.audioSessionSet = audioSession.type === 'play-and-record';
      }
      stream = await nav.mediaDevices.getUserMedia({audio: true, video: false});
      const tracks = stream && typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
      result.trackCount = tracks.length;
      result.streamAcquired = tracks.length > 0;
      if (!result.streamAcquired) {
        result.code = 'NO_AUDIO_TRACK';
        result.note = 'アクセス処理は完了しましたが、音声トラックを取得できませんでした。';
        return result;
      }
      result.ok = true;
      result.code = 'PASS';
      result.note = 'ブラウザーから音声トラックを取得しました。診断後にトラックを停止します。音声認識は別検査です。';
      return result;
    } catch (error) {
      result.error = classifyError(error);
      result.code = result.error.name === 'InvalidStateError' && /AudioSession category is not compatible with audio capture/i.test(result.error.message)
        ? 'AUDIO_SESSION_CONFLICT'
        : result.error.name === 'NotAllowedError' ? 'PERMISSION_OR_POLICY_DENIED' : 'CAPTURE_FAILED';
      result.note = result.error.cause;
      return result;
    } finally {
      if (stream && typeof stream.getTracks === 'function') {
        for (const track of stream.getTracks()) {
          try { track.stop(); } catch (_) {}
        }
      }
      // Restore the prior page audio mode after the temporary permission probe.
      if (audioSession && 'type' in audioSession) {
        const restoreType = previousAudioSessionType || 'auto';
        try { audioSession.type = restoreType; } catch (_) {}
        result.audioSessionRestore = typeof audioSession.type === 'string' ? audioSession.type : null;
      }
    }
  }
  return {version: '1.1.0', classifyError, requestPermission};
});
