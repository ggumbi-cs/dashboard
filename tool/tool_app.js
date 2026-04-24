console.log("JS 로드됨");

// =========================
// 공통 데이터
// =========================
let globalCSVData = [];

// =========================
// CSV 파싱 (쉼표/따옴표 대응)
// =========================
function parseCSV(text) {
    const lines = text.split("\n").map(l => l.replace(/\r/g, ""));

    return lines.map(line => {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && nextChar === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    });
}

// =========================
// 날짜 파싱
// 파이썬 원본 parse_date 로직 대응
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
// 모듈 로드 함수
// 기존 구조 보존
// =========================
async function loadModule(targetId, file) {
    const target = document.getElementById(targetId);

    if (!target) return;

    try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`${file} 로드 실패`);

        const html = await res.text();
        target.innerHTML = html;

        if (file.includes("as.html")) {
            initASModule();
        }

        if (file.includes("as2.html")) {
            initTool2Module();
        }

    } catch (err) {
        console.error(err);
        target.innerHTML = "화면 로드 실패";
    }
}

// =========================
// AS 모듈
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

        // =========================
        // 컬럼 인덱스
        // Python 원본 기준:
        // 접수일 / 구분 / 제품명 / 접수불량 / 사용부품
        // =========================
        const dateIndex = 0;      // 접수일
        const typeIndex = 1;      // 구분
        const modelIndex = 2;     // 제품명
        const resultIndex = 7;    // 사용부품
        const symptomIndex = 9;   // 접수불량

        const startDate = new Date(2026, 0, 1);

        // =========================
        // 필터 기준
        // 1) 접수일 >= 2026-01-01
        // 2) 구분 == 수리출고
        // 3) 제품명 / 접수불량 / 사용부품 공란 제외
        // =========================
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

        console.log("전체 데이터:", rows.length - 1);
        console.log("필터 후 데이터:", filteredRows.length);

        // =========================
        // 모델 채우기
        // =========================
        const models = [...new Set(
            filteredRows
                .map(r => r[modelIndex])
                .filter(Boolean)
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

        // =========================
        // 모델 선택 → 접수불량 채우기
        // =========================
        modelSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;

            const modelFiltered = filteredRows.filter(r =>
                r[modelIndex] === selectedModel
            );

            const symptoms = [...new Set(
                modelFiltered
                    .map(r => r[symptomIndex])
                    .filter(Boolean)
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

        // =========================
        // 접수불량 선택 → 사용부품 확률 계산
        // Python calculate_probability 로직 대응
        // =========================
        symptomSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;
            const selectedSymptom = symptomSelect.value;

            if (!selectedModel || !selectedSymptom) {
                resultBox.innerHTML = "";
                return;
            }

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
                const part = r[resultIndex];
                if (!part) return;
                counts[part] = (counts[part] || 0) + 1;
            });

            const results = Object.entries(counts)
                .map(([part, count]) => {
                    const percent = Math.round((count / total) * 100);
                    return {
                        part,
                        count,
                        percent
                    };
                })
                .sort((a, b) => b.count - a.count);

            const compactResult = results
                .map(item => `${item.part} ${item.percent}%`)
                .join("  |  ");

            resultBox.innerHTML = `
                <div style="font-weight:bold; margin-bottom:4px;">모델: ${selectedModel}</div>
                <div style="font-size:12px; color:#666; margin-bottom:10px;">
                    증상: ${selectedSymptom} (데이터 ${total}건 분석)
                </div>
                <div style="font-weight:bold; color:#0078d4; margin-bottom:8px;">[예상 원인]</div>
                <div style="font-size:15px; font-weight:bold; color:#d13438;">
                    ${compactResult}
                </div>
            `;
        });

        // =========================
        // 상태 표시
        // =========================
        if (updateBox) {
            updateBox.innerText = `CSV 로드 완료 (${filteredRows.length}건)`;
        }

    } catch (err) {
        console.error(err);

        const updateBox = document.getElementById("updateTime");
        if (updateBox) {
            updateBox.innerText = "CSV 로드 실패";
        }
    }
}

// =========================
// Tool2 (기존 유지)
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
// iframe 내부 직접 실행 구조 대응
// =========================
if (document.getElementById("modelSelect")) {
    initASModule();
}

if (document.getElementById("typeSelect")) {
    initTool2Module();
}
