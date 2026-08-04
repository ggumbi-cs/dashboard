// ================================================================
// 꿈비 품질관리 대시보드 - GAS 백엔드
// qc_gas.gs (code.gs)
//
// 저장소: PropertiesService (ScriptProperties)
// 키 목록:
//   QC_QUICK_CARDS   : 빠른바로가기 + 슬라이더카드 + 배너설정 통합
//   QC_NOTICE        : 업데이트내역 + 운영안내 통합
//   QC_SHEET_ID      : 1차 기록용 구글시트 ID (없으면 자동 생성)
//
// CORS 대응: Content-Type text/plain + callback 없이 JSON 직접 반환
//
// ── 동기화 2단계 구조 (2026-08-04 추가) ──
// 기존에는 syncQcData() 한 번의 실행 안에서 Notion 9개 DB 조회 + GitHub
// 업로드까지 전부 처리했다. 이 경우 GAS 실행시간 제한(6분)에 걸려 GitHub
// 업로드 단계에서 죽으면, 이미 조회해둔 Notion 데이터까지 통째로 날아가고
// 다음 새벽 1시 트리거까지 재동기화가 안 되는 문제가 있었다.
//
// 그래서 아래처럼 2단계로 분리했다:
//   1단계 (Notion→시트) : 섹션별로 Notion을 조회하는 즉시 구글시트
//     (QC_SHEET_ID)의 해당 탭에 기록. 한 섹션이 끝날 때마다 바로 저장되므로
//     중간에 실행이 죽어도 그때까지 가져온 데이터는 보존된다.
//   2단계 (시트→GitHub) : publishQcDataToGithub()가 Notion을 다시 조회하지
//     않고 시트에 저장된 값만 읽어 qc_data.json을 만들어 GitHub에 올린다.
//     이 단계만 실패하면 Notion 재조회 없이 이 함수만 다시 실행하면 된다
//     (Apps Script 편집기에서 수동 실행하거나 ?action=publishQcDataToGithub).
// ================================================================


// ──────────────────────────────────────────────────────────────
// 라우터
// ──────────────────────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  Logger.log('doGet action=' + action);
  let result;

  try {
    switch (action) {

      case 'getQcSettings':
        result = getQcSettings();
        break;

      case 'saveQcSettings':
        result = saveQcSettings((e.parameter && e.parameter.data) || '');
        break;

      case 'saveQcNoticeSettings':
        result = saveQcNoticeSettings((e.parameter && e.parameter.data) || '');
        break;

      case 'saveQcBannerSettings':
        result = saveQcBannerSettings((e.parameter && e.parameter.data) || '');
        break;

      case 'getQcDefectData':
        result = getQcDefectData();
        break;

      case 'getQcImproveStatus':
        result = getQcImproveStatus();
        break;

      case 'saveQcImproveStatus':
        result = saveQcImproveStatus((e.parameter && e.parameter.data) || '');
        break;

      case 'syncQcData':
        result = syncQcData();
        break;

      // 2단계(시트→GitHub)만 수동으로 재시도하고 싶을 때 사용.
      // Notion을 다시 조회하지 않고 구글시트에 이미 기록된 값만 사용한다.
      case 'publishQcDataToGithub':
        result = publishQcDataToGithub();
        break;

      case 'getLastSyncTime':
        var p2 = PropertiesService.getScriptProperties();
        result = { ok:true, time: p2.getProperty('QC_LAST_SYNC_TIME')||'', summary: p2.getProperty('QC_LAST_SYNC_SUMMARY')||'' };
        break;

      case 'getActionItems':
        result = getActionItems();
        break;

      case 'updateActionItem':
        result = updateActionItem((e.parameter && e.parameter.data) || '');
        break;

      case 'getProductPriority':
        result = getProductPriority();
        break;

      case 'saveProductPriority':
        result = saveProductPriority((e.parameter && e.parameter.data) || '');
        break;

      case 'getReturnCostData':
        result = getReturnCostData();
        break;

      case 'getZaejaeData':
        result = getZaejaeData();
        break;
      case 'updateZaejaeItem':
        result = updateZaejaeItem((e.parameter && e.parameter.data) || '');
        break;
      case 'getTaekbaeData':
        result = getTaekbaeData();
        break;
      case 'updateTaekbaeItem':
        result = updateTaekbaeItem((e.parameter && e.parameter.data) || '');
        break;
      case 'getDangaData':
        result = getDangaData();
        break;

      case 'getTaekbaeRealtime':
        result = getTaekbaeRealtime();
        break;
      case 'getTaekbaeModels':
        result = getTaekbaeModels();
        break;
      case 'getNotionUsers':
        result = getNotionUsers();
        break;
      case 'createTaekbaeItem':
        result = createTaekbaeItem((e.parameter && e.parameter.data) || '');
        break;
      case 'createDangaItem':
        result = createDangaItem((e.parameter && e.parameter.data) || '');
        break;

      case 'getCheoriData':
        result = getCheoriData();
        break;
      case 'getMatAsData':
        result = getMatAsData();
        break;

      case 'getBanpumMagamData':
        result = getBanpumMagamData();
        break;
      case 'getBanpumRateData':
        result = getBanpumRateData();
        break;
      case 'getBanpumInspectionData':
        result = getBanpumInspectionData();
        break;

      case 'getVacationData':
        result = getVacationData();
        break;

      // ── CSV 개별 수동 동기화 (로직은 csv_manual_sync.gs) ──
      case 'csvManualSync':
        result = csvManualSync((e.parameter && e.parameter.data) || '');
        break;

      case 'getCsvSyncTimes':
        result = getCsvSyncTimes();
        break;

      default:
        // action 없이 직접 실행 시 전체 설정 반환 (테스트 편의)
        result = getQcSettings();
    }
  } catch (err) {
    result = { ok: false, msg: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


// ──────────────────────────────────────────────────────────────
// 전체 설정 불러오기
// ──────────────────────────────────────────────────────────────
function getQcSettings() {
  const props = PropertiesService.getScriptProperties();

  const rawMain   = props.getProperty('QC_QUICK_CARDS') || '{}';
  const rawNotice = props.getProperty('QC_NOTICE') || '{}';

  let mainData   = {};
  let noticeData = {};

  try { mainData   = JSON.parse(rawMain);   } catch(e) { mainData   = {}; }
  try { noticeData = JSON.parse(rawNotice); } catch(e) { noticeData = {}; }

  return {
    ok: true,
    settings: {
      quick:        mainData.quick        || [],
      cards:        mainData.cards        || [],
      banner:       mainData.banner       || null,
      noticeUpdate: noticeData.update     || [],
      noticeOps:    noticeData.ops        || []
    }
  };
}


// ──────────────────────────────────────────────────────────────
// 빠른바로가기 + 슬라이더카드 + 배너 저장
// ──────────────────────────────────────────────────────────────
function saveQcSettings(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };

  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); }
  catch(e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  const props = PropertiesService.getScriptProperties();

  let existing = {};
  try { existing = JSON.parse(props.getProperty('QC_QUICK_CARDS') || '{}'); } catch(e) {}

  const toSave = {
    quick:  incoming.quick  || existing.quick  || [],
    cards:  incoming.cards  || existing.cards  || [],
    banner: incoming.banner || existing.banner || null
  };

  props.setProperty('QC_QUICK_CARDS', JSON.stringify(toSave));
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// 공지사항 저장 (업데이트내역 + 운영안내)
// ──────────────────────────────────────────────────────────────
function saveQcNoticeSettings(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };

  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); }
  catch(e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  const props = PropertiesService.getScriptProperties();

  const toSave = {
    update: incoming.noticeUpdate || [],
    ops:    incoming.noticeOps    || []
  };

  props.setProperty('QC_NOTICE', JSON.stringify(toSave));
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// 배너 설정만 저장 (인사말 / 역할별 호칭 / 부제목)
// ──────────────────────────────────────────────────────────────
function saveQcBannerSettings(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };

  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); }
  catch(e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  const props = PropertiesService.getScriptProperties();

  let existing = {};
  try { existing = JSON.parse(props.getProperty('QC_QUICK_CARDS') || '{}'); } catch(e) {}

  existing.banner = incoming.banner || {};
  props.setProperty('QC_QUICK_CARDS', JSON.stringify(existing));

  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// 유틸: 저장된 전체 데이터 확인용 (개발/디버그)
// ──────────────────────────────────────────────────────────────
function debugPrintAllSettings() {
  const props = PropertiesService.getScriptProperties();
  const all   = props.getProperties();
  Logger.log(JSON.stringify(all, null, 2));
}

function resetAllQcSettings() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('QC_QUICK_CARDS');
  props.deleteProperty('QC_NOTICE');
  Logger.log('QC 설정 전체 초기화 완료');
}


