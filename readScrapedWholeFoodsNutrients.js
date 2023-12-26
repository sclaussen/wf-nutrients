'use strict'

const fs = require('fs');

var tokens = [];
var currentTokenNumber;
var nutrients = {};
var  keywords = {
    'Serving Size': {
        value: 'poly'
    },
    'Calories': {
    },
    'Total Fat': {
        units: [ 'g' ]
    },
    'Saturated Fat': {
        units: [ 'g' ]
    },
    'Trans Fat': {
        units: [ 'g' ]
    },
    'Polyunsaturated Fat': {
        units: [ 'g' ]
    },
    'Monounsaturated Fat': {
        units: [ 'g' ]
    },
    'Cholesterol': {
        units: [ 'mg' ]
    },
    'Sodium': {
        units: [ 'mg' ]
    },
    'Total Carbohydrates': {
        units: [ 'g' ]
    },
    'Dietary Fiber': {
        units: [ 'g' ]
    },
    'Sugars': {
        units: [ 'g' ]
    },
    'Includes Added Sugars': {
        units: [ 'g' ]
    },
    'Sugar Alcohol': {
        units: [ 'g' ]
    },
    'Protein': {
        units: [ 'g' ]
    },
    'Vitamin D': {
        units: [ 'mcg', 'IU' ],
        conversion_factor: 40,
    },
    'Calcium': {
        units: [ 'mg' ]
    },
    'Iron': {
        units: [ 'mg' ]
    },
    'Potassium': {
        units: [ 'mg' ]
    },
    'Vitamin A': {
        units: [ 'mcg', 'IU' ],
        conversion_factor: 3.336,
    },
    'Vitamin C': {
        units: [ 'mg' ]
    },
    'Vitamin E': {
        units: [ 'mg', 'IU' ],
        conversion_factor: 1.5,
    },
    'Vitamin K': {
        units: [ 'µg', 'mcg' ]
    },
    'Thiamin': {
        units: [ 'mg' ]
    },
    'Riboflavin': {
        units: [ 'mg' ]
    },
    'Niacin': {
        units: [ 'mg' ]
    },
    'Vitamin B6': {
        units: [ 'mg' ]
    },
    'Folate': {
        units: [ 'µg', 'mcg' ]
    },
    'Folic Acid': {
        units: [ 'µg', 'mcg' ]
    },
    'Vitamin B12': {
        units: [ 'µg', 'mcg' ]
    },
    'Pantothenic Acid': {
        units: [ 'mg' ]
    },
    'Phosphorus': {
        units: [ 'mg' ]
    },
    'Magnesium': {
        units: [ 'mg' ]
    },
    'Zinc': {
        units: [ 'mg' ]
    },
    'Selenium': {
        units: [ 'µg', 'mcg' ]
    },
    'Copper': {
        units: [ 'mg' ]
    },
    'Manganese': {
        units: [ 'mg' ]
    },
};


const snakeCase = str =>
      str &&
      str
      .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
      .map(x => x.toLowerCase())
      .join('_');


main();


function main() {
    parse();
    while (true) {

        if (!lookingAtKeyword()) {
            process.stdout.write('Skipping: ');
            while (!lookingAtKeyword()) {
                let skip = getToken();
                if (skip === -1) {
                    finalize();
                }
                process.stdout.write(skip + ' ');
            }
            console.log();
        }

        let keyword = getKeyword();
        if (keyword === 'Serving Size') {
            parseServingSize(keyword);
            continue;
        } else {
            parseValue(keyword);
        }
    }
}


function parseServingSize(keyword) {
    let value;
    while (!lookingAtKeyword()) {
        if (!value) {
            value = getToken();
            continue;
        }
        value += ' ' + getToken();
    }

    console.log(keyword + ': ' + value);
    let property = snakeCase(keyword);
    nutrients[property] = value;
}


function parseValue(keyword) {
    let value = getToken();
    let metadata = keywords[keyword];
    let property = snakeCase(keyword);

    if (metadata.units) {
        let unit;
        for (let validUnit of metadata.units) {
            if (value.endsWith(validUnit)) {
                unit = value.substring(value.length - validUnit.length);
                value = value.substring(0, value.length - validUnit.length);
                break;
            }
        }

        if (!unit) {
            console.error('ERROR: Unexpected units (expected ' + metadata.units[0] + '): ' + keyword + ': ' + value + ' ' + unit);
            process.exit(1);
        }

        if (metadata.conversion_factor && unit !== 'IU') {
            value = parseFloat(value) * metadata.conversion_factor;
        }
    }

    nutrients[property] = value;
    console.log(keyword + ': ' + value);
}


function lookingAtKeyword() {
    // console.log('Looking at? ' + getPeek(1) + ' ' + getPeek(2) + ' ' + getPeek(3));
    for (let keyword of Object.keys(keywords)) {
        let keywordTokens = keyword.split(' ');
        switch (keywordTokens.length) {
        case 1:
            if (getPeek(1) !== keywordTokens[0]) {
                continue;
            }
            return true;
        case 2:
            if (getPeek(1) !== keywordTokens[0]) {
                continue;
            }
            if (getPeek(2) !== keywordTokens[1]) {
                continue;
            }
            return true;
        case 3:
            if (getPeek(1) !== keywordTokens[0]) {
                continue;
            }
            if (getPeek(2) !== keywordTokens[1]) {
                continue;
            }
            if (getPeek(3) !== keywordTokens[2]) {
                continue;
            }
            return true;
        }
    }
}


