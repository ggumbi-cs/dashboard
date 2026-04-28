console.log("JS 로드됨");

// =========================
// 프레임 간 공유 채널
// =========================
const asToolChannel = new BroadcastChannel("as-tool-channel-v1");

function publishSharedMemo(memo, rankedParts) {
    asToolChannel.postMessage({
        memo: memo || "",
        rankedParts: Array.isArray(rankedParts) ? rankedParts : []
    });
}

function subscribeSharedMemo(handler) {
    asToolChannel.addEventListener("message", (event) => {
        const payload = event.data || {};
        handler(
            payload.memo || "",
            Array.isArray(payload.rankedParts) ? payload.rankedParts : []
        );
    });
}

// =========================
// 공통 데이터
// =========================
let globalCSVData = [];

// =========================
// CSV 파싱
// =========================
function parseCSV(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"' && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            row.push(current.trim());
            current = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") i++;
            row.push(current.trim());
            rows.push(row);
            row = [];
            current = "";
        } else {
            current += char;
        }
    }

    if (current || row.length) {
        row.push(current.trim());
        rows.push(row);
    }

    return rows;
}

// =========================
// 날짜 파싱
// =========================
function parseDateValue(value) {
    if (!value) return null;

    const nums = String(value).match(/\d+/g);
    if (!nums || nums.length < 3) return null;

    const year = Number(nums[0]);
    const month = Number(nums[1]) - 1;
    const day = Number(nums[2]);

    if (!year || month < 0 || !day) return null;

    return new Date(year, month, day);
}

// =========================
// 헤더명으로 컬럼 찾기
// =========================
function getColumnIndex(headers, name) {
    return headers.findIndex(h =>
        String(h).replace(/^\uFEFF/, "").trim() === name
    );
}

// =========================
// AS 모듈 (툴1)
// =========================
async function initASModule() {
    console.log("AS 모듈 시작");

    try {
        const csvUrl = "/dashboard/data/가전마감.csv";
        const res = await fetch(csvUrl);

        if (!res.ok) throw new Error("CSV 로드 실패");

        const text = await res.text();
        const rows = parseCSV(text);
        globalCSVData = rows;

        const modelSelect = document.getElementById("modelSelect");
        const symptomSelect = document.getElementById("symptomSelect");
        const resultBox = document.getElementById("resultBox");
        const updateBox = document.getElementById("updateTime");

        if (!modelSelect || !symptomSelect || !resultBox) return;

        const headers = rows[0].map(h => String(h).replace(/^\uFEFF/, "").trim());

        const dateIndex = getColumnIndex(headers, "접수일");
        const typeIndex = getColumnIndex(headers, "구분");
        const modelIndex = getColumnIndex(headers, "제품명");
        const symptomIndex = getColumnIndex(headers, "접수불량");
        const resultIndex = getColumnIndex(headers, "사용부품");

        if ([dateIndex, typeIndex, modelIndex, symptomIndex, resultIndex].some(i => i === -1)) {
            if (updateBox) updateBox.innerText = "CSV 필수 컬럼 없음";
            return;
        }

        const startDate = new Date(2026, 0, 1);

        const filteredRows = rows.slice(1).filter(r => {
            const dateValue = parseDateValue(r[dateIndex]);

            if (!dateValue) return false;
            if (dateValue < startDate) return false;
            if ((r[typeIndex] || "").trim() !== "수리출고") return false;
            if (!r[modelIndex]) return false;
            if (!r[symptomIndex]) return false;
            if (!r[resultIndex]) return false;

            return true;
        });

        const models = [...new Set(
            filteredRows.map(r => r[modelIndex]).filter(Boolean)
        )].sort();

        modelSelect.innerHTML = `<option value="">선택</option>`;
        symptomSelect.innerHTML = `<option value="">선택</option>`;
        resultBox.innerHTML = "";

        models.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });

        modelSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;

            const modelFiltered = filteredRows.filter(r =>
                r[modelIndex] === selectedModel
            );

            const symptoms = [...new Set(
                modelFiltered.map(r => r[symptomIndex]).filter(Boolean)
            )].sort();

            symptomSelect.innerHTML = `<option value="">선택</option>`;

            symptoms.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                symptomSelect.appendChild(opt);
            });

            resultBox.innerHTML = "";
        });

        symptomSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;
            const selectedSymptom = symptomSelect.value;

            const finalRows = filteredRows.filter(r =>
                r[modelIndex] === selectedModel &&
                r[symptomIndex] === selectedSymptom
            );

            const total = finalRows.length;

            if (total === 0) {
                resultBox.innerHTML = "데이터가 부족합니다.";
                return;
            }

            const counts = {};

            finalRows.forEach(r => {
                const raw = r[resultIndex];
                if (!raw) return;

                const parts = raw.split(/[,/+\|]/);

                parts.forEach(p => {
                    const part = p.trim();
                    if (!part) return;
                    counts[part] = (counts[part] || 0) + 1;
                });
            });

            const results = Object.entries(counts)
                .map(([part, count]) => ({
                    part,
                    count,
                    percent: Math.round((count / total) * 100)
                }))
                .sort((a, b) => b.count - a.count);

            const compactResult = results
                .map(item => `${item.part} ${item.percent}%`)
                .join("  |  ");
            const rankedParts = results.map(item => item.part);

            resultBox.innerHTML = `
                <div style="font-weight:bold;">모델: ${selectedModel}</div>
                <div style="font-size:12px; color:#666;">
                    증상: ${selectedSymptom} (데이터 ${total}건 분석)
                </div>
                <div style="font-weight:bold; color:#0078d4;">[예상 원인]</div>
                <div style="font-size:15px; font-weight:bold; color:#d13438;">
                    ${compactResult}
                </div>
            `;

            // 👉 툴3으로 전달 (기존 postMessage + 공용 채널)
            window.parent.postMessage({ memo: compactResult, rankedParts }, "*");
            publishSharedMemo(compactResult, rankedParts);
        });

        if (updateBox) {
            updateBox.innerText = `CSV 로드 완료 (${filteredRows.length}건)`;
        }

    } catch (err) {
        const updateBox = document.getElementById("updateTime");
        if (updateBox) updateBox.innerText = "CSV 로드 실패";
    }
}

// =========================
// Tool2 (그대로)
// =========================
function initTool2Module() {
    const typeSelect = document.getElementById("typeSelect");
    const subSelect = document.getElementById("subSelect");

    if (!typeSelect || !subSelect) return;

    const data = {
        "3종": ["분유쉐이커", "출수형포트", "LED쉐이커"],
        "기타": ["세척기", "소독기"]
    };

    typeSelect.innerHTML = `<option value="">선택</option>`;

    Object.keys(data).forEach(key => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        typeSelect.appendChild(opt);
    });

    typeSelect.addEventListener("change", () => {
        subSelect.innerHTML = `<option value="">선택</option>`;

        const selected = typeSelect.value;

        if (!data[selected]) return;

        data[selected].forEach(item => {
            const opt = document.createElement("option");
            opt.value = item;
            opt.textContent = item;
            subSelect.appendChild(opt);
        });
    });
}

// =========================
// 실행
// =========================
if (document.getElementById("modelSelect")) {
    initASModule();
}

if (document.getElementById("typeSelect")) {
    initTool2Module();
}
