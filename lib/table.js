function table(items, definitions, addHeader) {

    let s = '';

    // If a header is required, print out the header for each column
    if (addHeader !== false) {
        let header = '';
        for (let definition of definitions) {

            // Negative width means left justify
            // Positive width means right justify
            if (definition.indent) {
                header += rj(' ', definition.indent);
            }

            if (definition.width < 0) {
                header += lj(definition.alias || definition.name, 0 - definition.width) + ' ';
            } else {
                header += rj(definition.alias || definition.name, definition.width) + ' ';
            }

            if (definition.post) {
                header += rj(' ', definition.post);
            }
        }

        s += header + '\n';
    }


    // For each item, print each row according to the definition metadata
    for (let item of items) {

        let row = '';
        for (let definition of definitions) {

            let value = format(item[definition.name], definition.format);

            if (definition.indent) {
                row += rj(' ', definition.indent);
            }

            // Negative width means left justify
            // Positive width means right justify
            if (definition.width < 0) {
                row += lj(value, 0 - definition.width) + ' ';
            } else {
                row += rj(value, definition.width) + ' ';
            }

            if (definition.post) {
                row += rj(' ', definition.post);
            }
        }

        s += row + '\n'
    }

    return s;
}


function format(n, options) {

    if (!n) {
        return '';
    }

    if (!options) {
        return n;
    }

    if (typeof options === "string") {

        if (options === "dependent") {
            if (Math.round(n, 2) === n) {
                return n;
            }
            return Number.parseFloat(n).toFixed(1);
        }

        if (options === "integer") {
            return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
        }

        if (options === "float") {
            return Number.parseFloat(n).toFixed(1);
        }

        if (options === "percent") {
            return Number.parseFloat(n * 100).toFixed(0);
        }

        if (options === 'k') {
            n = (n / 1000).toFixed(1);
            let s = Number.parseFloat(n).toFixed(1) + 'K';
            return s;
        }

        if (options === 'm') {
            n = (n / 1000000).toFixed(1);
            return Number.parseFloat(n).toFixed(1) + 'M';
        }

    }

    if (n && options.shorten) {
        if (n.length > options.shorten) {
            n = n.substring(0, options.shorten) + options.shorten_append;
        }
        return n;
    }

    console.log('ERROR: Unknown format option: ' + JSON.stringify(options));
    process.exit(1);
}


function fmtFloat(n, digits, decimalDigits) {
    let s = rj(n.toFixed(decimalDigits), digits + decimalDigits + 1);
    return s;
}


function fmtInt(n, digits) {
    let s = rj(n.toFixed(0), digits);
    return s;
}


function round(n, decimalDigits) {
    if (!decimalDigits) {
        decimalDigits = 0;
    }

    switch (decimalDigits) {
    case 0:
        return Math.round(n);
    case 1:
        return Math.round(n * 10) / 10;
    case 2:
        return Math.round(n * 100) / 100;
    case 3:
        return Math.round(n * 1000) / 1000;
    }
}


function rj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padStart(n, ' ');
}


function lj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padEnd(n, ' ');
}


module.exports.table = table;
module.exports.round = round;
module.exports.rj = rj;
module.exports.lj = lj;
module.exports.fmtFloat = fmtFloat;
module.exports.fmtInt = fmtInt;
