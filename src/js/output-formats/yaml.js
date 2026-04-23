(function () {
    window.ExcelConverterOutputFormats = window.ExcelConverterOutputFormats || [];
    window.ExcelConverterOutputBuilders = window.ExcelConverterOutputBuilders || {};

    window.ExcelConverterOutputFormats.push({
        value: "yaml",
        label: "YAML",
        controls: { columns: true, xml: false, sql: false }
    });

    window.ExcelConverterOutputBuilders.yaml = function (context) {
        const objects = context.utils.buildObjectsFromRows(context.rows, context.headers);
        return window.ExcelConverterYaml.stringify(objects);
    };
})();
