(function () {
    window.ExcelConverterOutputFormats = window.ExcelConverterOutputFormats || [];
    window.ExcelConverterOutputBuilders = window.ExcelConverterOutputBuilders || {};

    function escapeMarkdownCell(value) {
        return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
    }

    window.ExcelConverterOutputFormats.push({
        value: "markdown-table",
        label: "Markdown Table",
        controls: { columns: true, xml: false, sql: false }
    });

    window.ExcelConverterOutputBuilders["markdown-table"] = function (context) {
        const headerLine = "| " + context.headers.map(escapeMarkdownCell).join(" | ") + " |";
        const separatorLine = "| " + context.headers.map(function () { return "---"; }).join(" | ") + " |";
        const rowLines = context.rows.map(function (row) {
            return "| " + context.headers.map(function (_header, index) {
                return escapeMarkdownCell(index < row.length ? row[index] : "");
            }).join(" | ") + " |";
        });

        return [headerLine, separatorLine].concat(rowLines).join("\n");
    };
})();
