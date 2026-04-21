// =========================
// 모듈 로딩
// =========================
async function loadModule(targetId, file) {
    const target = document.getElementById(targetId);

    try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`${file} 로드 실패`);

        const html = await res.text();
        target.innerHTML = html;

        if (file === "as.html") {
            initASModule();
        }

        if (file === "as2.html") {
            initTool2Module();
        }
    } catch (err) {
        console.error(err);
        target.innerHTML = "화면 로드 실패";
    }
}


// =========================
// 1번 툴: AS 기술 진단 어시스턴트
// =========================
function initASModule() {
    let rawData = [];

    const productEl = document.getElementById("product");
    const symptomEl = document.getElementById("symptom");
    const statusEl = document.getElementById("status");
    const resultBox = document.getElementById("resultBox");

    if (!productEl || !symptomEl || !statusEl || !resultBox) {
        console.error("AS 모듈 요소 못 찾음");
        return;
    }

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
            const obj = {};
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

    fetch("https://api.github.com/repos/ggumbi-cs/dashboard/commits?path=data/가전마감.csv")
        .then(res => res.json())
        .then(data => {
            const last = data[0].commit.author.date;
            const d = new Date(last);

            const timeStr =
                d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0") + " " +
                String(d.getHours()).padStart(2, "0") + ":" +
                String(d.getMinutes()).padStart(2, "0");

            statusEl.textContent = `GitHub 자동 로드 완료 (${timeStr} 업데이트)`;
        })
        .catch(err => {
            console.error(err);
        });
}


