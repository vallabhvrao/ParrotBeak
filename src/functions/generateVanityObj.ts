'use strict'

/* Required npm packages and Initialization*/

import AWS = require("aws-sdk");
// configure aws region
AWS.config.update({region: 'eu-west-2'});

// declare this here, so that the functions can access the variable. this could be handeled differently
let wordFrequency:Record<string, Partial<number>>={}; // Key: word, value: frequency

/* 
    This function is to invoked as soon as the stack is deployed
 */
module.exports.handler = async (event: any, context: any) => {

    try {

        // console.time("generate"); // this was used to quickly check execution time in local environment

        /* S3 Bucket name stored in the environment variable */
        const bucket = process.env.S3_DATA_BUCKET;

        // dictionary of words in english.
        const dictionary = JSON.parse(await readObjBucket(bucket,'words_dictionary.json'));
        // database of words with their frequency of use. Refer readme for more.
        const unigramFreq:string = await readObjBucket(bucket,'unigram_freq.csv'); 
        
        // // read csv into an object
        let rows = unigramFreq.split("\n"); // SPLIT ROWS
        rows.forEach((row) => {
            let columns = row.split(","); //SPLIT COLUMNS
            wordFrequency[columns[0]] = parseInt(columns[1]);
        })
        
        // generate vanity object containing every word in english dictionary with respect to phone number sub string
        let vanityObj:{ [phoneNumber:string] : [ { [word:string]:number } ] } = {}; 
        
        for (let word in dictionary) {
            if(word.length>10) continue;
            let number = word2phoneNumber(word); // convert string (words) to phone number
            if(vanityObj[number]===undefined) {
                vanityObj[number] = [{ [word]:getWordFrequency(word)}];
            } else {
                const index = insertionSort(word,vanityObj[number]) // sort it in the order of 
                vanityObj[number].splice(index,0,{[word]:getWordFrequency(word)}); // push at index
            }
        }
        
        
        // log how many words were processed.
        console.log(Object.keys(vanityObj).length + " words were processed and added in the vanity dictionary");
        
        // write the generated Object in a json for future lookup, will be a database in production environment.
        await writeObjBucket(bucket,'vanity.json',JSON.stringify(vanityObj));

        // create an empty json file for storing last 5 callers.
        await writeObjBucket(bucket+"/public",'lastcaller.json',JSON.stringify({lastcaller:[]}));

        // attach bucket policy to make the bucket public for rest of the world
        const bucketPolicy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid":"public-read-access",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": "arn:aws:s3:::"+bucket+"/public/*"
                }
            ]
        }

        await attachS3BucketPolicy(bucket,bucketPolicy);

        // add lambda invoke permission to the VanityLookup lambda, so that Amazon Connect can call it.
        await addInvocationPermission('parrot-beak-dev-VanityLookup','1') // process.env.STAGE can be used to make this work in different stage env

        // console.timeEnd("generate"); 

        /* Return success with a since the program flow made it till here */
        return {message:"Vanity words successfully generated and required permissions for resources are attached."}

    } catch (error) {

        /* Errors thrown in the catch-blocks inside 'try' goes here */
        console.log({message:"error",error:error});
        return {message:"error",error:error};

    }
}

async function readObjBucket(bucket:string, filename:string) {
    const s3 = new AWS.S3({apiVersion: '2006-03-01'}); // set api version
    // get file from s3 bucket
    const data = await s3
    .getObject({ Bucket:bucket, Key:filename })
    .promise()
    .catch((e: any) => {
        // raise an exception in case there in an error, this error can be formatted better
        throw new Error('Unable to read '+filename+' from s3' + JSON.stringify(e));
    });
    return data.Body.toString('ascii'); // if there are no errors, return the content of the file
}

async function writeObjBucket(bucket:string, filename:string, body:string) {
    const s3 = new AWS.S3({apiVersion: '2006-03-01'}); // set api version
    // write file to s3 bucket
    await s3
    .putObject({ Bucket:bucket, Key:filename, Body:body })
    .promise()
    .catch((e: any) => {
        // raise an exception in case there in an error, this error can be formatted better
        throw new Error('Unable to write '+filename+' to s3' + JSON.stringify(e));
    });
    return {message:"file successfully written to S3 Bucket"} // return an successful message, will not be used anywhere most likely
}

async function addInvocationPermission(functionName:string,statementId:string){
    const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
    var params = {
        Action: 'lambda:InvokeFunction', /* required */
        FunctionName: functionName, /* required */
        Principal: 'connect.amazonaws.com', /* required */
        StatementId: statementId, /* required */
    }
    // add lambda invoke permissions.
    await lambda.addPermission(params)
    .promise()
    .catch((e: any) => {
        throw new Error('Unable to add invocation permission to '+functionName+" "+ JSON.stringify(e));
    });
}

async function attachS3BucketPolicy(bucketName:string,putPolicy:any){
    const s3 = new AWS.S3({apiVersion: '2006-03-01'});
    // attach bucket policy.
    await s3
    .putBucketPolicy({Bucket: bucketName, Policy:JSON.stringify(putPolicy)})
    .promise()
    .catch((e: any) => {
        throw new Error('Unable to attch bucket policy' + JSON.stringify(e));
    });

}

function word2phoneNumber(word:string):string {
// this function converts a given word to a phone number. 
// for example, "apple" will be converted to 27753
    try {
        word = word.toLowerCase() // make sure that the word is case insensitive 
        const vanityObj:Record<string, number> = {
            "a":2,"b":2,"c":2,
            "d":3,"e":3,"f":3,
            "g":4,"h":4,"i":4,
            "j":5,"k":5,"l":5,
            "m":6,"n":6,"o":6,
            "p":7,"q":7,"r":7,"s":7,
            "t":8,"u":8,"v":8,
            "w":9,"x":9,"y":9,"z":9
        }
        let phoneNumber = [];
        for (let index = 0; index < word.length; index++) {
            phoneNumber.push(vanityObj[word.charAt(index)]);
        }
        return phoneNumber.toString().replace(/,/g,'');            
    } catch (error) {
        throw new Error('Unable to get phonenumber from word' + JSON.stringify(error));
    }
}

function getWordFrequency(word:string){
    // this function return the word frequency for every word using the global `wordFrequency` variable. 
    // in production, a better way to handle global variables will be implimented. 
    // global variables are used as there are other dependent functions like `insertionSort()`
    const frequency = wordFrequency[word];
    if (frequency===undefined) {
        return 0;
    }
    return frequency;
}

function insertionSort(newWord:string,array:[{[word:string]:number}]):number {
    try {

        // this function takes a new word and the array of words for a phone number and return the index at which the word should be inserted in the order of high frequency word to low frequency word 
        const newWordFrequency = getWordFrequency(newWord);
        const firstWord = Object.keys(array[0])[0];
        if(getWordFrequency(firstWord) < newWordFrequency) return 0; // biggest word found, intert in the beginning    
        let index = 0
        while(index < array.length - 1) {
            let currentWord = Object.keys(array[index])[0];
            let nextWord = Object.keys(array[index+1])[0]
            if(getWordFrequency(currentWord) > newWordFrequency && newWordFrequency >= getWordFrequency(nextWord)){
                return index + 1 
            }
            index++
        }
        return index+1; // smallest word found, insert at the end
        
    } catch (error) {
        throw new Error('Unable to perform insertion sort' + JSON.stringify(error));        
    }
}
