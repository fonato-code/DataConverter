(function () {
    window.ExcelConverterInputFormats = window.ExcelConverterInputFormats || [];
    window.ExcelConverterInputParsers = window.ExcelConverterInputParsers || {};

    function parseMarkdownRow(line) {
        return line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(function (cell) {
                return cell.trim();
            });
    }

    function isSeparatorRow(cells) {
        return cells.every(function (cell) {
            return /^:?-{3,}:?$/.test(cell);
        });
    }

    window.ExcelConverterInputFormats.push({
        value: "markdown-table",
        label: "Markdown Table"
    });

    window.ExcelConverterInputParsers["markdown-table"] = function (context) {
        const rows = context.input
            .replace(/\r/g, "")
            .split("\n")
            .map(function (line) { return line.trim(); })
            .filter(Boolean)
            .filter(function (line) { return line.indexOf("|") !== -1; })
            .map(parseMarkdownRow);

        if (rows.length < 2 || !isSeparatorRow(rows[1])) {
            throw new Error("Markdown Table invalida");
        }

        const headers = rows[0].map(function (header, index) {
            return context.utils.normalizeHeader(header, index, context.state.headerTransform);
        });

        return {
            headers: headers,
            dataRows: rows.slice(2)
        };
    };
})();
