(function () {
    window.ExcelConverterOutputFormats = window.ExcelConverterOutputFormats || [];
    window.ExcelConverterOutputBuilders = window.ExcelConverterOutputBuilders || {};

    function escapeDelimitedValue(value, delimiter) {
        const text = String(value);
        if (text.indexOf("\"") !== -1 || text.indexOf("\n") !== -1 || text.indexOf("\r") !== -1 || text.indexOf(delimiter) !== -1) {
            return "\"" + text.replace(/"/g, "\"\"") + "\"";
        }
        return text;
    }

    window.ExcelConverterOutputFormats.push({
        value: "tsv",
        label: "TSV",
        controls: { columns: true, xml: false, sql: false }
    });

    window.ExcelConverterOutputBuilders.tsv = function (context) {
        const delimiter = "\t";
        const lines = [
            context.headers.map(function (header) {
                return escapeDelimitedValue(header, delimiter);
            }).join(delimiter)
        ].concat(context.rows.map(function (row) {
            return context.headers.map(function (_header, index) {
                return escapeDelimitedValue(index < row.length ? row[index] : "", delimiter);
            }).join(delimiter);
        }));

        return lines.join("\n");
    };
})();