function getKeyword() {
    let token = getToken();
    // console.log(token);
    for (let keyword of Object.keys(keywords)) {
        let keywordTokens = keyword.split(' ');
        // console.log(keywordTokens);
        switch (keywordTokens.length) {
        case 1:
            if (token !== keywordTokens[0]) {
                continue;
            }
            return keyword;
        case 2:
            if (token !== keywordTokens[0]) {
                continue;
            }
            if (getPeek(1) !== keywordTokens[1]) {
                continue;
            }
            getToken();
            return keyword;
        case 3:
            if (token !== keywordTokens[0]) {
                continue;
            }
            if (getPeek(1) !== keywordTokens[1]) {
                continue;
            }
            if (getPeek(2) !== keywordTokens[2]) {
                continue;
            }
            getToken();
            getToken();
            return keyword;
        }
    }
}


function parse() {
    for (let line of fs.readFileSync('./wf', 'utf-8').split(/\r?\n/)) {
        if (line === '') {
            continue;
        }
        for (let word of line.split(' ')) {
            tokens.push(word);
        }
    }
    currentTokenNumber = -1;
    console.log(tokens);
}


function getToken() {
    if (currentTokenNumber > tokens.length) {
        return -1;
    }

    currentTokenNumber++;
    return tokens[currentTokenNumber];
}


function getPeek(n) {
    return tokens[currentTokenNumber + n];
}


function finalize() {
    // nutrients.netcarbs = parseInt(nutrients.carbohydrates) - parseInt(nutrients.fiber) - parseInt(nutrients.sugar_alcohol);
    console.log(JSON.stringify(nutrients, null, 4));
    print();
    process.exit(1);
}

function print() {
    let DELIM = '|';
    process.stdout.write('=split("');

    process.stdout.write((nutrients.serving_size || 0) + DELIM)
    process.stdout.write((nutrients.calories || 0) + DELIM)
    process.stdout.write((nutrients.total_fat || 0) + DELIM)
    process.stdout.write((nutrients.saturated_fat || 0) + DELIM)
    process.stdout.write((nutrients.trans_fat || 0) + DELIM)
    process.stdout.write((nutrients.polyunsaturated_fat || 0) + DELIM)
    process.stdout.write((nutrients.monounsaturated_fat || 0) + DELIM)
    process.stdout.write((nutrients.cholesterol || 0) + DELIM)
    process.stdout.write((nutrients.sodium || 0) + DELIM)
    process.stdout.write((nutrients.total_carbohydrates || 0) + DELIM)
    process.stdout.write((nutrients.dietary_fiber || 0) + DELIM)
    process.stdout.write((nutrients.sugars || 0) + DELIM)
    process.stdout.write((nutrients.sugars_added || 0) + DELIM)
    process.stdout.write((nutrients.sugars_alcohol || 0) + DELIM)

    process.stdout.write('0' + DELIM)
    // process.stdout.write("=indirect(concat('Z', ROW())) - indirect(concat('AA', ROW())) - indirect(concat('AD', ROW()))" + DELIM);

    process.stdout.write((nutrients.protein || 0) + DELIM)

    process.stdout.write((nutrients.omega_3 || 0) + DELIM)

    process.stdout.write((nutrients.vitamin_d || 0) + DELIM)
    process.stdout.write((nutrients.calcium || 0) + DELIM)
    process.stdout.write((nutrients.iron || 0) + DELIM)
    process.stdout.write((nutrients.potassium || 0) + DELIM)

    process.stdout.write('0' + DELIM)
    process.stdout.write('0' + DELIM)
    // process.stdout.write("'=indirect(concat(CHAR(34)&N&CHAR(34), ROW()))" + DELIM);
    // process.stdout.write('=indirect(concat("Q", ROW()))' + DELIM);

    process.stdout.write((nutrients.vitamin_a || 0) + DELIM)
    process.stdout.write((nutrients.vitamin_c || 0) + DELIM)
    process.stdout.write((nutrients.vitamin_e || 0) + DELIM)
    process.stdout.write((nutrients.vitamin_k || 0) + DELIM)
    process.stdout.write((nutrients.thiamin || 0) + DELIM)
    process.stdout.write((nutrients.riboflavin || 0) + DELIM)
    process.stdout.write((nutrients.niacin || 0) + DELIM)
    process.stdout.write((nutrients.vitamin_b6 || 0) + DELIM)
    process.stdout.write((nutrients.folate || 0) + DELIM)
    // process.stdout.write((nutrients.folic_acid || 0) + DELIM)
    process.stdout.write((nutrients.vitamin_b12 || 0) + DELIM)
    process.stdout.write((nutrients.pantothenic_acid || 0) + DELIM)
    process.stdout.write((nutrients.phosphorus || 0) + DELIM)
    process.stdout.write((nutrients.magnesium || 0) + DELIM)
    process.stdout.write((nutrients.zinc || 0) + DELIM)
    process.stdout.write((nutrients.selenium || 0) + DELIM)
    process.stdout.write((nutrients.copper || 0) + DELIM)
    process.stdout.write(nutrients.manganese || 0);

    process.stdout.write('", "' + DELIM + '"\)');
    console.log();
}
