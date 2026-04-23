// =========================
// 공통 데이터
// =========================
let globalCSVData = [];

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

        // 🔥 AS 모듈 초기화
        if (file.includes("as.html")) {
            initASModule();
        }

        // 🔥 Tool2는 그대로 유지
        if (file.includes("as2.html")) {
            initTool2Module();
        }

    } catch (err) {
        console.error(err);
        target.innerHTML = "화면 로드 실패";
    }
}

// =========================
// AS 모듈 초기화 (자동 CSV 로드)
// =========================
async function initASModule() {
    try {
        const csvUrl = "./../data/가전마감.csv"; // 🔥 GitHub 경로
        const res = await fetch(csvUrl);

        if (!res.ok) throw new Error("CSV fetch 실패");

        const text = await res.text();

        const rows = text.split("\n").map(r => r.split(","));
        globalCSVData = rows;

        const modelSelect = document.getElementById("modelSelect");

        if (!modelSelect) return;

        modelSelect.innerHTML = `<option value="">선택</option>`;

        const modelIndex = 2; // 제품명

        const models = [...new Set(rows.slice(1).map(r => r[modelIndex]))];

        models.forEach(m => {
            if (!m) return;
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });

        // 상태 표시
        const updateBox = document.getElementById("updateTime");
        if (updateBox) {
            updateBox.innerText = "GitHub CSV 자동 로드 완료";
        }

    } catch (err) {
        console.error("CSV 로딩 실패:", err);

        const updateBox = document.getElementById("updateTime");
        if (updateBox) {
            updateBox.innerText = "CSV 로드 실패";
        }
    }
}

// =========================
// Tool2 초기화 (절대 수정 없음)
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
loadModule("panel-1", "./as.html");
loadModule("panel-2", "./as2.html");
