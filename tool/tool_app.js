// =========================
// 모듈 로딩 (GitHub Pages 대응)
// =========================
async function loadModule(targetId, file) {
    const target = document.getElementById(targetId);

    try {
        const res = await fetch(file);
        if (!res.ok) throw new Error("HTML 로드 실패");

        const html = await res.text();
        target.innerHTML = html;

        if (file.includes("as.html")) {
            initASModule();
        }

    } catch (err) {
        console.error(err);
        target.innerHTML = "화면 로드 실패";
    }
}


// =========================
// AS 모듈
// =========================
function initASModule() {

    let rawData = [];

    const productEl = document.getElementById("product");
    const symptomEl = document.getElementById("symptom");
    const statusEl = document.getElementById("status");
    const resultBox = document.getElementById("resultBox");


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
            <div style="margin-bottom:8px;padding:10px;border-radius:6px;background:#fff;border:1px solid #ddd;">
                <div style="font-weight:bold;">${part}</div>
                <div style="color:#007bff; font-weight:bold;">${percent}%</div>
            </div>
            `;
        });

        resultBox.innerHTML = html;
    });


    // =========================
    // 🔥 GitHub CSV 자동 로드 (핵심)
    // =========================
    const csvUrl = "https://raw.githubusercontent.com/ggumbi-cs/dashboard/main/data/가전마감.csv";

    fetch(csvUrl)
        .then(res => {
            if (!res.ok) throw new Error("CSV 로드 실패");
            return res.text();
        })
        .then(text => {

            const parsed = parseCSV(text);
            rawData = preprocess(parsed);

            updateProducts();

            console.log("CSV OK:", rawData.length);
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = "데이터 로드 실패";
        });


    // =========================
    // 🔥 GitHub 업데이트 시간
    // =========================
    fetch("https://api.github.com/repos/ggumbi-cs/dashboard/commits?path=data/가전마감.csv")
        .then(res => res.json())
        .then(data => {

            const last = data[0].commit.author.date;
            const d = new Date(last);

            const timeStr =
                d.getFullYear() + "-" +
                String(d.getMonth()+1).padStart(2,"0") + "-" +
                String(d.getDate()).padStart(2,"0") + " " +
                String(d.getHours()).padStart(2,"0") + ":" +
                String(d.getMinutes()).padStart(2,"0");

            statusEl.textContent = `GitHub 자동 로드 완료 (${timeStr} 업데이트)`;
        });

}


// =========================
// 실행 (GitHub Pages 경로 대응)
// =========================
loadModule("panel-1", "/dashboard/as.html");