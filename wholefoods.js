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
    for (let ingredient of ingredients) {
        if (ingredient.skip) {
            continue
        }

        // await save(ingredient);
        let wf = read(ingredient);
        p4(wf)
        process.exit(1);


        const filteredAndMappedData = _(wf)
              .map(item => ({
                  name: item.key,
                  amount: item.perServing,
                  unit: item.uom,
              }));

        // p4(filteredAndMappedData);
    }
}



async function save(ingredient) {
    let body = (await curl.get(ingredient.url)).body

    // Remove a bunch of HTML noise in the response
    body = body.replace(/<[^<]+>/g, '')
    body = body.replace(/\n/g, '')
    body = body.replace(/\n/g, '')
    body = body.replace(/\\/g, '')
    body = body.replace(/.+{"props":/g, "{\"props\":")
    body = body.replace(/"globalAlert.*$/, "")
    body = body.replace(/,$/, "}}}")

    let wf = JSON.parse(body).props.pageProps.data;
    p('Saving ' + ingredient.name + '.yaml');
    fs.writeFileSync(ingredient.name + '.yaml', YAML.dump(wf), 'utf8');
}


function read(ingredient) {
    return YAML.load(fs.readFileSync(ingredient.name + '.yaml', 'utf8'));
}
