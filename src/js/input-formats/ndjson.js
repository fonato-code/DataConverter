(function () {
    window.ExcelConverterInputFormats = window.ExcelConverterInputFormats || [];
    window.ExcelConverterInputParsers = window.ExcelConverterInputParsers || {};

    function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    window.ExcelConverterInputFormats.push({
        value: "ndjson",
        label: "NDJSON"
    });

    window.ExcelConverterInputParsers.ndjson = function (context) {
        const lines = context.input
            .replace(/\r/g, "")
            .split("\n")
            .map(function (line) { return line.trim(); })
            .filter(Boolean);

        const parsed = lines.map(function (line, index) {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error("NDJSON invalido na linha " + (index + 1) + ": " + error.message);
            }
        });

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
                headers: headers.map(function (header, index) {
                    return context.utils.normalizeHeader(header, index, context.state.headerTransform);
                }),
                dataRows: parsed.map(function (item) {
                    return headers.map(function (header) {
                        return Object.prototype.hasOwnProperty.call(item, header) ? item[header] : "";
                    });
                })
            };
        }

        return {
            headers: ["Value"],
            dataRows: parsed.map(function (value) {
                return [value];
            })
        };
    };
})();