// ══════════════════════════════════════════════════════════════
// 1차 기록용 구글시트 (Notion → 시트 → GitHub 2단계 동기화의 저장소)
// ══════════════════════════════════════════════════════════════

// 기본 시트 ID (사용자가 미리 준비한 시트). QC_SHEET_ID 속성이 없으면
// 이 값을 쓰고, 그 시트에 접근이 안 되면 새로 만들어서 속성에 저장한다.
const QC_DEFAULT_SHEET_ID = '1kNSuVdErRBTF1W8egzQ7Q0So5ucdl2EvrIomudQFVnk';

function setupQcSheetId(sheetId) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('QC_SHEET_ID', sheetId || QC_DEFAULT_SHEET_ID);
  Logger.log('QC_SHEET_ID 저장 완료: ' + props.getProperty('QC_SHEET_ID'));
}

function getQcSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('QC_SHEET_ID') || QC_DEFAULT_SHEET_ID;
  try {
    const ss = SpreadsheetApp.openById(id);
    props.setProperty('QC_SHEET_ID', id);
    return ss;
  } catch (e) {
    const ss = SpreadsheetApp.create('QC_1차기록_백업');
    props.setProperty('QC_SHEET_ID', ss.getId());
    return ss;
  }
}

function sanitizeSheetName(name) {
  let s = String(name || 'sheet').replace(/[\[\]\*\?\/\\:]/g, '_');
  if (s.length > 100) s = s.substring(0, 100);
  return s || 'sheet';
}

function cellEncode(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v) || (typeof v === 'object')) return JSON.stringify(v);
  return v;
}

function cellDecode(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'string' && (v.charAt(0) === '[' || v.charAt(0) === '{')) {
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  return v;
}

function recordsToSheetRows(records) {
  const headerSet = {};
  const header = [];
  records.forEach(function (r) {
    Object.keys(r).forEach(function (k) {
      if (!headerSet[k]) { headerSet[k] = true; header.push(k); }
    });
  });
  const rows = records.map(function (r) {
    return header.map(function (k) { return cellEncode(r[k]); });
  });
  return { header: header, rows: rows };
}

// 섹션(=시트 탭) 하나를 통째로 덮어쓴다. Notion 조회 직후 바로 호출해서
// 이후 단계(GitHub 업로드)가 실패해도 이 시점 데이터는 보존되게 한다.
function writeSectionToSheet(sectionName, records) {
  const ss    = getQcSpreadsheet();
  const name  = sanitizeSheetName(sectionName);
  let sheet   = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.clearNotes();

  if (!records || !records.length) {
    sheet.getRange(1, 1).setValue('(데이터 없음)');
    sheet.getRange(1, 1).setNote('마지막 확인: ' + new Date().toISOString());
    return;
  }

  const built  = recordsToSheetRows(records);
  const values = [built.header].concat(built.rows);
  sheet.getRange(1, 1, values.length, built.header.length).setValues(values);
  sheet.getRange(1, 1).setNote('마지막 기록: ' + new Date().toISOString() + ' (' + records.length + '건)');

  PropertiesService.getScriptProperties().setProperty('QC_SHEET_LAST_WRITE_' + name, new Date().toISOString());
}

