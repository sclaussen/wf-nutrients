'use strict';


const curl = require('./curl');


async function slack(message) {
    await curl.post(process.env.HEALTH_SLACK, null, {
        "text": message
    });
}



module.exports.slack = slack;
