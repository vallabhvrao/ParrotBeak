'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
AWS.config.update({
    region: 'eu-west-2',
});
const bucket = process.env.S3_DATA_BUCKET;
module.exports.handler = async (event, context) => {
    var _a, _b, _c, _d, _e;
    try {
        let phoneNumbers = [];
        if (((_b = (_a = event === null || event === void 0 ? void 0 : event.Details) === null || _a === void 0 ? void 0 : _a.Parameters) === null || _b === void 0 ? void 0 : _b.connect) === 'true') {
            const callerNumber = (_e = (_d = (_c = event === null || event === void 0 ? void 0 : event.Details) === null || _c === void 0 ? void 0 : _c.ContactData) === null || _d === void 0 ? void 0 : _d.CustomerEndpoint) === null || _e === void 0 ? void 0 : _e.Address;
            phoneNumbers.push(callerNumber.substring(callerNumber.length - 10, callerNumber.length));
        }
        else if (event === null || event === void 0 ? void 0 : event.phoneNumbers) {
            phoneNumbers = event.phoneNumbers;
        }
        const allVanities = JSON.parse(await readObjBucket(bucket, "vanity.json"));
        let vanityNumbers = [];
        let tts = 'Opps something went wrong';
        console.time("lookup");
        for (let index = 0; index < phoneNumbers.length; index++) {
            const phoneNumber = phoneNumbers[index];
            let potentialWords = {};
            for (let numberPhrase in allVanities) {
                if (phoneNumber.includes(numberPhrase)) {
                    if (potentialWords[numberPhrase.length] === undefined) {
                        potentialWords[numberPhrase.length] = {};
                    }
                    potentialWords[numberPhrase.length][numberPhrase] = allVanities[numberPhrase];
                }
            }
            const topXVanity = topXVanityNumbers(phoneNumber, potentialWords);
            vanityNumbers.push({ [phoneNumber]: topXVanity });
            await insertDB('VANITY', 'phoneNumber#' + phoneNumber, topXVanity);
            let lastcaller = JSON.parse(await readObjBucket(bucket + "/public", "lastcaller.json")).lastcaller;
            if (lastcaller.length < 5) {
                lastcaller.push({ "phoneNumber": phoneNumber, "vanityNumbers": topXVanity });
            }
            else {
                lastcaller.splice(lastcaller.length - 1, 1);
                lastcaller.splice(0, 0, { "phoneNumber": phoneNumber, "vanityNumbers": topXVanity });
            }
            await writeObjBucket(bucket + "/public", "lastcaller.json", JSON.stringify({ lastcaller: lastcaller }));
            let ttlVanity = [];
            for (let index = 0; index < topXVanity.length; index++) {
                let numSplit = topXVanity[index].split("-");
                for (let j = 0; j < numSplit.length; j++) {
                    let split = numSplit[j];
                    if (!isNaN(split)) {
                        numSplit[j] = split.split('').join(" ");
                    }
                    else {
                        numSplit[j] = " " + split + " ";
                    }
                }
                ttlVanity.push(numSplit.join(""));
            }
            tts = `Congradulations, We have successfully found ${topXVanity.length} vanity numbers. ${ttlVanity.join(", ")}. Goodbye`;
        }
        console.timeEnd("lookup");
        return { message: "success in executing", tts: tts };
    }
    catch (error) {
        console.log({ message: "error", error: error });
        return { message: "error", error: error };
    }
};
function topXVanityNumbers(phoneNumber, potentialWords, topX, minimumLength) {
    try {
        let suggestedVanities = [];
        let sortedWordSize = Object.keys(potentialWords).sort().reverse();
        if (topX === undefined) {
            topX = 5;
        }
        if (minimumLength === undefined) {
            minimumLength = 2;
        }
        for (let i = 0; parseInt(sortedWordSize[i]) > minimumLength; i++) {
            let numberPhrases = Object.keys(potentialWords[sortedWordSize[i]]);
            let j = 0;
            let wordsList = [];
            numberPhrases.forEach(numberPhrase => {
                wordsList = wordsList.concat(potentialWords[sortedWordSize[i]][numberPhrase]);
            });
            wordsList = wordsList.sort((first, second) => {
                if (first[Object.keys(first)[0]] > second[Object.keys(second)[0]])
                    return -1;
                if (first[Object.keys(first)[0]] < second[Object.keys(second)[0]])
                    return 1;
                if (first[Object.keys(first)[0]] === second[Object.keys(second)[0]])
                    return 0;
            });
            for (let topWordIndex = 0; topWordIndex < wordsList.length; topWordIndex++) {
                for (let k = 0; k < numberPhrases.length; k++) {
                    if (suggestedVanities.length >= topX) {
                        return suggestedVanities;
                    }
                    const wordObjects = potentialWords[sortedWordSize[i]][numberPhrases[k]];
                    wordObjects.forEach(wordObj => {
                        let word = Object.keys(wordObj)[0];
                        if (Object.keys(wordsList[topWordIndex])[0] === word) {
                            let vanityNumber = phoneNumber.replace(numberPhrases[k], "-" + word + "-");
                            if (vanityNumber.charAt(vanityNumber.length - 1) === '-') {
                                vanityNumber = vanityNumber.slice(0, vanityNumber.length - 1);
                            }
                            if (vanityNumber.charAt(0) === '-') {
                                vanityNumber = vanityNumber.slice(1);
                            }
                            suggestedVanities.push(vanityNumber);
                        }
                    });
                }
            }
        }
        return suggestedVanities;
    }
    catch (error) {
        throw new Error('There seem to be an error in finding the top' + topX + ' vanity numbers' + JSON.stringify(error));
    }
}
async function readObjBucket(bucket, filename) {
    const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    const data = await s3
        .getObject({ Bucket: bucket, Key: filename })
        .promise()
        .catch((e) => {
        throw new Error('Unable to read ' + filename + ' from s3' + JSON.stringify(e));
    });
    return data.Body.toString('ascii');
}
async function writeObjBucket(bucket, filename, body) {
    const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    await s3
        .putObject({ Bucket: bucket, Key: filename, Body: body })
        .promise()
        .catch((e) => {
        throw new Error('Unable to write ' + filename + ' to s3' + JSON.stringify(e));
    });
    return { message: "file successfully added to S3 Bucket" };
}
async function insertDB(HashKey, RangeKey, data) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: process.env.DB_TABLE_NAME,
        Item: {
            HashKey: HashKey,
            RangeKey: RangeKey,
            data
        }
    };
    await dynamoDb
        .put(params)
        .promise()
        .catch((e) => {
        throw new Error('Unable to add insert into DB ' + JSON.stringify(e));
    });
    return { message: "successfully inserted" };
}
//# sourceMappingURL=vanityLookup.js.map