// 시트 탭 하나를 레코드 배열로 되읽는다 (GitHub 발행 단계에서 사용 — Notion 재조회 없음).
function readSectionFromSheet(sectionName) {
  const ss    = getQcSpreadsheet();
  const name  = sanitizeSheetName(sectionName);
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0];
  return values.slice(1)
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      const obj = {};
      header.forEach(function (h, i) { if (h) obj[h] = cellDecode(row[i]); });
      return obj;
    });
}


// ══════════════════════════════════════════════════════════════
// 노션 연동 (API 키는 Script Properties에서 관리)
// ══════════════════════════════════════════════════════════════

function setupNotionCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('NOTION_API_KEY',  '여기에_노션_API_키_입력');
  props.setProperty('NOTION_DB_가전',  '2308bca2-d219-80ed-8d7e-000be570b99b');
  Logger.log('노션 인증 정보 저장 완료');
}

function notionRequest(path, method, body) {
  const props  = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('NOTION_API_KEY');
  if (!apiKey) throw new Error('NOTION_API_KEY가 Script Properties에 없습니다. setupNotionCredentials()를 실행하세요.');

  const options = {
    method:      method || 'GET',
    headers:     {
      'Authorization':  'Bearer ' + apiKey,
      'Notion-Version': '2022-06-28',
      'Content-Type':   'application/json',
    },
    muteHttpExceptions: true,
  };
  if (body) options.payload = JSON.stringify(body);

  const res  = UrlFetchApp.fetch('https://api.notion.com/v1' + path, options);
  const json = JSON.parse(res.getContentText());
  if (json.object === 'error') throw new Error('Notion API error: ' + json.message);
  return json;
}

function queryNotionDB(dbId, filter) {
  const pages  = [];
  let cursor   = undefined;
  let hasMore  = true;

  while (hasMore) {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const res = notionRequest('/databases/' + dbId + '/query', 'POST', body);
    pages.push(...(res.results || []));
    hasMore = res.has_more;
    cursor  = res.next_cursor;
  }
  return pages;
}

function notionPageToRecord(page) {
  const p = page.properties;
  function sel(prop)   { return prop?.select?.name || null; }
  function msel(prop)  { return (prop?.multi_select || []).map(x => x.name); }
  function date(prop)  { return prop?.date?.start || null; }

  const 접수일 = date(p['접수일']);
  if (!접수일) return null;

  const 구분 = sel(p['구분']);
  const validGubun = ['자재출고', '교환/환불', '수리출고'];
  if (!validGubun.includes(구분)) return null;

  const 진행상황 = sel(p['진행상황']);
  if (['수리제외', '취소'].includes(진행상황)) return null;

  return {
    접수일,
    제품명:   sel(p['제품명']),
    구분,
    확인불량: msel(p['확인불량']),
    접수불량: msel(p['접수불량']),
    유무상:   sel(p['유/무상']),
    과실:     sel(p['과실']),
    진행상황,
    업무단계: p['업무단계']?.status?.name || null,
  };
}

function getQcDefectData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_가전') || '2308bca2-d219-80ed-8d7e-000be570b99b';

  const filter = {
    and: [
      { property: '접수일', date: { on_or_after: '2026-01-01' } }
    ]
  };

  const pages   = queryNotionDB(dbId, filter);
  const records = pages.map(notionPageToRecord).filter(Boolean);

  return { ok: true, records };
}

function getQcImproveStatus() {
  const props = PropertiesService.getScriptProperties();
  let improve = {};
  try { improve = JSON.parse(props.getProperty('QC_IMPROVE_STATUS') || '{}'); } catch(e) {}
  return { ok: true, improve };
}

