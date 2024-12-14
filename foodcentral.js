'use strict'
process.env.DEBUG = 'nutrients'

const fs = require('fs')
const YAML = require('js-yaml');

const d = require('debug')('nutrients')
const p = require('./lib/pr').p(d)
const p4 = require('./lib/pr').p4(d)

const _ = require('lodash')
const curl = require('./lib/curl')
const table = require('./lib/table').table


var nutrients = {
    'Energy': 'calories',

    'Lipids': 'fat',
    'Total lipid (fat)': 'fat',
    'Fatty acids, total saturated': 'saturatedFat',
    'Fatty acids, total monounsaturated': 'monosaturatedFat',
    'Fatty acids, total polyunsaturated': 'polysaturatedFat',
    'Fatty acids, total trans': 'transFat',

    'Alcohol, ethyl': 'alcohol',

    'Cholesterol': 'cholesterol',

    'Carbohydrates': 'carbohydrates',
    'Carbohydrate, by difference': 'carbohydrates',
    'Sugars, total including NLEA': 'sugar',
    'Fiber, total dietary': 'fiber',

    'Protein': 'protein',

    'Iron, Fe': 'iron',
    'Magnesium, Mg': 'magnesium',
    'Manganese, Mn': 'manganese',
    'Phosphorus, P': 'phosphorus',
    'Potassium, K': 'potassium',
    'Sodium, Na': 'sodium',
    'Zinc, Zn': 'zinc',
    'Calcium, Ca': 'calcium',
    'Copper, Cu': 'copper',
    'Selenium, Se': 'selenium',

    'Folic acid': 'folicAcid',
    'Vitamin A, RAE': 'vitaminA',
    'Vitamin E (alpha-tocopherol)': 'vitaminE',
    'Vitamin D (D2 + D3)': 'vitaminD',
    'Vitamin C, total ascorbic acid': 'vitaminC',
    'Thiamin': 'thiamin',
    'Riboflavin': 'riboflavin',
    'Niacin': 'niacin',
    'Vitamin B-6': 'vitaminB6',
    'Folate, total': 'xx',
    'Vitamin B-12': 'vitaminB12',
    'Vitamin K (phylloquinone)': 'vitaminK',
    'Vitamin E, added': 'vitaminE',
}


main()


async function main() {
    // let config = YAML.load(fs.readFileSync('./nutrients.yaml', 'utf8'));
    let body = JSON.parse(fs.readFileSync('./chicken.json', 'utf8'));

    const filteredAndMappedData = _(body.foodNutrients)
          .filter(item => !_.has(nutrients, item.nutrient.name))
          .map(item => ({
              name: item.nutrient.name,
              amount: item.amount,
              unit: item.nutrient.unitName,
          }));

    // const filteredAndMappedData = _(body.foodNutrients)
    //       .filter(item => _.has(nutrients, item.nutrient.name))
    //       .map(item => ({
    //           name: nutrients[item.nutrient.name],
    //           amount: item.amount,
    //           unit: item.nutrient.unitName,
    //       }));

    p4(filteredAndMappedData);
}
