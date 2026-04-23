(function () {
    const { createApp, computed, reactive, watch } = Vue;

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

        const normalized = normalizeNumericString(value, decimalSign);

        if (normalized && /^-?\d+(\.\d+)?$/.test(normalized)) {
            return Number(normalized);
        }

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        return value;
    }

    function normalizeNumericString(value, decimalSign) {
        const compactValue = value.replace(/\s/g, "");
        const dotPattern = /^-?\d+(\.\d+)?$/;
        const commaPattern = /^-?\d+(,\d+)?$/;
        const usThousandsPattern = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
        const brThousandsPattern = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;

        if (decimalSign === "comma") {
            if (brThousandsPattern.test(compactValue)) {
                return compactValue.replace(/\./g, "").replace(",", ".");
            }

            if (commaPattern.test(compactValue)) {
                return compactValue.replace(",", ".");
            }

            if (dotPattern.test(compactValue)) {
                return compactValue;
            }

            return null;
        }

        if (decimalSign === "dot") {
            if (usThousandsPattern.test(compactValue) && compactValue.indexOf(".") !== -1) {
                return compactValue.replace(/,/g, "");
            }

            if (dotPattern.test(compactValue)) {
                return compactValue;
            }

            return null;
        }

        return null;
    }

    function buildRows(text, delimiter, decimalSign) {
        return parseDelimitedText(text, delimiter).map(function (row) {
            return row.map(function (cell) {
                return parseCell(cell, decimalSign);
            });
        });
    }

    function buildDefaultHeaders(columnCount) {
        return Array.from({ length: columnCount }, function (_value, index) {
            return "Col" + (index + 1);
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatCellForHtml(value) {
        return escapeHtml(value).replace(/\r?\n/g, "<br>");
    }

    function escapeSqlString(value) {
        return String(value).replace(/'/g, "''");
    }

    function escapePhpString(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"");
    }

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function sanitizeSqlIdentifier(value) {
        const sanitized = String(value).replace(/[^A-Za-z0-9_]/g, "_");
        return sanitized || "column";
    }

    function sanitizeXmlTagName(value, fallback) {
        const sanitized = String(value).replace(/[^A-Za-z0-9_.-]/g, "_");
        const valid = /^[A-Za-z_]/.test(sanitized) ? sanitized : fallback;
        return valid || fallback;
    }

    function isNumericValue(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    function prepareTableData(rows, firstRowIsHeader, headerTransform) {
        if (!rows.length) {
            return {
                headers: [],
                dataRows: []
            };
        }

        if (!firstRowIsHeader) {
            const maxColumnCount = rows.reduce(function (max, row) {
                return Math.max(max, row.length);
            }, 0);

            return {
                headers: buildDefaultHeaders(maxColumnCount),
                dataRows: rows
            };
        }

        const headerRow = rows[0];
        return {
            headers: headerRow.map(function (cell, index) {
                return normalizeKey(String(cell), index, headerTransform);
            }),
            dataRows: rows.slice(1)
        };
    }

    function buildObjectsFromRows(rows, headers) {
        return rows.map(function (row) {
            return headers.reduce(function (record, header, index) {
                record[header] = index < row.length ? row[index] : "";
                return record;
            }, {});
        });
    }

    function buildHtmlTable(rows, headers, includeHeader) {
        const headMarkup = includeHeader
            ? [
                "  <thead>",
                "    <tr>",
                headers.map(function (header) {
                    return "      <th>" + formatCellForHtml(header) + "</th>";
                }).join("\n"),
                "    </tr>",
                "  </thead>"
            ].join("\n")
            : "";

        const bodyMarkup = [
            "  <tbody>",
            rows.map(function (row) {
                return [
                    "    <tr>",
                    headers.map(function (_header, index) {
                        const cellValue = index < row.length ? row[index] : "";
                        return "      <td>" + formatCellForHtml(cellValue) + "</td>";
                    }).join("\n"),
                    "    </tr>"
                ].join("\n");
            }).join("\n"),
            "  </tbody>"
        ].join("\n");

        return [
            "<table>",
            headMarkup,
            bodyMarkup,
            "</table>"
        ].filter(Boolean).join("\n");
    }

    function buildColumnArrays(rows, headers) {
        return headers.reduce(function (result, header, columnIndex) {
            result[header] = rows.map(function (row) {
                return columnIndex < row.length ? row[columnIndex] : "";
            });
            return result;
        }, {});
    }

    function buildDictionary(rows, headers) {
        const valueHeaders = headers.slice(1);
        return rows.reduce(function (result, row) {
            if (!row.length) {
                return result;
            }

            const key = String(row[0]);
            result[key] = valueHeaders.reduce(function (entry, header, index) {
                const rowIndex = index + 1;
                entry[header] = rowIndex < row.length ? row[rowIndex] : "";
                return entry;
            }, {});
            return result;
        }, {});
    }

    function inferSqlType(rows, columnIndex) {
        const values = rows
            .map(function (row) {
                return columnIndex < row.length ? row[columnIndex] : "";
            })
            .filter(function (value) {
                return value !== "";
            });

        if (!values.length) {
            return "VARCHAR(255)";
        }

        const allNumbers = values.every(function (value) {
            return isNumericValue(value);
        });

        if (allNumbers && values.every(function (value) { return Number.isInteger(value); })) {
            return "INT";
        }

        if (allNumbers) {
            return "DECIMAL(18,6)";
        }

        return "VARCHAR(255)";
    }

    function formatSqlValue(value) {
        if (value === "") {
            return "NULL";
        }

        if (isNumericValue(value)) {
            return String(value);
        }

        return "'" + escapeSqlString(value) + "'";
    }

    function buildSql(headers, rows, tableName) {
        const resolvedTableName = sanitizeSqlIdentifier(tableName || "ExcelConverter");
        const columnDefinitions = headers.map(function (header, index) {
            return "\t" + sanitizeSqlIdentifier(header) + " " + inferSqlType(rows, index);
        });
        const insertColumns = headers.map(function (header) {
            return sanitizeSqlIdentifier(header);
        }).join(",");
        const values = rows.map(function (row) {
            return "\t(" + headers.map(function (_header, index) {
                return formatSqlValue(index < row.length ? row[index] : "");
            }).join(",") + ")";
        }).join(",\n");

        return [
            "CREATE TABLE " + resolvedTableName + " (",
            "\tid INT NOT NULL AUTO_INCREMENT PRIMARY KEY,",
            columnDefinitions.join(",\n"),
            ");",
            "INSERT INTO " + resolvedTableName,
            "\t(" + insertColumns + ")",
            "VALUES",
            values + ";"
        ].join("\n");
    }

    function formatPhpValue(value) {
        if (value === "") {
            return "\"\"";
        }

        if (isNumericValue(value)) {
            return String(value);
        }

        return "\"" + escapePhpString(value) + "\"";
    }

    function buildPhpArray(headers, rows) {
        return [
            "array(",
            rows.map(function (row) {
                return "\tarray(" + headers.map(function (header, index) {
                    const cellValue = index < row.length ? row[index] : "";
                    return "\"" + escapePhpString(header) + "\"=>" + formatPhpValue(cellValue);
                }).join(",") + ")";
            }).join(",\n"),
            ");"
        ].join("\n");
    }

    function buildXmlProperties(headers, rows, rootTagName, rowTagName) {
        const rootTag = sanitizeXmlTagName(rootTagName || "rows", "rows");
        const rowTag = sanitizeXmlTagName(rowTagName || "row", "row");
        const lines = [
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<" + rootTag + ">"
        ];

        rows.forEach(function (row) {
            const attributes = headers.map(function (header, index) {
                const cellValue = index < row.length ? row[index] : "";
                return sanitizeXmlTagName(header, "Col" + (index + 1)) + "=\"" + escapeXml(cellValue) + "\"";
            }).join(" ");
            lines.push("\t<" + rowTag + " " + attributes + "></" + rowTag + ">");
        });

        lines.push("</" + rootTag + ">");
        return lines.join("\n");
    }

    function buildXmlNodes(headers, rows, rootTagName, rowTagName) {
        const xmlHeaders = headers.map(function (header, index) {
            return sanitizeXmlTagName(header, "Col" + (index + 1));
        });
        const rootTag = sanitizeXmlTagName(rootTagName || "rows", "rows");
        const rowTag = sanitizeXmlTagName(rowTagName || "row", "row");
        const lines = [
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<" + rootTag + ">"
        ];

        rows.forEach(function (row) {
            lines.push("\t<" + rowTag + ">");
            xmlHeaders.forEach(function (header, index) {
                const cellValue = index < row.length ? row[index] : "";
                lines.push("\t\t<" + header + ">" + escapeXml(cellValue) + "</" + header + ">");
            });
            lines.push("\t</" + rowTag + ">");
        });

        lines.push("</" + rootTag + ">");
        return lines.join("\n");
    }

    function buildOutput(format, headers, rows, options) {
        if (format === "json") {
            return JSON.stringify(buildObjectsFromRows(rows, headers), null, 2);
        }

        if (format === "json-column-arrays") {
            return JSON.stringify(buildColumnArrays(rows, headers), null, 2);
        }

        if (format === "json-row-arrays") {
            return JSON.stringify(rows, null, 2);
        }

        if (format === "json-dictionary") {
            return JSON.stringify(buildDictionary(rows, headers), null, 2);
        }

        if (format === "html-table") {
            return buildHtmlTable(rows, headers, true);
        }

        if (format === "sql") {
            return buildSql(headers, rows, options.sqlTableName);
        }

        if (format === "php") {
            return buildPhpArray(headers, rows);
        }

        if (format === "xml-properties") {
            return buildXmlProperties(headers, rows, options.xmlRootTagName, options.xmlRowTagName);
        }

        if (format === "xml-nodes") {
            return buildXmlNodes(headers, rows, options.xmlRootTagName, options.xmlRowTagName);
        }

        return "";
    }

    createApp({
        setup() {
            const state = reactive({
                input: "",
                delimiter: "auto",
                decimalSign: "dot",
                firstRowIsHeader: true,
                headerTransform: "none",
                outputFormat: "json",
                xmlRootTagName: "rows",
                xmlRowTagName: "row",
                sqlTableName: "ExcelConverter",
                columnConfigs: [],
                draggedColumnKey: "",
                inputSectionCollapsed: false,
                outputSectionCollapsed: false
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

            const parsedRows = computed(function () {
                if (!state.input.trim()) {
                    return [];
                }

                return buildRows(state.input, resolvedDelimiter.value, state.decimalSign);
            });

            const preparedData = computed(function () {
                return prepareTableData(
                    parsedRows.value,
                    state.firstRowIsHeader,
                    state.headerTransform
                );
            });

            const availableColumns = computed(function () {
                return preparedData.value.headers.map(function (header, index) {
                    return {
                        key: header + "__" + index,
                        header: header,
                        sourceIndex: index
                    };
                });
            });

            watch(availableColumns, function (nextColumns) {
                const previousByKey = state.columnConfigs.reduce(function (accumulator, column) {
                    accumulator[column.key] = column;
                    return accumulator;
                }, {});

                state.columnConfigs = nextColumns.map(function (column) {
                    const previous = previousByKey[column.key];
                    return {
                        key: column.key,
                        header: column.header,
                        sourceIndex: column.sourceIndex,
                        enabled: previous ? previous.enabled : true
                    };
                });
            }, { immediate: true });

            const selectedColumns = computed(function () {
                return state.columnConfigs.filter(function (column) {
                    return column.enabled;
                });
            });

            const orderedHeaders = computed(function () {
                return selectedColumns.value.map(function (column) {
                    return column.header;
                });
            });

            const orderedRows = computed(function () {
                return preparedData.value.dataRows.map(function (row) {
                    return selectedColumns.value.map(function (column) {
                        return column.sourceIndex < row.length ? row[column.sourceIndex] : "";
                    });
                });
            });

            const isXmlOutput = computed(function () {
                return state.outputFormat === "xml-properties" || state.outputFormat === "xml-nodes";
            });

            const isSqlOutput = computed(function () {
                return state.outputFormat === "sql";
            });

            const output = computed(function () {
                if (!state.input.trim()) {
                    return "";
                }

                try {
                    if (!parsedRows.value.length) {
                        return "";
                    }

                    return buildOutput(
                        state.outputFormat,
                        orderedHeaders.value,
                        orderedRows.value,
                        {
                            sqlTableName: state.sqlTableName,
                            xmlRootTagName: state.xmlRootTagName,
                            xmlRowTagName: state.xmlRowTagName
                        }
                    );
                } catch (error) {
                    return "Erro ao converter: " + error.message;
                }
            });

            function moveColumn(draggedKey, targetKey) {
                if (!draggedKey || !targetKey || draggedKey === targetKey) {
                    return;
                }

                const draggedIndex = state.columnConfigs.findIndex(function (column) {
                    return column.key === draggedKey;
                });
                const targetIndex = state.columnConfigs.findIndex(function (column) {
                    return column.key === targetKey;
                });

                if (draggedIndex === -1 || targetIndex === -1) {
                    return;
                }

                const movedColumn = state.columnConfigs.splice(draggedIndex, 1)[0];
                state.columnConfigs.splice(targetIndex, 0, movedColumn);
            }

            function startColumnDrag(columnKey) {
                state.draggedColumnKey = columnKey;
            }

            function dropColumn(columnKey) {
                moveColumn(state.draggedColumnKey, columnKey);
                state.draggedColumnKey = "";
            }

            function endColumnDrag() {
                state.draggedColumnKey = "";
            }

            function toggleSection(sectionName) {
                if (sectionName === "input") {
                    state.inputSectionCollapsed = !state.inputSectionCollapsed;
                    return;
                }

                if (sectionName === "output") {
                    state.outputSectionCollapsed = !state.outputSectionCollapsed;
                }
            }

            return {
                state,
                statusMessage,
                output,
                isXmlOutput,
                isSqlOutput,
                startColumnDrag,
                dropColumn,
                endColumnDrag,
                toggleSection
            };
        },
        template: `
            <div class="app-wrap container-fluid">

                <div class="row g-4">
                    <aside class="col-12 col-xl-3">
                        <div class="sidebar-card h-100">
                            <div class="sidebar-accent"></div>
                            <div class="card-body p-4 sidebar-scroll">
                                <div class="sidebar-title mb-2">Configuracoes</div>
                                <h2 class="h4 mb-3">Controle da conversao</h2>
                                <p class="text-secondary mb-4">Ajuste como o texto colado deve ser interpretado antes de gerar o output.</p>

                                <div class="border rounded-4 p-3 mb-4 bg-white bg-opacity-50">
                                    <button class="config-section-toggle" type="button" @click="toggleSection('input')">
                                        <div class="d-flex align-items-center justify-content-between gap-3">
                                            <div class="editor-label mb-0">Input</div>
                                            <span class="config-section-chevron" :class="{ 'is-collapsed': state.inputSectionCollapsed }">▼</span>
                                        </div>
                                    </button>

                                    <div v-show="!state.inputSectionCollapsed" class="mt-3">
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

                                        <div>
                                            <label for="header-transform" class="form-label fw-semibold">Header transform</label>
                                            <select id="header-transform" class="form-select" v-model="state.headerTransform">
                                                <option value="none">none</option>
                                                <option value="uppercase">uppercase</option>
                                                <option value="downcase">downcase</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="border rounded-4 p-3 mb-4 bg-white bg-opacity-50">
                                    <button class="config-section-toggle" type="button" @click="toggleSection('output')">
                                        <div class="d-flex align-items-center justify-content-between gap-3">
                                            <div class="editor-label mb-0">Output</div>
                                            <span class="config-section-chevron" :class="{ 'is-collapsed': state.outputSectionCollapsed }">▼</span>
                                        </div>
                                    </button>

                                    <div v-show="!state.outputSectionCollapsed" class="mt-3">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Colunas</label>
                                            <div class="small text-secondary mb-2">Marque para incluir no resultado e arraste para reordenar.</div>
                                            <div v-if="state.columnConfigs.length" class="d-grid gap-2">
                                                <div
                                                    v-for="column in state.columnConfigs"
                                                    :key="column.key"
                                                    class="column-item d-flex align-items-center gap-2 border rounded-3 px-2 py-2 bg-body"
                                                    draggable="true"
                                                    @dragstart="startColumnDrag(column.key)"
                                                    @dragover.prevent
                                                    @drop.prevent="dropColumn(column.key)"
                                                    @dragend="endColumnDrag"
                                                >
                                                    <span class="column-grip text-secondary" title="Arrastar">::</span>
                                                    <input
                                                        :id="'column-' + column.key"
                                                        class="form-check-input mt-0"
                                                        type="checkbox"
                                                        v-model="column.enabled"
                                                    >
                                                    <label :for="'column-' + column.key" class="form-check-label flex-grow-1 small fw-semibold">
                                                        {{ column.header }}
                                                    </label>
                                                </div>
                                            </div>
                                            <div v-else class="small text-secondary">Cole um texto no input para detectar as colunas.</div>
                                        </div>

                                        <div v-if="isXmlOutput" class="mb-3">
                                            <label for="xml-root-tag" class="form-label fw-semibold">Root Row Tag Name</label>
                                            <input id="xml-root-tag" class="form-control" v-model="state.xmlRootTagName" placeholder="rows">
                                        </div>

                                        <div v-if="isXmlOutput" class="mb-3">
                                            <label for="xml-row-tag" class="form-label fw-semibold">Row Tag Name</label>
                                            <input id="xml-row-tag" class="form-control" v-model="state.xmlRowTagName" placeholder="row">
                                        </div>

                                        <div v-if="isSqlOutput">
                                            <label for="sql-table-name" class="form-label fw-semibold">Tabela</label>
                                            <input id="sql-table-name" class="form-control" v-model="state.sqlTableName" placeholder="ExcelConverter">
                                        </div>
                                    </div>
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
                                                    <option value="json-column-arrays">JSON Column Arrays</option>
                                                    <option value="json-row-arrays">JSON RowArrays</option>
                                                    <option value="json-dictionary">JSON Dictionary</option>
                                                    <option value="html-table">HTML - Tables</option>
                                                    <option value="sql">SQL</option>
                                                    <option value="php">PHP</option>
                                                    <option value="xml-properties">XML - Properties</option>
                                                    <option value="xml-nodes">XML - Nodes</option>
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
