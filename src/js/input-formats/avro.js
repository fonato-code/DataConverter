(function () {
    window.ExcelConverterInputFormats = window.ExcelConverterInputFormats || [];
    window.ExcelConverterInputParsers = window.ExcelConverterInputParsers || {};

    window.ExcelConverterInputFormats.push({
        value: "avro",
        label: "Apache - Avro"
    });

    window.ExcelConverterInputParsers.avro = function (context) {
        let parsed;
        try {
            parsed = JSON.parse(context.input);
        } catch (error) {
            throw new Error("Apache - Avro invalido: " + error.message);
        }

        const schema = parsed && parsed.schema;
        const records = parsed && parsed.records;

        if (!schema || !Array.isArray(schema.fields) || !Array.isArray(records)) {
            throw new Error("Apache - Avro invalido: esperado objeto com schema.fields e records.");
        }

        const rawHeaders = schema.fields.map(function (field, index) {
            return field && field.name ? field.name : "Col" + (index + 1);
        });
        const headers = rawHeaders.map(function (header, index) {
            return context.utils.normalizeHeader(String(header), index, context.state.headerTransform);
        });

        return {
            headers: headers,
            dataRows: records.map(function (record) {
                return rawHeaders.map(function (header) {
                    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
                });
            })
        };
    };
})();
