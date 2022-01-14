'use strict'

/* Required npm packages and Initialization*/

import AWS = require("aws-sdk");
AWS.config.update({
    region: 'eu-west-2',
});
const bucket = process.env.S3_DATA_BUCKET;

/* 
    This function is invoked when managers want to add stores in to the DB
 */
module.exports.handler = async (event:any, context: any) => {

    try {
        
        // phone number needs to be an array of phone numbers.
        let phoneNumbers = []
        
        // check if the lambda is called from amazon connect. this is a custom parameter passed in the contact flow
        if(event?.Details?.Parameters?.connect==='true'){
            const callerNumber = event?.Details?.ContactData?.CustomerEndpoint?.Address;
            // remove country code and use last 10 digits as the phone number.
            phoneNumbers.push(callerNumber.substring(callerNumber.length-10,callerNumber.length))
        } else if(event?.phoneNumbers) {
            phoneNumbers = event.phoneNumbers;
        }
        
        const allVanities = JSON.parse(await readObjBucket(bucket,"vanity.json"));

        let vanityNumbers = []
        let tts = 'Opps something went wrong'

        console.time("lookup")

        // lookup vanity for every word
        for (let index = 0; index < phoneNumbers.length; index++) {
            const phoneNumber = phoneNumbers[index];
            let potentialWords: potentialWordsIF = {};

            // generate all the potential words for a given phone number.
            for (let numberPhrase in allVanities) {
                if (phoneNumber.includes(numberPhrase)) {
                    if (potentialWords[numberPhrase.length] === undefined) {
                        potentialWords[numberPhrase.length] = {}
                    }
                    potentialWords[numberPhrase.length][numberPhrase] = allVanities[numberPhrase];
                }
            }

            // this function returns the top x vanity numbers for a given phone number. optional 3rd parameter can be passed to limit how many vanity words to be returned defaults to 5
            const topXVanity = topXVanityNumbers(phoneNumber, potentialWords)
            vanityNumbers.push({ [phoneNumber]: topXVanity })

            // insert number and vanity numbers into dynamodb 
            await insertDB('VANITY','phoneNumber#'+phoneNumber,topXVanity)
            
            // maintain last caller feature to display in the public web page.
            let lastcaller = JSON.parse(await readObjBucket(bucket+"/public","lastcaller.json")).lastcaller;
            
            if(lastcaller.length<5){
                lastcaller.push({"phoneNumber":phoneNumber,"vanityNumbers":topXVanity})
            } else {
                lastcaller.splice(lastcaller.length-1,1);
                lastcaller.splice(0,0,{"phoneNumber":phoneNumber,"vanityNumbers":topXVanity})
            }

            // update the lastcaller.json
            await writeObjBucket(bucket+"/public","lastcaller.json",JSON.stringify({lastcaller:lastcaller}));

            // Prepare ttl friendly message for amazon connect to read it out. this message is usable only for the last number in the array.
            let ttlVanity=[]

            for (let index = 0; index < topXVanity.length; index++) {
                let numSplit = topXVanity[index].split("-")
                for (let j = 0; j < numSplit.length; j++) {
                    let split:any = numSplit[j];

                    if(!isNaN(split)){
                        numSplit[j] = split.split('').join(" ")
                    }else{
                        numSplit[j] = " "+split+" ";                            
                    }
                }
                ttlVanity.push(numSplit.join(""))
            }

            tts = `Congradulations, We have successfully found ${topXVanity.length} vanity numbers. ${ttlVanity.join(", ")}. Goodbye`

        }
        
        console.timeEnd("lookup")

        return { message: "success in executing", tts:tts };

        /* Return success with a since the program flow made it till here */

    } catch (error) {

        /* Errors thrown in the catch-blocks inside 'try' goes here */
        console.log({ message: "error", error: error });
        return { message: "error", error: error };

    }
}

