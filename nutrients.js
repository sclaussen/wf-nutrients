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


main()


async function main() {
    let config = YAML.load(fs.readFileSync('./nutrients.yaml', 'utf8'));
    let ingredients = config.ingredients;
    let nutrients = config.nutrients;

    for (let ingredient of ingredients) {
        if (ingredient.skip) {
            continue
        }

        // Retrieve the URL from whole foods
        let body = (await curl.get(ingredient.url)).body


        // Remove a bunch of noise in the response
        body = body.replace(/<[^<]+>/g, '')
        body = body.replace(/\n/g, '')
        body = body.replace(/\n/g, '')
        body = body.replace(/\\/g, '')
        body = body.replace(/.+{"props":/g, "{\"props\":")
        body = body.replace(/"globalAlert.*$/, "")
        body = body.replace(/,$/, "}}}")

        let wf = JSON.parse(body).props.pageProps.data
        p4(wf)


        let data = []
        let warnings = []


        // name (from our input YAML file)
        // fullName: Ingredient proper name
        // url: whole foods ingredient url
        // imageUrl: whole foods image url
        // brand: whole foods brand
        // category: whole foods category
        data.push({ name: 'name', value: ingredient.name })
        data.push({ name: 'fullName', value: mapName(wf.name) })
        data.push({ name: 'url', value: ingredient.url })
        data.push({ name: 'note', value: ingredient.note || '' })
        data.push({ name: 'imageUrl', value: wf.images[0].image })
        data.push({ name: 'brand', value: mapBrand(wf.brand.name) })
        data.push({ name: 'category', value: mapCategory(wf.categories.name) })


        // TODO: Flag nasty ingredients
        // Ingredients
        let ingredients = []
        for (let ingredient of wf.ingredients) {
            ingredient = ingredient.replace(/(?<=[^(]*\([^()]*),(?=[^)]*\))/g, ';')
            ingredient = ingredient.replace(/(?<=[^(]*\([^()]*)\.(?=[^)]*\))/g, '')
            ingredient = ingredient.replace(/(?<=[^\[]*\[[^\[\]]*),(?=[^\]]*\])/g, ';')
            ingredient = ingredient.replace(/(?<=[^\[]*\[[^\[\]]*)\.(?=[^\]]*\])/g, '')
            for (let separatedIngredient of ingredient.split(/,/)) {
                separatedIngredient = separatedIngredient.trim()
                separatedIngredient = separatedIngredient.replace(/Ingredients: /, '')
                separatedIngredient = separatedIngredient.replace(/\.$/, '')
                ingredients.push(separatedIngredient)

                if (separatedIngredient.includes('cane')) {
                    warnings.push(separatedIngredient);
                }
            }
        }
        data.push({ name: 'ingredients', value: ingredients })


        // Allergens
        let allergens = []
        if (wf.allergens) {
            for (let allergen of wf.allergens) {
                allergens.push(allergen)
            }
        }
        data.push({ name: 'allergens', value: allergens })


        // Serving Size
        // Normal:
        // {
        //   servingSize: 1,
        //   servingSizeUom: 'cup',
        //   secondaryServingSize: 144,
        //   secondaryServingSizeUom: 'g',
        //   totalSize: 12,
        //   totalSizeUom: 'oz',
        //   secondaryTotalSize: 340,
        //   secondaryTotalSizeUom: 'g',
        //   servingsPerContainerDisplay: 'Varies'
        // }
        //
        // Oils:
        // {
        //   servingSize: 1,
        //   servingSizeUom: 'tbsp',
        //   servingSizeDisplay: '1',
        //   secondaryServingSize: 15,
        //   secondaryServingSizeUom: 'ml',
        //   secondaryServingSizeDisplay: '15',
        //   totalSize: 16.9,
        //   totalSizeUom: 'fl oz',
        //   secondaryTotalSize: 500,
        //   secondaryTotalSizeUom: 'ml',
        //   servingsPerContainer: 33,
        //   servingsPerContainerDisplay: '33'
        // }
        if (_.has(ingredient, 'consumptionUnit')) {
            data.push({ name: 'consumptionUnit', value: ingredient.consumptionUnit });
            data.push({ name: 'consumptionGrams', value: ingredient.consumptionGrams });
            data.push({ name: 'servingSize', value: ingredient.servingSize })
        } else {
            if (wf.servingInfo.secondaryServingSizeUom.toLowerCase() !== 'g') {
                console.error('ERROR: Unknown serving size unit of measure for ' + nutrient.name + ': ' + wf.servingInfo);
                process.exit(1)
            }
            data.push({ name: 'consumptionUnit', value: 'gram' });
            data.push({ name: 'consumptionGrams', value: 1 });
            data.push({ name: 'servingSize', value: wf.servingInfo.secondaryServingSize })
        }


        // p4(_.map(wf.nutritionElements, item => _.pick(item, [ 'key', 'uom', 'perServing', 'perServingDisplay' ])));
        for (let nutrient of nutrients) {

            let wfNutrient = _.find(wf.nutritionElements, { key: nutrient.wf_key })
            if (!wfNutrient) {
                // console.log('Could not find: ' + nutrient.wf_key);
                if (nutrient.required) {
                    process.exit(1);
                }
                continue
            }

            // By default we use perServing, it is more precise.
            // However, we found a situation where a nutrient only had
            // a perServingDisplay value but not a perServing value,
            // so defaulting if necessary.
            let amount = wfNutrient.perServing || wfNutrient.perServingDisplay;

            // If the whole foods nutrient uses a different unit of
            // measure, verify that it's a known uom, and convert it
            // if required.
            if (wfNutrient.uom !== nutrient.unit) {

                if (!_.has(nutrient, 'alternate_unit')) {
                    console.error('ERROR: The Whole Foods nutrient\'s unit of measure is unknown: ' + nutrient.name + '/' + wfNutrient.uom)
                    process.exit(1)
                } else if (wfNutrient.uom !== nutrient.alternate_unit.unit) {
                    console.error('ERROR: The Whole Foods nutrient\'s unit of measure is unknown: ' + nutrient.name + '/' + wfNutrient.uom)
                    process.exit(1)
                }

                if (nutrient.alternate_unit.conversion_factor) {
                    console.log('Converting ' + nutrient.name + ': ' + amount + ' * ' + nutrient.alternate_unit.conversion_factor);
                    amount = amount * nutrient.alternate_unit.conversion_factor
                    p(amount);
                }
            }

            data.push({ name: nutrient.name, value: amount })
        }


        // Add netcarbs to the macro nutrients
        let carbs = _.find(data, { name: 'carbohydrates' });
        let fiber = _.find(data, { name: 'fiber' }) || { value: 0 };
        if (carbs) {
            data.push({ name: 'netCarbs', value: carbs.value - fiber.value })
        }


        // Warnings
        data.push({ name: 'warnings', value: warnings });

        // p4(_.map(wf.nutritionElements, item => _.pick(item, [ 'key', 'uom', 'perServing', 'perServingDisplay' ])));
        serialize(data)
        console.log()
    }
}


function mapCategory(category) {
    category = category.replace(/u0026/g, '&')
    return category
}


function mapName(name) {
    name = name.replace(/u0026/g, '&')
    return name
}


function mapBrand(brand) {
    if (brand == '365 BY WFM') return 'Whole Foods 365'
    if (brand == '365 Everyday Value®') return 'Whole Foods 365'
    if (brand == 'PRODUCE') return 'Whole Foods 365'
    if (brand == '365 by Whole Foods Market') return 'Whole Foods 365'
    if (brand == 'Whole Foods Market') return 'Whole Foods 365'
    if (brand == 'BHU FOODS') return 'Bhu Foods'
    if (brand == 'siggi\'s') return 'Siggi\'s'
    brand = brand.replace(/u0026/g, '&')
    return brand
}


function serialize(data) {
    // p(data)

    y(data, 'name')
    // y(data, 'brand')
    // y(data, 'fullName')
    // y(data, 'note')
    // y(data, 'url')
    // y(data, 'imageUrl')
    // y(data, 'category')
    // y(data, 'ingredients')
    // y(data, 'allergens')

    y(data, 'servingSize')
    y(data, 'calories')

    y(data, 'fat')
    y(data, 'saturatedFat')
    y(data, 'transFat')
    y(data, 'polyunsaturatedFat')
    y(data, 'monounsaturatedFat')

    y(data, 'cholesterol')
    y(data, 'sodium')

    y(data, 'carbohydrates')
    y(data, 'fiber')
    y(data, 'sugar')
    y(data, 'addedSugar')
    y(data, 'sugarAlcohool')
    y(data, 'netCarbs')

    y(data, 'protein')

    y(data, 'omega3')
    y(data, 'zinc')
    y(data, 'vitaminK')
    y(data, 'vitaminE')
    y(data, 'vitaminD')
    y(data, 'vitaminC')
    y(data, 'vitaminB6')
    y(data, 'vitaminB12')
    y(data, 'vitaminA')
    y(data, 'thiamin')
    y(data, 'selenium')
    y(data, 'riboflavin')
    y(data, 'potassium')
    y(data, 'phosphorus')
    y(data, 'pantothenicAcid')
    y(data, 'niacin')
    y(data, 'manganese')
    y(data, 'magnesium')
    y(data, 'iron')
    y(data, 'folicAcid')
    y(data, 'folate')
    y(data, 'copper')
    y(data, 'calcium')

    y(data, 'consumptionUnit')
    y(data, 'consumptionGrams')

    // y(data, 'warnings')
}


function y(list, name) {
    let prefix = '  ';
    let stanza = _.find(list, { name: name })
    if (!stanza) {
        // console.log(prefix + name + ': ' + 0);
        return;
    }

    if (Array.isArray(stanza.value)) {
        console.log(prefix + name + ':')
        for (let item of stanza.value) {
            console.log(prefix + '- ' + item)
        }
        return
    }

    if (typeof stanza.value === 'number') {
        console.log(prefix + name + ': ' + roundToThousandth(stanza.value));
    } else {
        console.log(prefix + name + ': ' + stanza.value);
    }
}


function roundToThousandth(num) {
    return Math.round(num * 1000) / 1000;
}
