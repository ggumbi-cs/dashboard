// =========================
// 모듈 로딩
// =========================
async function loadModule(targetId, file) {
    const target = document.getElementById(targetId);

    const res = await fetch(file);
    const html = await res.text();
    target.innerHTML = html;

    if (file === "as.html") {
        initASModule();
    }
}


// =========================
// AS 모듈
// =========================
function initASModule() {

    let rawData = [];

    const productEl = document.getElementById("product");
    const symptomEl = document.getElementById("symptom");
    const fileInputEl = document.getElementById("fileInput");
    const statusEl = document.getElementById("status");
    const resultBox = document.getElementById("resultBox");
    const dropZone = document.getElementById("dropZone");


    // =========================
    // CSV 파싱
    // =========================
    function parseCSV(text) {
        const rows = [];
        let row = [];
        let value = "";
        let insideQuote = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                row.push(value);
                value = "";
            } else if ((char === '\n' || char === '\r') && !insideQuote) {
                if (value || row.length) {
                    row.push(value);
                    rows.push(row);
                    row = [];
                    value = "";
                }
            } else {
                value += char;
            }
        }

        if (value || row.length) {
            row.push(value);
            rows.push(row);
        }

        const headers = rows[0].map(h => h.trim());

        return rows.slice(1).map(r => {
            let obj = {};
            headers.forEach((h, i) => {
                obj[h] = r[i] ? r[i].trim() : "";
            });
            return obj;
        });
    }


    function parseDate(str) {
        const nums = String(str).match(/\d+/g);
        if (!nums || nums.length < 3) return null;
        return new Date(nums[0], nums[1] - 1, nums[2]);
    }


    function preprocess(data) {
        return data.filter(row => {
            const date = parseDate(row["접수일"]);
            return (
                date &&
                date >= new Date(2026, 0, 1) &&
                String(row["구분"]).trim() === "수리출고" &&
                String(row["제품명"]).trim() !== "" &&
                String(row["접수불량"]).trim() !== "" &&
                String(row["사용부품"]).trim() !== ""
            );
        });
    }


    function updateProducts() {
        const list = [...new Set(rawData.map(d => d["제품명"]))].sort();

        productEl.innerHTML = "<option>선택</option>";
        list.forEach(v => {
            productEl.innerHTML += `<option>${v}</option>`;
        });
    }


    productEl.addEventListener("change", () => {
        const prod = productEl.value;

        const list = [...new Set(
            rawData
            .filter(d => d["제품명"] === prod)
            .map(d => d["접수불량"])
        )];

        symptomEl.innerHTML = "<option>선택</option>";
        list.forEach(v => {
            symptomEl.innerHTML += `<option>${v}</option>`;
        });

        resultBox.innerHTML = "";
    });


    symptomEl.addEventListener("change", () => {

        const prod = productEl.value;
        const sym = symptomEl.value;

        const filtered = rawData.filter(d =>
            d["제품명"] === prod &&
            d["접수불량"] === sym
        );

        const total = filtered.length;

        const counts = {};
        filtered.forEach(d => {
            counts[d["사용부품"]] = (counts[d["사용부품"]] || 0) + 1;
        });

        let html = `
        <div style="font-size:16px; font-weight:bold;">📦 ${prod}</div>
        <div style="margin-bottom:10px; color:#666;">⚠️ ${sym} (${total}건)</div>
        `;

        Object.entries(counts).forEach(([part, count]) => {
            const percent = Math.round(count / total * 100);

            html += `
            <div style="
                margin-bottom:8px;
                padding:10px;
                border-radius:6px;
                background:#fff;
                border:1px solid #ddd;
            ">
                <div style="font-weight:bold;">${part}</div>
                <div style="color:#007bff; font-weight:bold;">${percent}%</div>
            </div>
            `;
        });

        resultBox.innerHTML = html;
    });


    // =========================
    // 공통 파일 처리
    // =========================
    function handleFile(file) {

        if (!file) return;

        statusEl.textContent = `${file.name} 로딩중...`;

        const reader = new FileReader();

        reader.onload = function(evt) {

            const parsed = parseCSV(evt.target.result);
            rawData = preprocess(parsed);

            updateProducts();

            statusEl.textContent = `완료: ${rawData.length}건`;
        };

        reader.readAsText(file, "utf-8");
    }


    // =========================
    // 파일 선택
    // =========================
    fileInputEl.addEventListener("change", e => {
        handleFile(e.target.files[0]);
    });


    // =========================
    // 드래그 업로드
    // =========================
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.style.borderColor = "#007bff";
        dropZone.style.background = "#f0f8ff";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#ccc";
        dropZone.style.background = "";
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();

        dropZone.style.borderColor = "#ccc";
        dropZone.style.background = "";

        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

}


// =========================
loadModule("panel-1", "as.html");