function saveQcImproveStatus(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };
  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); }
  catch(e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('QC_IMPROVE_STATUS', JSON.stringify(incoming.improve || {}));
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// 노션 → 구글시트(1차 기록) → GitHub qc_data.json (2단계 동기화)
// ──────────────────────────────────────────────────────────────

// 1단계: Notion 조회. 섹션 하나가 끝날 때마다 즉시 시트에 기록해서
// 이후 실행이 죽어도(시간초과 등) 이미 가져온 데이터는 보존되게 한다.
function syncQcData() {
  const props   = PropertiesService.getScriptProperties();
  const ghToken = props.getProperty('GITHUB_TOKEN');
  if (!ghToken) return { ok: false, msg: 'GITHUB_TOKEN이 Script Properties에 없습니다.' };

  const errors = [];

  function fetchSection(sheetKey, label, fn) {
    try {
      const records = fn();
      writeSectionToSheet(sheetKey, records);
      return records;
    } catch (e) {
      errors.push(label + ': ' + e.message);
      return null;
    }
  }

  fetchSection('가전', '가전', function () {
    const dbId  = props.getProperty('NOTION_DB_가전') || '2308bca2-d219-80d6-aaec-c3140f8923e3';
    const filter = { and: [{ property: '접수일', date: { on_or_after: '2026-01-01' } }] };
    return queryNotionDB(dbId, filter).map(notionPageToRecord).filter(Boolean);
  });

  fetchSection('반품처리', '반품처리', function () {
    const dbId2 = props.getProperty('NOTION_DB_반품처리') || '3508bca2-d219-80ef-ab71-e1da4fab4f95';
    return queryNotionDB(dbId2).map(returnPageToRecord).filter(Boolean);
  });

  fetchSection('택배출고', '택배출고', function () {
    const dbId3 = props.getProperty('NOTION_DB_택배출고') || '2778bca2-d219-8008-abae-efbb268908b3';
    return queryNotionDB(dbId3).map(taekbaePageToRecord).filter(function (r) { return r.상태 !== '출력요청'; });
  });

  fetchSection('처리현황', '처리현황', function () {
    const filterC = { property: '처리일', date: { on_or_after: '2026-01-01' } };
    const dbIdC   = props.getProperty('NOTION_DB_가전') || '2308bca2-d219-80d6-aaec-c3140f8923e3';
    return queryNotionDB(dbIdC, filterC).map(cheoriPageToRecord).filter(Boolean);
  });

  fetchSection('가전외AS', '가전외AS', function () {
    const dbId4 = props.getProperty('NOTION_DB_가전외AS') || '26dfe695-ce53-4030-886f-5cd5bd62439e';
    return queryNotionDB(dbId4).map(matPageToRecord).filter(Boolean);
  });

  fetchSection('반품마감', '반품마감', function () {
    const dbId5 = props.getProperty('NOTION_DB_반품마감') || '3038bca2-d219-80d8-a918-ee2a4c8adf7e';
    return queryNotionDB(dbId5).map(banpumMagamPageToRecord).filter(Boolean);
  });

  fetchSection('반품율', '반품율', function () {
    const dbId6 = props.getProperty('NOTION_DB_반품율') || '3228bca2-d219-80a0-868f-f01f110dad5e';
    return queryNotionDB(dbId6).map(banpumRatePageToRecord).filter(Boolean);
  });

  fetchSection('반품검사', '반품검사', function () {
    const dbId7  = props.getProperty('NOTION_DB_반품검사') || '368b2a3c-b665-45fc-9a31-4b20efe159c5';
    const filter7 = { property: '등록일자', date: { on_or_after: '2026-01-01' } };
    return queryNotionDB(dbId7, filter7).map(banpumInspectionPageToRecord).filter(Boolean);
  });

  fetchSection('휴가일정', '휴가일정', function () {
    const dbId8  = props.getProperty('NOTION_DB_휴가일정') || '62942d1e-9909-41c5-8bbc-1e2ebc4f2afe';
    const filter8 = { property: '휴가시작/종료', date: { on_or_after: '2026-01-01' } };
    return queryNotionDB(dbId8, filter8).map(vacationPageToRecord).filter(Boolean);
  });

  try { syncUsers(); } catch (e) { errors.push('직원목록: ' + e.message); }

  // 2단계: 시트에 방금 기록된 값을 기준으로 GitHub 발행 (Notion 재조회 없음)
  const publishResult = publishQcDataToGithub();

  if (!publishResult.ok) {
    const msg = 'Notion→시트 기록은 완료됨. GitHub 발행 실패: ' + publishResult.msg
      + (errors.length ? ' | Notion 조회 오류: ' + errors.join(', ') : '');
    return { ok: false, msg: msg, sheetSaved: true };
  }

  const summary = publishResult.summary + (errors.length ? ' | 오류: ' + errors.join(', ') : '');
  props.setProperty('QC_LAST_SYNC_TIME', new Date().toISOString());
  props.setProperty('QC_LAST_SYNC_SUMMARY', summary);
  return { ok: true, summary };
}

// 2단계 단독: 구글시트(1차 기록)를 읽어 qc_data.json을 만들고 GitHub에 올린다.
// Notion을 전혀 조회하지 않으므로, GitHub 업로드만 실패했을 때 이 함수만
// 다시 실행하면 된다 (Apps Script 편집기 실행 버튼, 또는 ?action=publishQcDataToGithub).
function publishQcDataToGithub() {
  const props   = PropertiesService.getScriptProperties();
  const ghToken = props.getProperty('GITHUB_TOKEN');
  const ghOwner = props.getProperty('GITHUB_OWNER') || 'ggumbi-cs';
  const ghRepo  = props.getProperty('GITHUB_REPO')  || 'dashboard';
  const ghPath  = 'qc/qc_data.json';

  if (!ghToken) return { ok: false, msg: 'GITHUB_TOKEN이 Script Properties에 없습니다.' };

  const sectionKeys = ['가전', '반품처리', '택배출고', '처리현황', '가전외AS', '반품마감', '반품율', '반품검사', '휴가일정'];
  const now = new Date().toISOString();
  const payload = { lastSynced: now };
  sectionKeys.forEach(function (k) {
    // 섹션별 lastSynced도 남겨둔다 — 프론트의 수동동기화(qc/수동동기화/*.json) 오버레이가
    // 이 값과 비교해서 어느 쪽이 더 최신인지 판단하는 데 쓰인다.
    payload[k] = { records: readSectionFromSheet(k), lastSynced: now };
  });

  const content = Utilities.base64Encode(JSON.stringify(payload, null, 2), Utilities.Charset.UTF_8);

  const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${ghPath}`;
  let sha = null;
  try {
    const existing = JSON.parse(UrlFetchApp.fetch(apiUrl, {
      headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json' },
      muteHttpExceptions: true
    }).getContentText());
    if (existing.sha) sha = existing.sha;
  } catch (e) {}

  const body = {
    message: `sync: QC 데이터 통합 업데이트 ${new Date().toLocaleString('ko-KR')}`,
    content
  };
  if (sha) body.sha = sha;

  const res    = UrlFetchApp.fetch(apiUrl, {
    method:  'PUT',
    headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const result = JSON.parse(res.getContentText());

  if (result.content) {
    const summary = sectionKeys.map(function (k) { return `${k} ${payload[k].records.length}건`; }).join(' · ') + ' 동기화 완료 (시트 기준)';
    return { ok: true, summary };
  } else {
    return { ok: false, msg: 'GitHub 업로드 실패: ' + JSON.stringify(result) };
  }
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncQcData')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncQcData')
    .timeBased()
    .atHour(1)
    .everyDays(1)
    .create();

  Logger.log('매일 새벽 1시 syncQcData 트리거 등록 완료');
}

function setupGithubCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('GITHUB_TOKEN', '여기에_GitHub_PAT_입력');
  props.setProperty('GITHUB_OWNER', 'ggumbi-cs');
  props.setProperty('GITHUB_REPO',  'dashboard');
  Logger.log('GitHub 인증 정보 저장 완료');
}


// ══════════════════════════════════════════════════════════════
// 액션현황
// ══════════════════════════════════════════════════════════════
function getActionItems() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_액션현황') || '2ea8bca2-d219-8011-a957-000b96ef30f5';

  const filter = {
    property: '등록일',
    date:     { on_or_after: '2026-01-01' }
  };

  const pages   = queryNotionDB(dbId, filter);
  const records = pages.map(actionPageToRecord).filter(Boolean);
  return { ok: true, records };
}

function actionPageToRecord(page) {
  const p = page.properties;
  function sel(prop)   { return prop?.select?.name || null; }
  function msel(prop)  { return (prop?.multi_select || []).map(x => x.name); }
  function txt(prop)   { return (prop?.rich_text || []).map(x => x.plain_text).join('') || ''; }
  function ttl(prop)   { return (prop?.title || []).map(x => x.plain_text).join('') || ''; }
  function date(prop)  { return prop?.date?.start || null; }

  return {
    id:       page.id,
    url:      page.url,
    주제:     ttl(p['주제']),
    제품명:   sel(p['제품명']),
    step:     sel(p['Step.']),
    진행단계: sel(p['진행단계']),
    등록일:   date(p['등록일']),
    완료일:   date(p['완료일']),
    내용기준: txt(p['내용(기준)']),
    핵심키워드: msel(p['핵심키워드']),
    구분:     sel(p['구분']),
    버젼:     sel(p['버젼']),
    step1내용: txt(p['step1 내용']),
    step2내용: txt(p['step2 내용']),
    step3내용: txt(p['step3 내용']),
    step4내용: txt(p['step4 내용']),
    step5내용: txt(p['step5 내용']),
  };
}

function updateActionItem(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };

  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); }
  catch(e) { return { ok: false, msg: 'JSON parse error: ' + e }; }

  const { pageId, property, value, type } = incoming;
  if (!pageId || !property || value === undefined) return { ok: false, msg: 'missing fields' };

  const body = { properties: {} };
  if (type === 'text') {
    body.properties[property] = {
      rich_text: value ? [{ type:'text', text:{ content: value } }] : []
    };
  } else {
    body.properties[property] = { select: { name: value } };
  }

  notionRequest('/pages/' + pageId, 'PATCH', body);
  return { ok: true };
}

function getProductPriority() {
  const props = PropertiesService.getScriptProperties();
  let priority = [];
  try { priority = JSON.parse(props.getProperty('QC_PRODUCT_PRIORITY') || '[]'); } catch(e) {}
  return { ok: true, priority };
}

function saveProductPriority(rawData) {
  if (!rawData) return { ok: false, msg: 'no data' };
  let incoming;
  try { incoming = JSON.parse(decodeURIComponent(rawData)); } catch(e) { return { ok: false, msg: e.toString() }; }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('QC_PRODUCT_PRIORITY', JSON.stringify(incoming.priority || []));
  return { ok: true };
}


// ══════════════════════════════════════════════════════════════
// 반품입고 비용현황
// ══════════════════════════════════════════════════════════════
function getReturnCostData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_반품처리') || '3508bca2-d219-80ef-ab71-e1da4fab4f95';

  const pages   = queryNotionDB(dbId);
  const records = pages.map(returnPageToRecord).filter(Boolean);
  return { ok: true, records };
}

function returnPageToRecord(page) {
  const p = page.properties;
  function sel(prop)  { return prop?.select?.name || null; }
  function num(prop)  { return prop?.number || 0; }
  function ttl(prop)  { return (prop?.title || []).map(x => x.plain_text).join('') || ''; }
  function date(prop) { return prop?.date?.start || null; }
  function form(prop) { return prop?.formula?.number || 0; }

  return {
    id:       page.id,
    처리일:   date(p['처리일']),
    제품명:   sel(p['제품명']),
    처리결과: sel(p['처리결과']),
    처리수량: num(p['처리수량']),
    처리금액: form(p['처리금액']),
    비고:     ttl(p['비고']),
  };
}


// ══════════════════════════════════════════════════════════════
// 기타 메뉴
// ══════════════════════════════════════════════════════════════

// ── 자재발주 ──
function getZaejaeData() {
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_자재발주')||'3598bca2-d219-8014-a6cf-f703fb337648';
  const pages=queryNotionDB(dbId);
  const records=pages.map(p=>{
    const pr=p.properties;
    function sel(x){return x?.select?.name||null;}
    function txt(x){return(x?.rich_text||[]).map(t=>t.plain_text).join('')||'';}
    function ttl(x){return(x?.title||[]).map(t=>t.plain_text).join('')||'';}
    function dt(x){return x?.date?.start||null;}
    function fm(x){return x?.formula?.number||0;}
    return {id:p.id,url:p.url,건명:ttl(pr['건명']),진행상태:sel(pr['진행상태']),제품구분:sel(pr['제품구분']),기안일:dt(pr['기안일']),기안승인:dt(pr['기안승인']),입고일:dt(pr['입고일']),예상일정:dt(pr['예상일정']),문서제목:txt(pr['문서제목']),비고:txt(pr['비고']),경과일:fm(pr['경과일'])};
  });
  return {ok:true,records};
}
function updateZaejaeItem(rawData){
  if(!rawData)return{ok:false,msg:'no data'};
  let d; try{d=JSON.parse(decodeURIComponent(rawData));}catch(e){return{ok:false,msg:e.toString()};}
  const body={properties:{}};
  body.properties[d.property]={select:{name:d.value}};
  notionRequest('/pages/'+d.pageId,'PATCH',body);
  return{ok:true};
}

// ── 택배출고 ──
// 공통 페이지→레코드 변환기 (모델명 + 출고품 + 수식(내용조합) 지원)
function taekbaePageToRecord(p) {
  const pr=p.properties;
  function sel(x){return x?.select?.name||null;}
  function txt(x){return(x?.rich_text||[]).map(t=>t.plain_text).join('')||'';}
  function ttl(x){return(x?.title||[]).map(t=>t.plain_text).join('')||'';}
  function dt(x){return x?.date?.start||null;}
  function fmlStr(x){return x?.formula?.string||'';}
  return {
    id:p.id, url:p.url,
    고객명:ttl(pr['고객명']),
    상태:sel(pr['상태']),
    구분:sel(pr['구분']),
    모델명:sel(pr['모델명']),
    출고품:txt(pr['출고품']),
    수식내용조합:fmlStr(pr['수식(내용조합)']),
    연락처:txt(pr['연락처']),
    주소:txt(pr['주소']),
    송장번호:txt(pr['송장번호']),
    주문번호:txt(pr['주문번호']),
    택배사:sel(pr['택배사']),
    요청일:dt(pr['요청일']),
    출력일:dt(pr['출력일']),
    요청자:(pr['요청자']?.people||[]).map(u=>u.name).join(', ')||null
  };
}

function getTaekbaeData() {
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_택배출고')||'2778bca2-d219-8008-abae-efbb268908b3';
  const pages=queryNotionDB(dbId);
  const records=pages.map(taekbaePageToRecord);
  return {ok:true,records};
}
function updateTaekbaeItem(rawData){
  if(!rawData)return{ok:false,msg:'no data'};
  let d; try{d=JSON.parse(decodeURIComponent(rawData));}catch(e){return{ok:false,msg:e.toString()};}
  const body={properties:{}};
  if(d.type==='text') body.properties[d.property]={rich_text:d.value?[{type:'text',text:{content:d.value}}]:[]};
  else if(d.type==='date') body.properties[d.property]=d.value?{date:{start:d.value}}:{date:null};
  else if(d.type==='title') body.properties[d.property]={title:d.value?[{type:'text',text:{content:d.value}}]:[]};
  else if(d.type==='people') body.properties[d.property]=d.value?{people:[{object:'user',id:d.value}]}:{people:[]};
  else body.properties[d.property]={select:{name:d.value}};
  notionRequest('/pages/'+d.pageId,'PATCH',body);
  return{ok:true};
}

// ── 유상처리단가 ──
function getDangaData() {
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_유상단가')||'2478bca2-d219-8090-b5f8-d70fa383744b';
  const pages=queryNotionDB(dbId);
  const records=pages.map(p=>{
    const pr=p.properties;
    function sel(x){return x?.select?.name||null;}
    function txt(x){return(x?.rich_text||[]).map(t=>t.plain_text).join('')||'';}
    function ttl(x){return(x?.title||[]).map(t=>t.plain_text).join('')||'';}
    function num(x){return x?.number||0;}
    function fm(x){return x?.formula?.number||0;}
    return {id:p.id,url:p.url,접수증상:ttl(pr['접수증상(엄마감동)']),제품명:sel(pr['제품명(엄마감동)']),예상부품:txt(pr['예상부품(심SQ)']),자재단가:num(pr['자재단가(구매품질)']),소비자단가:num(pr['소비자단가(심SQ)']),공임:num(pr['공임(심SQ)']),예상작업:txt(pr['예상작업(심SQ)']),비고:txt(pr['비고']),최종견적:fm(pr['최종견적'])};
  });
  return {ok:true,records};
}

// ── 택배출고: 출력요청만 실시간 ──
function getTaekbaeRealtime() {
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_택배출고')||'2778bca2-d219-8008-abae-efbb268908b3';
  const filter={property:'상태',select:{equals:'출력요청'}};
  const pages=queryNotionDB(dbId,filter);
  const records=pages.map(taekbaePageToRecord);
  return{ok:true,records};
}

// ── 택배출고: 모델명 선택지 목록 조회 (Select 속성 옵션) ──
// 신규 모델명 값은 createTaekbaeItem 등록 시 Notion이 자동으로 옵션에 추가함
function getTaekbaeModels() {
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_택배출고')||'2778bca2-d219-8008-abae-efbb268908b3';
  const res=notionRequest('/databases/'+dbId);
  const opts=(res.properties && res.properties['모델명'] && res.properties['모델명'].select && res.properties['모델명'].select.options) || [];
  return {ok:true, models: opts.map(o=>o.name)};
}

// ── 택배출고: 신규등록 ──
function createTaekbaeItem(rawData) {
  if(!rawData)return{ok:false,msg:'no data'};
  let d; try{d=JSON.parse(decodeURIComponent(rawData));}catch(e){return{ok:false,msg:e.toString()};}
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_택배출고')||'2778bca2-d219-8008-abae-efbb268908b3';
  // 요청일은 항상 서버 기준 오늘 날짜로 자동 설정 (프론트에서 별도 입력받지 않음)
  const 오늘 = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const body={parent:{database_id:dbId},properties:{
    '고객명':{title:[{text:{content:d.고객명||''}}]},
    '출고품':{rich_text:d.출고품?[{text:{content:d.출고품}}]:[]},
    '연락처':{rich_text:d.연락처?[{text:{content:d.연락처}}]:[]},
    '주소':  {rich_text:d.주소?[{text:{content:d.주소}}]:[]},
    '주문번호':{rich_text:d.주문번호?[{text:{content:d.주문번호}}]:[]},
    '상태':  {select:{name:'출력요청'}},
    '요청일':{date:{start:오늘}},
  }};
  // 모델명: Select 속성 — 신규 값이면 Notion이 옵션을 자동 생성함
  if(d.모델명) body.properties['모델명']={select:{name:d.모델명}};
  if(d.택배사) body.properties['택배사']={select:{name:d.택배사}};
  if(d.요청자Id) body.properties['요청자']={people:[{object:'user',id:d.요청자Id}]};
  notionRequest('/pages','POST',body);
  return{ok:true, 요청일:오늘};
}

// ── 유상처리단가: 신규등록 ──
function createDangaItem(rawData) {
  if(!rawData)return{ok:false,msg:'no data'};
  let d; try{d=JSON.parse(decodeURIComponent(rawData));}catch(e){return{ok:false,msg:e.toString()};}
  const props=PropertiesService.getScriptProperties();
  const dbId=props.getProperty('NOTION_DB_유상단가')||'2478bca2-d219-8090-b5f8-d70fa383744b';
  const body={parent:{database_id:dbId},properties:{
    '접수증상(엄마감동)':{title:[{text:{content:d.접수증상||''}}]},
    '예상부품(심SQ)':   {rich_text:d.예상부품?[{text:{content:d.예상부품}}]:[]},
    '예상작업(심SQ)':   {rich_text:d.예상작업?[{text:{content:d.예상작업}}]:[]},
    '비고':             {rich_text:d.비고?[{text:{content:d.비고}}]:[]},
    '공임(심SQ)':       {number:d.공임||0},
    '소비자단가(심SQ)': {number:d.소비자단가||0},
  }};
  if(d.제품명) body.properties['제품명(엄마감동)']={select:{name:d.제품명}};
  notionRequest('/pages','POST',body);
  return{ok:true};
}

// ── 노션 워크스페이스 멤버 목록 ──
function getNotionUsers() {
  const users = [];
  let cursor = null;
  do {
    const path = '/users' + (cursor ? '?start_cursor=' + cursor : '');
    const res  = notionRequest(path);
    (res.results || []).forEach(u => {
      if (u.type === 'person') {
        users.push({ id: u.id, name: u.name });
      }
    });
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return { ok: true, users };
}


// ══════════════════════════════════════════════════════════════
// 직원 목록 동기화 → qc/users.json
// ══════════════════════════════════════════════════════════════
function syncUsers() {
  const props   = PropertiesService.getScriptProperties();
  const ghToken = props.getProperty('GITHUB_TOKEN');
  const ghOwner = props.getProperty('GITHUB_OWNER') || 'ggumbi-cs';
  const ghRepo  = props.getProperty('GITHUB_REPO')  || 'dashboard';
  const ghPath  = 'qc/users.json';

  if (!ghToken) return { ok: false, msg: 'GITHUB_TOKEN 없음' };

  let users = [], cursor = null, hasMore = true;
  while (hasMore) {
    const path = cursor ? `/users?page_size=100&start_cursor=${cursor}` : '/users?page_size=100';
    const res  = notionRequest(path, 'GET');
    (res.results || []).forEach(u => {
      if (u.type === 'person') {
        users.push({ id: u.id, name: u.name || '' });
      }
    });
    hasMore = res.has_more;
    cursor  = res.next_cursor;
  }

  // 직원 목록도 1차로 시트에 기록해둔다 (GitHub 업로드 실패 대비)
  try { writeSectionToSheet('users', users); } catch (e) {}

  const payload = { lastSynced: new Date().toISOString(), users };
  const content = Utilities.base64Encode(JSON.stringify(payload, null, 2), Utilities.Charset.UTF_8);

  const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${ghPath}`;
  let sha = null;
  try {
    const ex = JSON.parse(UrlFetchApp.fetch(apiUrl, {
      headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json' },
      muteHttpExceptions: true
    }).getContentText());
    if (ex.sha) sha = ex.sha;
  } catch(e) {}

  const body = { message: `sync: 직원목록 업데이트 ${new Date().toLocaleString('ko-KR')}`, content };
  if (sha) body.sha = sha;

  const r = UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const result = JSON.parse(r.getContentText());
  return result.content
    ? { ok: true, count: users.length }
    : { ok: false, msg: JSON.stringify(result) };
}

// ══════════════════════════════════════════════════════════════
// 처리현황 (가전 DB — 처리 관점) · 가전외 AS(매트류)
// ══════════════════════════════════════════════════════════════

// ── 가전 DB → 처리현황 관점 레코드 변환기 ──
// (불량현황의 notionPageToRecord와 달리 처리일/입고일/사용부품/소요일/유상AS비용 포함)
function cheoriPageToRecord(page) {
  const p = page.properties;
  function sel(prop)  { return prop?.select?.name || null; }
  function msel(prop) { return (prop?.multi_select || []).map(x => x.name); }
  function date(prop) { return prop?.date?.start || null; }
  function fm(prop)   { return (prop && prop.formula && typeof prop.formula.number === 'number') ? prop.formula.number : null; }
  function num(prop)  { return prop?.number || 0; }

  const 처리일 = date(p['처리일']);
  if (!처리일) return null;

  const 진행상황 = sel(p['진행상황']);
  if (['수리제외', '취소'].includes(진행상황)) return null;

  return {
    제품명:     sel(p['제품명']),
    구분:       sel(p['구분']),
    처리일,
    입고입금일: date(p['입고(입금)일']),
    유무상:     sel(p['유/무상']),
    접수불량:   msel(p['접수불량']),
    사용부품:   msel(p['사용부품']),
    소요일:     fm(p['소요일']),
    유상AS비용: num(p['유상AS비용']),
    과실:       sel(p['과실']),
    진행상황,
  };
}

function getCheoriData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_가전') || '2308bca2-d219-80d6-aaec-c3140f8923e3';
  const filter = { property: '처리일', date: { on_or_after: '2026-01-01' } };
  const pages   = queryNotionDB(dbId, filter);
  const records = pages.map(cheoriPageToRecord).filter(Boolean);
  return { ok: true, records };
}

