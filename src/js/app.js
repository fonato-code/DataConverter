(function () {
    const { createApp, computed, reactive } = Vue;

    function detectDelimiter(text) {
        const scores = {
            ",": scoreDelimiter(text, ","),
            "\t": scoreDelimiter(text, "\t")
        };

        return scores["\t"] > scores[","] ? "\t" : ",";
    }

    function scoreDelimiter(text, delimiter) {
        const rows = parseDelimitedText(text, delimiter).slice(0, 5);
        return rows.reduce(function (total, row) {
            return total + (row.length > 1 ? row.length : 0);
        }, 0);
    }

    function parseDelimitedText(text, delimiter) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;

        function pushField() {
            row.push(field);
            field = "";
        }

        function pushRow() {
            if (row.length === 1 && row[0] === "" && field === "") {
                row = [];
                return;
            }

            rows.push(row);
            row = [];
        }

        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            const nextChar = text[index + 1];

            if (char === "\"") {
                if (inQuotes && nextChar === "\"") {
                    field += "\"";
                    index += 1;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && char === delimiter) {
                pushField();
                continue;
            }

            if (!inQuotes && (char === "\n" || char === "\r")) {
                pushField();
                pushRow();

                if (char === "\r" && nextChar === "\n") {
                    index += 1;
                }

                continue;
            }

            field += char;
        }

        if (field !== "" || row.length) {
            pushField();
            pushRow();
        }

        return rows.filter(function (currentRow) {
            return currentRow.some(function (cell) {
                return cell !== "";
            });
        });
    }

    function normalizeKey(value, index, transform) {
        const fallback = "column_" + (index + 1);
        if (!value) {
            return fallback;
        }

        if (transform === "uppercase") {
            return value.toUpperCase();
        }

        if (transform === "downcase") {
            return value.toLowerCase();
        }

        return value;
    }

    function parseCell(rawValue, decimalSign) {
        const value = rawValue.trim();
        if (value === "") {
            return "";
        }

        const normalized = decimalSign === "comma"
            ? value.replace(/\./g, "").replace(",", ".")
            : value.replace(/,/g, "");

        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
            return Number(normalized);
        }

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        return value;
    }

    function buildRows(text, delimiter, decimalSign) {
        return parseDelimitedText(text, delimiter).map(function (row) {
            return row.map(function (cell) {
                return parseCell(cell, decimalSign);
            });
        });
    }

    createApp({
        setup() {
            const state = reactive({
                input: "",
                delimiter: "auto",
                decimalSign: "dot",
                firstRowIsHeader: true,
                headerTransform: "none",
                outputFormat: "json"
            });

            const resolvedDelimiter = computed(function () {
                if (state.delimiter === "tab") {
                    return "\t";
                }

                if (state.delimiter === "comma") {
                    return ",";
                }

                return detectDelimiter(state.input);
            });

            const statusMessage = computed(function () {
                if (!state.input.trim()) {
                    return {
                        tone: "info",
                        text: "Cole dados do Excel, CSV ou TSV no campo Input para gerar a saida."
                    };
                }

                const delimiterLabel = resolvedDelimiter.value === "\t" ? "Tab" : "Comma";
                return {
                    tone: "info",
                    text: "Delimitador em uso: " + delimiterLabel + ". Formato de saida atual: JSON."
                };
            });

            const output = computed(function () {
                if (!state.input.trim()) {
                    return "";
                }

                try {
                    const rows = buildRows(state.input, resolvedDelimiter.value, state.decimalSign);
                    if (!rows.length) {
                        return "";
                    }

                    if (!state.firstRowIsHeader) {
                        return JSON.stringify(rows, null, 2);
                    }

                    const [headerRow, ...dataRows] = rows;
                    const headers = headerRow.map(function (cell, index) {
                        return normalizeKey(String(cell), index, state.headerTransform);
                    });

                    const objects = dataRows.map(function (row) {
                        return headers.reduce(function (record, header, index) {
                            record[header] = index < row.length ? row[index] : "";
                            return record;
                        }, {});
                    });

                    return JSON.stringify(objects, null, 2);
                } catch (error) {
                    return "Erro ao converter: " + error.message;
                }
            });

            return {
                state,
                statusMessage,
                output
            };
        },
        template: `
            <div class="app-wrap container-fluid">

                <div class="row g-4">
                    <aside class="col-12 col-xl-3">
                        <div class="sidebar-card h-100">
                            <div class="sidebar-accent"></div>
                            <div class="card-body p-4">
                                <div class="sidebar-title mb-2">Configuracoes</div>
                                <h2 class="h4 mb-3">Controle da conversao</h2>
                                <p class="text-secondary mb-4">Ajuste como o texto colado deve ser interpretado antes de gerar o JSON.</p>

                                <div class="mb-3">
                                    <label for="delimiter" class="form-label fw-semibold">Delimiter</label>
                                    <select id="delimiter" class="form-select" v-model="state.delimiter">
                                        <option value="auto">Auto</option>
                                        <option value="comma">Comma</option>
                                        <option value="tab">Tab</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label for="decimal-sign" class="form-label fw-semibold">DecimalSign</label>
                                    <select id="decimal-sign" class="form-select" v-model="state.decimalSign">
                                        <option value="dot">Dot</option>
                                        <option value="comma">Comma</option>
                                    </select>
                                </div>

                                <div class="form-check form-switch mb-3">
                                    <input id="header-row" class="form-check-input" type="checkbox" role="switch" v-model="state.firstRowIsHeader">
                                    <label class="form-check-label fw-semibold" for="header-row">First row is header</label>
                                </div>

                                <div class="mb-4">
                                    <label for="header-transform" class="form-label fw-semibold">Header transform</label>
                                    <select id="header-transform" class="form-select" v-model="state.headerTransform">
                                        <option value="none">none</option>
                                        <option value="uppercase">uppercase</option>
                                        <option value="downcase">downcase</option>
                                    </select>
                                </div>

                                <div class="hint-box rounded-4 p-3">
                                    <div class="fw-bold mb-2">Dica</div>
                                    <div class="text-secondary small">No modo Auto, o sistema compara virgulas e tabs nas primeiras linhas. Para valores como 10,50 use DecimalSign em Comma.</div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main class="col-12 col-xl-9">
                        <div class="row g-4">
                            <section class="col-12 col-lg-6">
                                <div class="panel-card input-panel h-100">
                                    <div class="card-body p-4">
                                        <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
                                            <div>
                                                <div class="editor-label mb-1">Input</div>
                                                <h3 class="h5 mb-0">Texto de origem</h3>
                                            </div>
                                            <span class="badge rounded-pill text-bg-primary px-3 py-2">Excel / CSV / TSV</span>
                                        </div>
                                        <textarea
                                            class="form-control editor-textarea"
                                            v-model="state.input"
                                            placeholder="Cole aqui dados copiados do Excel, CSV ou TSV"
                                            spellcheck="false"
                                        ></textarea>
                                    </div>
                                </div>
                            </section>

                            <section class="col-12 col-lg-6">
                                <div class="panel-card output-panel h-100">
                                    <div class="card-body p-4">
                                        <div class="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
                                            <div>
                                                <div class="editor-label mb-1">Output</div>
                                                <h3 class="h5 mb-0">Resultado convertido</h3>
                                            </div>
                                            <div class="col-12 col-sm-4 col-lg-5 col-xxl-4 px-0">
                                                <select class="form-select" v-model="state.outputFormat">
                                                    <option value="json">JSON</option>
                                                </select>
                                            </div>
                                        </div>
                                        <textarea
                                            class="form-control editor-textarea"
                                            :value="output"
                                            readonly
                                            spellcheck="false"
                                            placeholder="O resultado convertido sera exibido aqui"
                                        ></textarea>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </main>
                </div>
            </div>
        `
    }).mount("#app");
})();
