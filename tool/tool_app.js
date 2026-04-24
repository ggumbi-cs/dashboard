console.log("JS 로드됨");
// =========================
// 공통 데이터
// =========================
let globalCSVData = [];

// =========================
// CSV 파싱 (🔥 핵심 추가)
// =========================
function parseCSV(text) {
    const lines = text.split("\n").map(l => l.replace(/\r/g, ""));
    return lines.map(line => {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
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
// 모듈 로드 함수
// =========================
async function loadModule(targetId, file) {
    const target = document.getElementById(targetId);

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
    try {
        const csvUrl = "./../data/가전마감.csv";
        const res = await fetch(csvUrl);

        if (!res.ok) throw new Error("CSV 로드 실패");

        const text = await res.text();

        // 🔥 핵심 수정 (parseCSV 사용)
        const rows = parseCSV(text);

        globalCSVData = rows;

        const modelSelect = document.getElementById("modelSelect");
        const symptomSelect = document.getElementById("symptomSelect");
        const resultBox = document.getElementById("resultBox");

        if (!modelSelect || !symptomSelect || !resultBox) return;

        // 컬럼 인덱스
        const dateIndex = 0;
        const modelIndex = 2;
        const resultIndex = 7;
        const symptomIndex = 9;

        // 🔥 2026년 이후 필터
        const filteredRows = rows.slice(1).filter(r => {
            if (!r[dateIndex]) return false;
            return r[dateIndex].includes("2026");
        });

        // =========================
        // 모델 채우기
        // =========================
        const models = [...new Set(filteredRows.map(r => r[modelIndex]).filter(Boolean))];

        modelSelect.innerHTML = `<option value="">선택</option>`;

        models.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });

        // =========================
        // 모델 선택 → 증상
        // =========================
        modelSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;

            const modelFiltered = filteredRows.filter(r => r[modelIndex] === selectedModel);

            const symptoms = [...new Set(
                modelFiltered.map(r => r[symptomIndex]).filter(Boolean)
            )];

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
        // 증상 선택 → 결과 출력
        // =========================
        symptomSelect.addEventListener("change", () => {
            const selectedModel = modelSelect.value;
            const selectedSymptom = symptomSelect.value;

            const final = filteredRows.filter(r =>
                r[modelIndex] === selectedModel &&
                r[symptomIndex] === selectedSymptom
            );

            const results = [...new Set(
                final.map(r => r[resultIndex]).filter(Boolean)
            )];

            resultBox.innerHTML = results.length
                ? results.map(r => `• ${r}`).join("<br>")
                : "결과 없음";
        });

        // 상태 표시
        const updateBox = document.getElementById("updateTime");
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
// Tool2 (절대 유지)
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
