'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
AWS.config.update({ region: 'eu-west-2' });
let wordFrequency = {};
module.exports.handler = async (event, context) => {
    try {
        const bucket = process.env.S3_DATA_BUCKET;
        const dictionary = JSON.parse(await readObjBucket(bucket, 'words_dictionary.json'));
        const unigramFreq = await readObjBucket(bucket, 'unigram_freq.csv');
        let rows = unigramFreq.split("\n");
        rows.forEach((row) => {
            let columns = row.split(",");
            wordFrequency[columns[0]] = parseInt(columns[1]);
        });
        let vanityObj = {};
        for (let word in dictionary) {
            if (word.length > 10)
                continue;
            let number = word2phoneNumber(word);
            if (vanityObj[number] === undefined) {
                vanityObj[number] = [{ [word]: getWordFrequency(word) }];
            }
            else {
                const index = insertionSort(word, vanityObj[number]);
                vanityObj[number].splice(index, 0, { [word]: getWordFrequency(word) });
            }
        }
        console.log(Object.keys(vanityObj).length + " words were processed and added in the vanity dictionary");
        await writeObjBucket(bucket, 'vanity.json', JSON.stringify(vanityObj));
        await writeObjBucket(bucket + "/public", 'lastcaller.json', JSON.stringify({ lastcaller: [] }));
        const bucketPolicy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "public-read-access",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": "arn:aws:s3:::" + bucket + "/public/*"
                }
            ]
        };
        await attachS3BucketPolicy(bucket, bucketPolicy);
        await addInvocationPermission('parrot-beak-dev-VanityLookup', '1');
        return { message: "Vanity words successfully generated and required permissions for resources are attached." };
    }
    catch (error) {
        console.log({ message: "error", error: error });
        return { message: "error", error: error };
    }
};
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
    return { message: "file successfully written to S3 Bucket" };
}
async function addInvocationPermission(functionName, statementId) {
    const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
    var params = {
        Action: 'lambda:InvokeFunction',
        FunctionName: functionName,
        Principal: 'connect.amazonaws.com',
        StatementId: statementId,
    };
    await lambda.addPermission(params)
        .promise()
        .catch((e) => {
        throw new Error('Unable to add invocation permission to ' + functionName + " " + JSON.stringify(e));
    });
}
async function attachS3BucketPolicy(bucketName, putPolicy) {
    const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    await s3
        .putBucketPolicy({ Bucket: bucketName, Policy: JSON.stringify(putPolicy) })
        .promise()
        .catch((e) => {
        throw new Error('Unable to attch bucket policy' + JSON.stringify(e));
    });
}
function word2phoneNumber(word) {
    try {
        word = word.toLowerCase();
        const vanityObj = {
            "a": 2, "b": 2, "c": 2,
            "d": 3, "e": 3, "f": 3,
            "g": 4, "h": 4, "i": 4,
            "j": 5, "k": 5, "l": 5,
            "m": 6, "n": 6, "o": 6,
            "p": 7, "q": 7, "r": 7, "s": 7,
            "t": 8, "u": 8, "v": 8,
            "w": 9, "x": 9, "y": 9, "z": 9
        };
        let phoneNumber = [];
        for (let index = 0; index < word.length; index++) {
            phoneNumber.push(vanityObj[word.charAt(index)]);
        }
        return phoneNumber.toString().replace(/,/g, '');
    }
    catch (error) {
        throw new Error('Unable to get phonenumber from word' + JSON.stringify(error));
    }
}
function getWordFrequency(word) {
    const frequency = wordFrequency[word];
    if (frequency === undefined) {
        return 0;
    }
    return frequency;
}
function insertionSort(newWord, array) {
    try {
        const newWordFrequency = getWordFrequency(newWord);
        const firstWord = Object.keys(array[0])[0];
        if (getWordFrequency(firstWord) < newWordFrequency)
            return 0;
        let index = 0;
        while (index < array.length - 1) {
            let currentWord = Object.keys(array[index])[0];
            let nextWord = Object.keys(array[index + 1])[0];
            if (getWordFrequency(currentWord) > newWordFrequency && newWordFrequency >= getWordFrequency(nextWord)) {
                return index + 1;
            }
            index++;
        }
        return index + 1;
    }
    catch (error) {
        throw new Error('Unable to perform insertion sort' + JSON.stringify(error));
    }
}
//# sourceMappingURL=generateVanityObj.js.map