// ── 가전 외 AS(매트류) DB → 레코드 변환기 ──
function matPageToRecord(page) {
  const p = page.properties;
  function sel(prop)  { return prop?.select?.name || null; }
  function msel(prop) { return (prop?.multi_select || []).map(x => x.name); }
  function date(prop) { return prop?.date?.start || null; }
  function num(prop)  { return prop?.number || 0; }
  function txt(prop)  { return (prop?.rich_text || []).map(x => x.plain_text).join('') || ''; }
  function pttl(prop) { return prop?.title ? (prop.title || []).map(x => x.plain_text).join('') : ''; }

  const 진행사항 = sel(p['진행사항']);
  if (진행사항 === '취소') return null;

  return {
    상품명:     p['상품명']?.type === 'title' ? pttl(p['상품명']) : txt(p['상품명']),
    상품구분:   sel(p['상품구분']),
    비용:       num(p['비용']),
    유무상:     sel(p['유/무상']),
    접수일자:   date(p['접수일자']),
    완료일자:   date(p['완료일자']),
    수리방법:   msel(p['수리방법']),
    진행사항,
  };
}

function getMatAsData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_가전외AS') || '26dfe695-ce53-4030-886f-5cd5bd62439e';
  const pages   = queryNotionDB(dbId);
  const records = pages.map(matPageToRecord).filter(Boolean);
  return { ok: true, records };
}