// =========================
// 2번 툴: 회수접수도우미
// =========================
function initTool2Module() {
    const RETURN_REASONS = ["일반반품", "변심반품", "불량반품", "불량교환", "AS", "검수"];
    const LINKMOM_PRODUCTS = ["분유쉐이커", "LED분유쉐이커", "휴대용분유포트"];

    const modeEl = document.getElementById("tool2_mode");
    const reasonEl = document.getElementById("tool2_reason");
    const selectedProductEl = document.getElementById("tool2_selected_product");
    const directProductEl = document.getElementById("tool2_direct_product");
    const symptomEl = document.getElementById("tool2_symptom");
    const orderEl = document.getElementById("tool2_order");
    const customerEl = document.getElementById("tool2_customer");

    const selectedWrapEl = document.getElementById("tool2_selected_wrap");
    const directWrapEl = document.getElementById("tool2_direct_wrap");
    const symptomWrapEl = document.getElementById("tool2_symptom_wrap");
    const orderWrapEl = document.getElementById("tool2_order_wrap");
    const customerWrapEl = document.getElementById("tool2_customer_wrap");

    const resultEl = document.getElementById("tool2_result");
    const statusEl = document.getElementById("tool2_status");
    const copyBtn = document.getElementById("tool2_copy");
    const resetBtn = document.getElementById("tool2_reset");

    if (
        !modeEl || !reasonEl || !selectedProductEl || !directProductEl ||
        !symptomEl || !orderEl || !customerEl ||
        !selectedWrapEl || !directWrapEl || !symptomWrapEl ||
        !orderWrapEl || !customerWrapEl || !resultEl || !statusEl ||
        !copyBtn || !resetBtn
    ) {
        console.error("2번 툴 요소 못 찾음");
        return;
    }

    reasonEl.innerHTML = "";
    RETURN_REASONS.forEach(item => {
        reasonEl.innerHTML += `<option value="${item}">${item}</option>`;
    });

    selectedProductEl.innerHTML = "";
    LINKMOM_PRODUCTS.forEach(item => {
        selectedProductEl.innerHTML += `<option value="${item}">${item}</option>`;
    });

    function normalizeProduct(value) {
        return value.replace(/\s/g, "").trim();
    }

    function isLinkmomProduct(product) {
        const normalized = normalizeProduct(product);
        return LINKMOM_PRODUCTS.some(item => normalizeProduct(item) === normalized);
    }

    function getProductValue() {
        return modeEl.value === "3종 선택"
            ? selectedProductEl.value.trim()
            : directProductEl.value.trim();
    }

    function buildMemo(product, returnReason, symptom, orderNumber, customerName) {
        product = product.trim();
        symptom = symptom.trim();
        orderNumber = orderNumber.trim();
        customerName = customerName.trim();

        const linkmom = isLinkmomProduct(product);

        if (linkmom) {
            if (returnReason === "일반반품") {
                if (!orderNumber) return "주문번호를 입력해주세요.";
                return `★일반반품 링크맘 엄감★${orderNumber}`;
            }

            if (returnReason === "변심반품") {
                if (!orderNumber) return "주문번호를 입력해주세요.";
                return `★변심반품 링크맘 엄감★${orderNumber}`;
            }

            if (returnReason === "불량반품") {
                if (!orderNumber) return "주문번호를 입력해주세요.";
                if (!product) return "모델명을 입력해주세요.";
                if (!symptom) return "증상을 입력해주세요.";
                return `★불량반품★${orderNumber} / ${product} / ${symptom}`;
            }

            if (returnReason === "불량교환") {
                if (!orderNumber) return "주문번호를 입력해주세요.";
                if (!product) return "모델명을 입력해주세요.";
                if (!symptom) return "증상을 입력해주세요.";
                return `★불량교환★${orderNumber} / ${product} / ${symptom}`;
            }

            if (returnReason === "AS") {
                if (!customerName) return "고객명을 입력해주세요.";
                if (!symptom) return "증상을 입력해주세요.";
                return `★AS 링크맘 엄감★ ${customerName}고객님 / ${symptom}`;
            }

            if (returnReason === "검수") {
                if (!customerName) return "고객명을 입력해주세요.";
                if (!symptom) return "증상을 입력해주세요.";
                return `★검수 링크맘 엄감★ ${customerName}고객님 / ${symptom}`;
            }
        }

        if (returnReason === "일반반품") {
            if (!orderNumber) return "주문번호를 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            return `★일반반품★${orderNumber} / ${product}`;
        }

        if (returnReason === "변심반품") {
            if (!orderNumber) return "주문번호를 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            return `★변심반품★${orderNumber} / ${product}`;
        }

        if (returnReason === "불량반품") {
            if (!orderNumber) return "주문번호를 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            if (!symptom) return "증상을 입력해주세요.";
            return `★불량반품★${orderNumber} / ${product} / ${symptom}`;
        }

        if (returnReason === "불량교환") {
            if (!orderNumber) return "주문번호를 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            if (!symptom) return "증상을 입력해주세요.";
            return `★불량교환★${orderNumber} / ${product} / ${symptom}`;
        }

        if (returnReason === "AS") {
            if (!customerName) return "고객명을 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            if (!symptom) return "증상을 입력해주세요.";
            return `★AS 링크맘 엄감★${customerName}고객님 / ${product} / ${symptom}`;
        }

        if (returnReason === "검수") {
            if (!customerName) return "고객명을 입력해주세요.";
            if (!product) return "모델명을 입력해주세요.";
            if (!symptom) return "증상을 입력해주세요.";
            return `★검수 링크맘 엄감★${customerName}고객님 / ${product} / ${symptom}`;
        }

        return "해당 조건으로 생성되는 배송메모 규칙이 없습니다.";
    }

    function formatForDisplay(text) {
        if (!text.includes(" / ")) return text;
        if (text.length <= 32) return text;
        return text.replaceAll(" / ", "\n/ ");
    }

    function updateModeUI() {
        if (modeEl.value === "3종 선택") {
            selectedWrapEl.style.display = "block";
            directWrapEl.style.display = "none";
        } else {
            selectedWrapEl.style.display = "none";
            directWrapEl.style.display = "block";
        }
    }

    function updateReasonUI() {
        const reason = reasonEl.value;

        const showSymptom = ["불량반품", "불량교환", "AS", "검수"].includes(reason);
        const showOrder = ["일반반품", "변심반품", "불량반품", "불량교환"].includes(reason);
        const showCustomer = ["AS", "검수"].includes(reason);

        symptomWrapEl.style.display = showSymptom ? "block" : "none";
        orderWrapEl.style.display = showOrder ? "block" : "none";
        customerWrapEl.style.display = showCustomer ? "block" : "none";
    }

    function updateOutput() {
        const memo = buildMemo(
            getProductValue(),
            reasonEl.value,
            symptomEl.value,
            orderEl.value,
            customerEl.value
        );

        resultEl.textContent = formatForDisplay(memo);
    }

    function resetForm(clearStatus = true) {
        modeEl.value = "3종 선택";
        selectedProductEl.value = LINKMOM_PRODUCTS[0];
        directProductEl.value = "";
        reasonEl.value = "일반반품";
        symptomEl.value = "";
        orderEl.value = "";
        customerEl.value = "";

        updateModeUI();
        updateReasonUI();
        updateOutput();

        if (clearStatus) {
            statusEl.textContent = "";
        }
    }

    modeEl.addEventListener("change", () => {
        updateModeUI();
        updateOutput();
    });

    reasonEl.addEventListener("change", () => {
        updateReasonUI();
        updateOutput();
    });

    selectedProductEl.addEventListener("input", updateOutput);
    directProductEl.addEventListener("input", updateOutput);
    symptomEl.addEventListener("input", updateOutput);
    orderEl.addEventListener("input", updateOutput);
    customerEl.addEventListener("input", updateOutput);

    copyBtn.addEventListener("click", async () => {
        const rawMemo = buildMemo(
            getProductValue(),
            reasonEl.value,
            symptomEl.value,
            orderEl.value,
            customerEl.value
        );

        if (rawMemo.endsWith("입력해주세요.") || rawMemo === "해당 조건으로 생성되는 배송메모 규칙이 없습니다.") {
            alert(rawMemo);
            return;
        }

        try {
            await navigator.clipboard.writeText(rawMemo);
            statusEl.textContent = "배송메모 복사 완료 · 입력값 초기화됨";
            resetForm(false);
        } catch (err) {
            console.error(err);
            alert("복사에 실패했습니다.");
        }
    });

    resetBtn.addEventListener("click", () => {
        resetForm(true);
    });

    resetForm(true);
}



// =========================
// 실행
// =========================

// 🔥 무조건 상대경로로 사용 (로컬 + 깃허브 둘 다 대응)
loadModule("panel-1", "./as.html");
loadModule("panel-2", "./as2.html");