function topXVanityNumbers(phoneNumber: string, potentialWords: potentialWordsIF, topX?: number,minimumLength?: number) {

    try {

        // loop over the `potentialWords` and return top X
        let suggestedVanities: string[] = []
        let sortedWordSize = Object.keys(potentialWords).sort().reverse();

        // define the smallest word to match in the number, default 2
        // define the top X best vanity numbers to lookup, default 5

        if (topX === undefined) {
            topX = 5 // top 5 
        }
        if (minimumLength === undefined) {
            minimumLength = 2
        }

        for (let i = 0; parseInt(sortedWordSize[i]) > minimumLength; i++) { // "word length" depth
            let numberPhrases = Object.keys(potentialWords[sortedWordSize[i]]);
            let j = 0;

            let wordsList: any[] = []
            numberPhrases.forEach(numberPhrase => {
                wordsList = wordsList.concat(potentialWords[sortedWordSize[i]][numberPhrase]);
            });
            wordsList = wordsList.sort((first, second) => {
                if (first[Object.keys(first)[0]] > second[Object.keys(second)[0]])
                    return -1
                if (first[Object.keys(first)[0]] < second[Object.keys(second)[0]])
                    return 1
                if (first[Object.keys(first)[0]] === second[Object.keys(second)[0]])
                    return 0
            })

            for (let topWordIndex = 0; topWordIndex < wordsList.length; topWordIndex++) {

                for (let k = 0; k < numberPhrases.length; k++) { // "number phrase" depth
                    if (suggestedVanities.length >= topX) {
                        // top X vanity numbers found. return number.
                        return suggestedVanities
                    }
                    const wordObjects = potentialWords[sortedWordSize[i]][numberPhrases[k]]
                    wordObjects.forEach(wordObj => {
                        // let word = Object.keys(potentialWords[sortedWordSize[i]][numberPhrases[k]][0])[0]
                        let word = Object.keys(wordObj)[0];
                        if (Object.keys(wordsList[topWordIndex])[0] === word) {

                            // string formatting being.
                            let vanityNumber = phoneNumber.replace(numberPhrases[k], "-" + word + "-")
                            // remove the "-" at the end if there is any
                            if (vanityNumber.charAt(vanityNumber.length - 1) === '-') {
                                vanityNumber = vanityNumber.slice(0, vanityNumber.length - 1);
                            }
                            // remove the "-" in the begining if there is any
                            if (vanityNumber.charAt(0) === '-') {
                                vanityNumber = vanityNumber.slice(1);
                            }
                            // string formatting end.

                            suggestedVanities.push(vanityNumber) // pick the most frequently used word in that list of frequent words.

                        }
                    });

                }
            }
        }

        return suggestedVanities
        
    } catch (error) {

        throw new Error('There seem to be an error in finding the top'+topX+' vanity numbers' + JSON.stringify(error));
        
    }

}

async function readObjBucket(bucket:string, filename:string) {
    const s3 = new AWS.S3({apiVersion: '2006-03-01'});
    
    // call S3 to retrieve file from specified bucket
    const data = await s3
    .getObject({ Bucket:bucket, Key:filename })
    .promise()
    .catch((e: any) => {
        throw new Error('Unable to read '+filename+' from s3' + JSON.stringify(e));
    });
    return data.Body.toString('ascii');
}

async function writeObjBucket(bucket:string, filename:string, body:any) {
    const s3 = new AWS.S3({apiVersion: '2006-03-01'});

    // call S3 to write a file to bucket
    await s3
    .putObject({ Bucket:bucket, Key:filename, Body:body })
    .promise()
    .catch((e: any) => {
        throw new Error('Unable to write '+filename+' to s3' + JSON.stringify(e));
    });
    return {message:"file successfully added to S3 Bucket"}
}

async function insertDB(HashKey:string,RangeKey:string,data:any){
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: process.env.DB_TABLE_NAME,
        Item: {
            HashKey: HashKey,
            RangeKey: RangeKey,
            data
        }
    };

    // insert data into dynamodb
    await dynamoDb
    .put(params)
    .promise()
    .catch((e:any) => {
        throw new Error('Unable to add insert into DB '+ JSON.stringify(e));
    });

    return {message:"successfully inserted"};

}

interface potentialWordsIF {
    [wordLength: string]: {
        [numberPhrase: string]: [{
            [word: string]: number
        }]
    }
}