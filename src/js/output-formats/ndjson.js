(function () {
    window.ExcelConverterOutputFormats = window.ExcelConverterOutputFormats || [];
    window.ExcelConverterOutputBuilders = window.ExcelConverterOutputBuilders || {};

    window.ExcelConverterOutputFormats.push({
        value: "ndjson",
        label: "NDJSON",
        controls: { columns: true, xml: false, sql: false }
    });

    window.ExcelConverterOutputBuilders.ndjson = function (context) {
        return context.utils.buildObjectsFromRows(context.rows, context.headers)
            .map(function (item) {
                return JSON.stringify(item);
            })
            .join("\n");
    };
})();
