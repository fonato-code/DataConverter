(function () {
    window.ExcelConverterOutputFormats = window.ExcelConverterOutputFormats || [];
    window.ExcelConverterOutputBuilders = window.ExcelConverterOutputBuilders || {};

    function escapeCsvValue(value) {
        const text = String(value);
        if (text.indexOf("\"") !== -1 || text.indexOf("\n") !== -1 || text.indexOf("\r") !== -1 || text.indexOf(",") !== -1) {
            return "\"" + text.replace(/"/g, "\"\"") + "\"";
        }
        return text;
    }

    window.ExcelConverterOutputFormats.push({
        value: "csv",
        label: "CSV",
        controls: { columns: true, xml: false, sql: false }
    });

    window.ExcelConverterOutputBuilders.csv = function (context) {
        const lines = [
            context.headers.map(escapeCsvValue).join(",")
        ].concat(context.rows.map(function (row) {
            return context.headers.map(function (_header, index) {
                return escapeCsvValue(index < row.length ? row[index] : "");
            }).join(",");
        }));

        return lines.join("\n");
    };
})();
