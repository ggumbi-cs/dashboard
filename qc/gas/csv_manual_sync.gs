// ================================================================
// csv_manual_sync.gs
// CSV(zip) 드래그 기반 개별 수동 동기화
//
// - code.gs의 doGet 라우터에 아래 2줄만 추가되어 있음:
//     case 'csvManualSync': result = csvManualSync(...); break;
//     case 'getCsvSyncTimes': result = getCsvSyncTimes(); break;
// - doPost는 code.gs에 없고 이 파일에서 단독 정의 (GAS 프로젝트 전체에서
//   doPost는 하나만 존재 가능하므로, code.gs를 건드리지 않기 위해 여기서만 관리)
// - 실제 로직은 전부 이 파일에서 관리 (code.gs는 건드리지 않음)
//
// 프론트(qc_main.html)에서 zip을 풀어 CSV를 파싱한 뒤,
// { sectionKey, records } 형태로 전달하면
// qc_data.json의 해당 섹션(sectionKey)만 통째로 교체하고
// GitHub에 재업로드한다. 노션 API는 전혀 호출하지 않는다.
//
// ── 1차 기록 (2026-08-04 추가) ──
// GitHub 업로드가 실패해도 CSV로 올린 데이터 자체는 날아가지 않도록,
// GitHub에 올리기 전에 먼저 code.gs의 writeSectionToSheet()로 같은
// 구글시트(QC_SHEET_ID)의 sectionKey 탭에 기록한다. 시트 기록은 성공했는데
// GitHub 업로드만 실패한 경우, 프론트에서 같은 CSV를 다시 업로드하면
// 시트가 그대로 덮어써지고 GitHub 업로드만 재시도된다.
//
// ── GET vs POST ──
// CSV 레코드 수가 많아지면 JSON을 URL 쿼리스트링에 통째로 실어 보내는
// GET 방식은 브라우저/서버의 URL 길이 한계를 넘어 "Failed to fetch"로
// 실패할 수 있다. 그래서 실제 프론트는 POST(본문에 JSON)로 호출하고,
// doPost가 이를 처리한다. csvManualSync(GET)는 소량 테스트/호환용으로만 남겨둠.
// ================================================================

// ── POST 전용 라우터 (code.gs의 doGet과 별개로 이 파일에서만 정의) ──
function doPost(e) {
  let result;
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) { result = { ok: false, msg: 'no post body' }; }
    else {
      const body   = JSON.parse(raw);
      const action = body.action || '';
      switch (action) {
        case 'csvManualSync':
          result = csvManualSyncCore(body);
          break;
        default:
          result = { ok: false, msg: 'unknown POST action: ' + action };
      }
    }
  } catch (err) {
    result = { ok: false, msg: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET 경로(쿼리스트링, URL 인코딩) — 소량 테스트/기존 호환용으로만 유지.
// 실사용(대량 CSV)은 POST(doPost → csvManualSyncCore)를 탄다.
function csvManualSync(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };

  let d;
  try { d = JSON.parse(decodeURIComponent(rawData)); }
  catch (e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  return csvManualSyncCore(d);
}

// 실제 동기화 로직 (GET/POST 공통 진입점)
function csvManualSyncCore(d) {
  const sectionKey = d.sectionKey;
  const records    = d.records;
  if (!sectionKey)        return { ok: false, msg: 'sectionKey 누락' };
  if (!Array.isArray(records)) return { ok: false, msg: 'records 배열 누락' };

  // 0) 1차 기록: GitHub에 올리기 전에 구글시트에 먼저 저장.
  //    (writeSectionToSheet는 code.gs에 정의됨 — 같은 GAS 프로젝트라 전역에서 접근 가능)
  //    여기서 실패하면 데이터가 어디에도 저장되지 않은 것이므로 바로 에러 반환.
  try {
    writeSectionToSheet(sectionKey, records);
  } catch (e) {
    return { ok: false, msg: '시트 1차 기록 실패: ' + e.toString() };
  }

  const props   = PropertiesService.getScriptProperties();
  const ghToken = props.getProperty('GITHUB_TOKEN');
  const ghOwner = props.getProperty('GITHUB_OWNER') || 'ggumbi-cs';
  const ghRepo  = props.getProperty('GITHUB_REPO')  || 'dashboard';
  const ghPath  = 'qc/qc_data.json';

  if (!ghToken) return { ok: false, msg: 'GITHUB_TOKEN이 Script Properties에 없습니다. (시트 기록은 완료됨)', sheetSaved: true };

  const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${ghPath}`;

  // 1) 기존 qc_data.json 조회 (sha 필요)
  const getRes = UrlFetchApp.fetch(apiUrl, {
    headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json' },
    muteHttpExceptions: true
  });
  const getJson = JSON.parse(getRes.getContentText());
  if (!getJson.content) {
    return { ok: false, msg: 'qc_data.json 조회 실패 (시트 기록은 완료됨): ' + JSON.stringify(getJson), sheetSaved: true };
  }
  const sha = getJson.sha;

  let payload;
  try {
    const decoded = Utilities.newBlob(
      Utilities.base64Decode(getJson.content.replace(/\n/g, ''))
    ).getDataAsString('UTF-8');
    payload = JSON.parse(decoded);
  } catch (e) {
    return { ok: false, msg: '기존 qc_data.json 파싱 실패 (시트 기록은 완료됨): ' + e, sheetSaved: true };
  }

  // 2) 해당 섹션만 교체 (다른 섹션은 그대로 유지)
  const now = new Date().toISOString();
  payload[sectionKey] = {
    records:    records,
    lastSynced: now,
    source:     'csv수동'
  };
  payload.lastSynced = now;

  // 3) GitHub 재업로드
  const content = Utilities.base64Encode(JSON.stringify(payload, null, 2), Utilities.Charset.UTF_8);
  const body = {
    message: `manual-csv-sync: ${sectionKey} ${records.length}건 (${new Date().toLocaleString('ko-KR')})`,
    content,
    sha
  };

  const putRes  = UrlFetchApp.fetch(apiUrl, {
    method:  'PUT',
    headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const putJson = JSON.parse(putRes.getContentText());

  if (!putJson.content) {
    return { ok: false, msg: 'GitHub 업로드 실패 (시트 기록은 완료됨): ' + JSON.stringify(putJson), sheetSaved: true };
  }

  // 4) 섹션별 개별 동기화 시각 기록 (Script Properties)
  props.setProperty('QC_LAST_SYNC_' + sectionKey, now);

  return { ok: true, sectionKey, count: records.length, time: now };
}

// 섹션별 최근 CSV 동기화 시각 일괄 조회 (프론트 초기 로드용)
function getCsvSyncTimes() {
  const props = PropertiesService.getScriptProperties();
  const all   = props.getProperties();
  const times = {};
  Object.keys(all).forEach(k => {
    if (k.indexOf('QC_LAST_SYNC_') === 0) {
      times[k.replace('QC_LAST_SYNC_', '')] = all[k];
    }
  });
  return { ok: true, times };
}