// ══════════════════════════════════════════════════════════════
// 반품현황 — 반품·교환 마감집계 / 반품·교환율 / 반품검사(모델·처리결과)
// ══════════════════════════════════════════════════════════════

// ── DB1: 꿈비/소브 반품,교환 월마감 (사유별 건수 집계, 가전/가전외) ──
function banpumMagamPageToRecord(page) {
  const p = page.properties;
  function sel(prop) { return prop?.select?.name || null; }
  function num(prop) { return prop?.number || 0; }
  function ttl(prop) { return (prop?.title || []).map(x => x.plain_text).join('') || ''; }

  return {
    구분:     sel(p['구분']),        // 꿈비 / 소브
    마감회차: sel(p['마감회차']),    // 월간: "26.01월" / 주간: "260619"
    사유:     sel(p['사유']),
    교환반품: sel(p['교환/반품']),   // 교환 / 반품
    주월:     sel(p['주/월']),       // 월간 / 주간
    품목:     sel(p['품목']),        // 가전 / 가전외
    건수:     num(p['건수']),
    비고:     ttl(p['비고']),
  };
}

function getBanpumMagamData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_반품마감') || '3038bca2-d219-80d8-a918-ee2a4c8adf7e';
  const pages   = queryNotionDB(dbId);
  const records = pages.map(banpumMagamPageToRecord).filter(Boolean);
  return { ok: true, records };
}

