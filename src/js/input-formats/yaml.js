(function () {
    window.ExcelConverterInputFormats = window.ExcelConverterInputFormats || [];
    window.ExcelConverterInputParsers = window.ExcelConverterInputParsers || {};

    function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function normalizeHeaders(headers, transform, utils) {
        return headers.map(function (header, index) {
            return utils.normalizeHeader(String(header), index, transform);
        });
    }

    function parseYamlToStandardObject(parsed, context) {
        if (Array.isArray(parsed)) {
            if (!parsed.length) {
                return { headers: [], dataRows: [] };
            }

            if (parsed.every(isPlainObject)) {
                const headers = [];
                parsed.forEach(function (item) {
                    Object.keys(item).forEach(function (key) {
                        if (headers.indexOf(key) === -1) {
                            headers.push(key);
                        }
                    });
                });

                return {
                    headers: normalizeHeaders(headers, context.state.headerTransform, context.utils),
                    dataRows: parsed.map(function (item) {
                        return headers.map(function (header) {
                            return Object.prototype.hasOwnProperty.call(item, header) ? item[header] : "";
                        });
                    })
                };
            }

            if (parsed.every(Array.isArray)) {
                if (context.state.firstRowIsHeader) {
                    return {
                        headers: normalizeHeaders(parsed[0], context.state.headerTransform, context.utils),
                        dataRows: parsed.slice(1)
                    };
                }

                const maxColumnCount = parsed.reduce(function (max, row) {
                    return Math.max(max, row.length);
                }, 0);
                return {
                    headers: context.utils.buildDefaultHeaders(maxColumnCount),
                    dataRows: parsed
                };
            }

            return {
                headers: ["Value"],
                dataRows: parsed.map(function (value) {
                    return [value];
                })
            };
        }

        if (isPlainObject(parsed)) {
            const values = Object.values(parsed);
            if (values.length && values.every(Array.isArray)) {
                const headers = Object.keys(parsed);
                const maxLength = headers.reduce(function (max, header) {
                    return Math.max(max, parsed[header].length);
                }, 0);
                return {
                    headers: normalizeHeaders(headers, context.state.headerTransform, context.utils),
                    dataRows: Array.from({ length: maxLength }, function (_value, rowIndex) {
                        return headers.map(function (header) {
                            return rowIndex < parsed[header].length ? parsed[header][rowIndex] : "";
                        });
                    })
                };
            }

            const headers = Object.keys(parsed);
            return {
                headers: normalizeHeaders(headers, context.state.headerTransform, context.utils),
                dataRows: [headers.map(function (header) {
                    return parsed[header];
                })]
            };
        }

        return {
            headers: ["Value"],
            dataRows: [[parsed]]
        };
    }

    window.ExcelConverterInputFormats.push({
        value: "yaml",
        label: "YAML"
    });

    window.ExcelConverterInputParsers.yaml = function (context) {
        const parsed = window.ExcelConverterYaml.parse(context.input);
        return parseYamlToStandardObject(parsed, context);
    };
})();
