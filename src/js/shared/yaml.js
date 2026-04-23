(function () {
    function parseScalar(value) {
        const trimmed = value.trim();

        if (trimmed === "" || trimmed === "null" || trimmed === "~") {
            return null;
        }

        if (trimmed === "true") {
            return true;
        }

        if (trimmed === "false") {
            return false;
        }

        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            return Number(trimmed);
        }

        if (
            (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return trimmed.slice(1, -1);
        }

        return trimmed;
    }

    function countIndent(line) {
        let count = 0;
        while (count < line.length && line[count] === " ") {
            count += 1;
        }
        return count;
    }

    function splitKeyValue(text) {
        let inQuote = false;
        let quoteChar = "";

        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if ((char === "\"" || char === "'") && text[index - 1] !== "\\") {
                if (inQuote && char === quoteChar) {
                    inQuote = false;
                    quoteChar = "";
                } else if (!inQuote) {
                    inQuote = true;
                    quoteChar = char;
                }
            }

            if (!inQuote && char === ":") {
                return {
                    key: text.slice(0, index).trim(),
                    value: text.slice(index + 1).trim()
                };
            }
        }

        return null;
    }

    function parseBlock(lines, startIndex, indent) {
        let index = startIndex;
        let containerType = null;
        let arrayResult = [];
        let objectResult = {};

        while (index < lines.length) {
            const originalLine = lines[index];
            if (!originalLine.trim() || originalLine.trim().startsWith("#")) {
                index += 1;
                continue;
            }

            const currentIndent = countIndent(originalLine);
            if (currentIndent < indent) {
                break;
            }

            if (currentIndent > indent) {
                throw new Error("Indentacao YAML invalida");
            }

            const line = originalLine.trim();

            if (line.startsWith("- ")) {
                if (containerType === null) {
                    containerType = "array";
                }
                if (containerType !== "array") {
                    throw new Error("YAML invalido");
                }

                const itemContent = line.slice(2).trim();
                if (!itemContent) {
                    const nestedBlock = parseBlock(lines, index + 1, indent + 2);
                    arrayResult.push(nestedBlock.value);
                    index = nestedBlock.nextIndex;
                    continue;
                }

                const inlinePair = splitKeyValue(itemContent);
                if (inlinePair) {
                    const itemObject = {};
                    if (inlinePair.value) {
                        itemObject[inlinePair.key] = parseScalar(inlinePair.value);
                        index += 1;
                    } else {
                        const nestedValue = parseBlock(lines, index + 1, indent + 4);
                        itemObject[inlinePair.key] = nestedValue.value;
                        index = nestedValue.nextIndex;
                    }

                    while (index < lines.length) {
                        const siblingLine = lines[index];
                        if (!siblingLine.trim()) {
                            index += 1;
                            continue;
                        }

                        const siblingIndent = countIndent(siblingLine);
                        if (siblingIndent < indent + 2) {
                            break;
                        }
                        if (siblingIndent > indent + 2) {
                            throw new Error("Indentacao YAML invalida");
                        }

                        const siblingPair = splitKeyValue(siblingLine.trim());
                        if (!siblingPair) {
                            break;
                        }

                        if (siblingPair.value) {
                            itemObject[siblingPair.key] = parseScalar(siblingPair.value);
                            index += 1;
                        } else {
                            const nestedSibling = parseBlock(lines, index + 1, indent + 4);
                            itemObject[siblingPair.key] = nestedSibling.value;
                            index = nestedSibling.nextIndex;
                        }
                    }

                    arrayResult.push(itemObject);
                    continue;
                }

                arrayResult.push(parseScalar(itemContent));
                index += 1;
                continue;
            }

            const pair = splitKeyValue(line);
            if (!pair) {
                throw new Error("YAML invalido");
            }

            if (containerType === null) {
                containerType = "object";
            }
            if (containerType !== "object") {
                throw new Error("YAML invalido");
            }

            if (pair.value) {
                objectResult[pair.key] = parseScalar(pair.value);
                index += 1;
            } else {
                const nested = parseBlock(lines, index + 1, indent + 2);
                objectResult[pair.key] = nested.value;
                index = nested.nextIndex;
            }
        }

        return {
            value: containerType === "array" ? arrayResult : objectResult,
            nextIndex: index
        };
    }

    function parseYaml(text) {
        const lines = text.replace(/\r/g, "").split("\n");
        return parseBlock(lines, 0, 0).value;
    }

    function stringifyScalar(value) {
        if (value === null || value === undefined) {
            return "null";
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        const stringValue = String(value);
        if (stringValue === "" || /[:#\-\n]/.test(stringValue) || /^\s|\s$/.test(stringValue)) {
            return JSON.stringify(stringValue);
        }

        return stringValue;
    }

    function stringifyYaml(value, indent) {
        const spacing = " ".repeat(indent);

        if (Array.isArray(value)) {
            return value.map(function (item) {
                if (item !== null && typeof item === "object") {
                    const nested = stringifyYaml(item, indent + 2);
                    return spacing + "-\n" + nested;
                }

                return spacing + "- " + stringifyScalar(item);
            }).join("\n");
        }

        if (value !== null && typeof value === "object") {
            return Object.keys(value).map(function (key) {
                const currentValue = value[key];
                if (currentValue !== null && typeof currentValue === "object") {
                    return spacing + key + ":\n" + stringifyYaml(currentValue, indent + 2);
                }

                return spacing + key + ": " + stringifyScalar(currentValue);
            }).join("\n");
        }

        return spacing + stringifyScalar(value);
    }

    window.ExcelConverterYaml = {
        parse: parseYaml,
        stringify: function (value) {
            return stringifyYaml(value, 0);
        }
    };
})();