// ── DB2: 반품/교환율 (월간, 꿈비/소브 각각 기록 — 프론트에서 합산해서 사용) ──
function banpumRatePageToRecord(page) {
  const p = page.properties;
  function sel(prop) { return prop?.select?.name || null; }
  function num(prop) { return prop?.number || 0; }
  function ttl(prop) { return (prop?.title || []).map(x => x.plain_text).join('') || ''; }

  return {
    구분:         sel(p['구분']),          // 꿈비 / 소브
    마감월:       sel(p['마감월']),        // "26.01월" ~
    월간배송수량: num(p['월간 배송수량']),
    월간교환반품수량: num(p['월간 교환/반품 수량']),
    반품교환율:   num(p['반품/교환율']),   // 원본 수식값(소수, 예 0.0234 = 2.34%) — 참고용, 합산 계산은 프론트에서 재계산
    비고:         ttl(p['비고']),
  };
}

function getBanpumRateData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_반품율') || '3228bca2-d219-80a0-868f-f01f110dad5e';
  const pages   = queryNotionDB(dbId);
  const records = pages.map(banpumRatePageToRecord).filter(Boolean);
  return { ok: true, records };
}

// ── DB3: 📦 반품검사 현황 (모델별 · 반품유형별 · 이동/처리 결과) ──
function banpumInspectionPageToRecord(page) {
  const p = page.properties;
  function sel(prop)  { return prop?.select?.name || null; }
  function date(prop) { return prop?.date?.start || null; }
  function txt(prop)  { return prop?.text || ''; } // 제품명/고객명은 plain text 속성

  return {
    제품명:     p['제품명']?.rich_text ? (p['제품명'].rich_text||[]).map(x=>x.plain_text).join('') : '',
    반품유형:   sel(p['반품유형']),   // 일반반품/변심반품/불량반품/불량교환/AS/검수
    검사결과:   sel(p['검사결과']),
    이동처리:   sel(p['이동/처리']), // 안성물류이동(재상품화)/안성폐기/자체폐기/원자재화/미선택
    등록일자:   date(p['등록일자']),
    리포트구분: sel(p['리포트 구분']),
    리포트판정: sel(p['리포트 판정']),
  };
}

