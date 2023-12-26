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
    let ingredients = YAML.load(fs.readFileSync('./ingredients.yaml', 'utf8'));
    let nutrients = YAML.load(fs.readFileSync('./nutrients.yaml', 'utf8'));

    for (let ingredient of ingredients) {
        if (ingredient.skip) {
            continue
        }

        let body = (await curl.get(ingredient.url)).body
        body = body.replace(/<[^<]+>/g, "")
        body = body.replace(/\n/g, "")
        body = body.replace(/\n/g, "")
        body = body.replace(/\\/g, "")
        body = body.replace(/.+{"props":/g, "{\"props\":")
        body = body.replace(/"globalAlert.*$/, "")
        body = body.replace(/,$/, "}}}")
        // p4(body)

        let wholeFoods = JSON.parse(body)
        p4(wholeFoods)
        let wf = wholeFoods.props.pageProps.data


        let data = []


        // name (from our input YAML file)
        // fullName: Ingredient proper name
        // url: whole foods ingredient url
        // imageUrl: whole foods image url
        // brand: whole foods brand
        // category: whole foods category
        data.push({ name: 'name', value: ingredient.name })
        data.push({ name: 'fullName', value: mapName(wf.name) })
        data.push({ name: 'url', value: ingredient.url })
        data.push({ name: 'imageUrl', value: wf.images[0].image })
        data.push({ name: 'brand', value: mapBrand(wf.brand.name) })
        data.push({ name: 'category', value: mapCategory(wf.categories.name) })


        // TODO: Flag nasty ingredients
        // Ingredients
        let ingredients = []
        for (let ingredient of wf.ingredients) {
            ingredient = ingredient.replace(/(?<=[^(]*\([^()]*),(?=[^)]*\))/g, ";")
            ingredient = ingredient.replace(/(?<=[^(]*\([^()]*)\.(?=[^)]*\))/g, "")
            ingredient = ingredient.replace(/(?<=[^\[]*\[[^\[\]]*),(?=[^\]]*\])/g, ";")
            ingredient = ingredient.replace(/(?<=[^\[]*\[[^\[\]]*)\.(?=[^\]]*\])/g, "")
            for (let separatedIngredient of ingredient.split(/,/)) {
                separatedIngredient = separatedIngredient.trim()
                separatedIngredient = separatedIngredient.replace(/Ingredients: /, "")
                separatedIngredient = separatedIngredient.replace(/\.$/, "")
                ingredients.push(separatedIngredient)
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


        // Consumption Unit
        if (ingredient.consumptionUnit) {
            data.push({ name: 'consumptionUnit', value: ingredient.consumptionUnit })
            data.push({ name: 'consumptionGrams', value: ingredient.consumptionGrams })
        } else {
            data.push({ name: 'consumptionUnit', value: "grams" })
            data.push({ name: 'consumptionGrams', value: "1" })
        }
        p4(data);


        let macroNutrientData = []


        // Serving Size
        let servingSize = wf.servingInfo.secondaryServingSize
        if (wf.servingInfo.secondaryServingSizeUom !== 'g' && wf.servingInfo.secondaryServingSizeUom !== 'G') {
            if (!ingredient['conversion_factor']) {
                console.error('ERROR: No conversion factor exists for ' + ingredient.name)
                console.error(wf.servingInfo);
                // process.exit(1)
            } else {
                servingSize *= ingredient.conversion_factor
            }
        }
        data.push({ name: "servingSize", value: servingSize })


        p4(_.map(wf.nutritionElements, item => _.pick(item, [ 'key', 'uom', 'perServing', 'perServingDisplay' ])));
        for (let nutrient of nutrients) {

            let wfNutrient = _.find(wf.nutritionElements, { key: nutrient.wf_key })
            if (!wfNutrient) {
                console.log('Could not find: ' + nutrient.wf_key);
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

                if (_.has(nutrient, 'alternative_unit')) {
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
        p4(data)
        let carbs = _.find(data, { name: 'carbohydrates' });
        let fiber = _.find(data, { name: 'fiber' });
        if (carbs) {
            data.push({ name: "netCarbs", value: carbs.value - fiber.value })
        }


        p4(_.map(wf.nutritionElements, item => _.pick(item, [ 'key', 'uom', 'perServing', 'perServingDisplay' ])));
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
    p(data)

    y(data, 'name', '', '- ')
    y(data, 'brand')
    y(data, 'fullName')
    y(data, 'url')
    y(data, 'totalCost')
    y(data, 'totalGrams')
    y(data, 'category')
    y(data, 'ingredients')
    y(data, 'allergens')

    y(data, 'consumptionUnit')
    y(data, 'consumptionGrams')

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
}


function y(list, name) {
    let prefix = '  ';
    let stanza = _.find(list, { name: name })
    if (!stanza) {
        console.log(prefix + name + ': ' + 0);
        return;
    }

    if (Array.isArray(stanza.value)) {
        console.log(prefix + name + ':')
        for (let item of stanza.value) {
            console.log(prefix + "- " + item)
        }
        return
    }

    console.log(prefix + name + ': ' + stanza.value);
}