function getBanpumInspectionData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_반품검사') || '368b2a3c-b665-45fc-9a31-4b20efe159c5';
  const filter = { property: '등록일자', date: { on_or_after: '2026-01-01' } };
  const pages   = queryNotionDB(dbId, filter);
  const records = pages.map(banpumInspectionPageToRecord).filter(Boolean);
  return { ok: true, records };
}


// ══════════════════════════════════════════════════════════════
// 휴가 및 일정관리 (전사공용 DB — 조회 전용)
//   - '휴가자' 속성은 Notion에서 created_by 타입(자동/읽기전용)이라
//     API로 값을 지정할 수 없음 → 대시보드에서 신규등록 기능은 제공하지 않음.
//   - 조회는 syncQcData(새벽1시 자동)로 qc_data.json에 반영, 대시보드는 정적 로딩.
// ══════════════════════════════════════════════════════════════
function vacationPageToRecord(page) {
  const p = page.properties;
  function sel(prop)    { return prop?.select?.name || null; }
  function ttl(prop)    { return (prop?.title || []).map(x => x.plain_text).join('') || ''; }
  function txt(prop)    { return (prop?.rich_text || []).map(x => x.plain_text).join('') || ''; }
  function num(prop)    { return (typeof prop?.number === 'number') ? prop.number : 0; }
  function people(prop) { return (prop?.people || []).map(u => u.name).filter(Boolean); }
  function createdBy(prop) { return prop?.created_by?.name || null; }

  const dateProp = p['휴가시작/종료'];

  return {
    id:         page.id,
    url:        page.url,
    제목:       ttl(p['휴가사유']),
    휴가자:     createdBy(p['휴가자']),
    휴가유형:   sel(p['휴가유형']),
    시작일:     dateProp?.date?.start || null,
    종료일:     dateProp?.date?.end   || null,
    휴가일수:   num(p['휴가일수']),
    팀명:       sel(p['팀명']),
    부서장:     people(p['부서장']),
    팀장파트장: people(p['팀장/파트장']),
    참조:       people(p['참조']),
    팀참조:     txt(p['팀참조']),
    생성일시:   page.created_time || null,
  };
}

function getVacationData() {
  const props = PropertiesService.getScriptProperties();
  const dbId  = props.getProperty('NOTION_DB_휴가일정') || '62942d1e-9909-41c5-8bbc-1e2ebc4f2afe';
  const filter = { property: '휴가시작/종료', date: { on_or_after: '2026-01-01' } };
  const pages   = queryNotionDB(dbId, filter);
  const records = pages.map(vacationPageToRecord).filter(Boolean);
  return { ok: true, records };
}
