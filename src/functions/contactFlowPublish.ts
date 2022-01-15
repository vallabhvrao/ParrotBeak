'use strict';

import AWS = require('aws-sdk');
var response = require('cfn-response');
const axios = require('axios');
const connect = new AWS.Connect({apiVersion: '2017-08-08'});

module.exports.handler = async (event:any, context:any) => {
	try {

		if (event.RequestType === 'Create' || event.RequestType === 'Update') {

			let listContactFlowParams = {
				InstanceId: process.env.CONNECT_INSTANCE_ID, /* required */
				ContactFlowTypes: ['CONTACT_FLOW']
			};
			let listContactFlow = await connect.listContactFlows(listContactFlowParams).promise()
			let isContactFlowExist:boolean = false;
			for (let index = 0; index < listContactFlow.ContactFlowSummaryList.length; index++) {
				if(listContactFlow.ContactFlowSummaryList[index].Name==='Vanity-ContactFlow'){
					isContactFlowExist = true;
				}				
			}

			if(!isContactFlowExist){
				const params = {
					Content: "{\"Version\":\"2019-10-30\",\"StartAction\":\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\",\"Metadata\":{\"entryPointPosition\":{\"x\":20,\"y\":20},\"snapToGrid\":false,\"ActionMetadata\":{\"15ccc138-c6ac-4967-a926-591505f99967\":{\"position\":{\"x\":615,\"y\":148},\"useDynamic\":true},\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\":{\"position\":{\"x\":134,\"y\":180},\"useDynamic\":false},\"85fae6ff-1e37-40ff-b178-312820a736d4\":{\"position\":{\"x\":149,\"y\":360}},\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\":{\"position\":{\"x\":389,\"y\":146},\"dynamicMetadata\":{\"connect\":false},\"useDynamic\":false},\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\":{\"position\":{\"x\":625,\"y\":322},\"useDynamic\":false}}},\"Actions\":[{\"Identifier\":\"15ccc138-c6ac-4967-a926-591505f99967\",\"Parameters\":{\"Text\":\"$.External.tts\"},\"Transitions\":{\"NextAction\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"},{\"Identifier\":\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\",\"Parameters\":{\"Text\":\"Thanks for calling. Please wait while we lookup vanity numbers for the dialed phone number.\"},\"Transitions\":{\"NextAction\":\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"},{\"Identifier\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Type\":\"DisconnectParticipant\",\"Parameters\":{},\"Transitions\":{}},{\"Identifier\":\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\",\"Parameters\":{\"LambdaFunctionARN\":\""+process.env.LOOKUP_ARN+"\",\"InvocationTimeLimitSeconds\":\"8\",\"LambdaInvocationAttributes\":{\"connect\":\"true\"}},\"Transitions\":{\"NextAction\":\"15ccc138-c6ac-4967-a926-591505f99967\",\"Errors\":[{\"NextAction\":\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\",\"ErrorType\":\"NoMatchingError\"}],\"Conditions\":[]},\"Type\":\"InvokeLambdaFunction\"},{\"Identifier\":\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\",\"Parameters\":{\"Text\":\"oops, looks like there was an error, we'll get back to you shortly.\"},\"Transitions\":{\"NextAction\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"}]}", /* required */
					InstanceId: process.env.CONNECT_INSTANCE_ID, /* required */
					Name: 'Vanity-ContactFlow', /* required */
					Type: "CONTACT_FLOW", /* required */
					Description: 'This Contact Flow return the vanity numbers of caller',
				  };
				  await connect.createContactFlow(params).promise()	
			}

		} 
		else if (event.RequestType === 'Delete') {
			await sendResponse(event, context, 'SUCCESS', {});
		}
		console.info(`Success for request type ${event.RequestType}`);
		// console.log( JSON.stringify(event) );

        // await writeObjBucket(process.env.BUCKET,'cr-log.html',JSON.stringify(event));
		await sendResponse(event, context, 'SUCCESS', {});
	} catch (error) {
		console.log(JSON.stringify(event));
		console.error(`Error for request type ${event.RequestType}: `, error);
        // await writeObjBucket(process.env.BUCKET,'cr-log.html',JSON.stringify(error));
		await sendResponse(event, context, 'FAILED', {});
		// response.send(event, context, response.FAILED,{})
	}
};

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


async function sendResponse(event:any, context:any, responseStatus:any, responseData:any, physicalResourceId?:any) {
	var reason =
		responseStatus == 'FAILED' ? 'See the details in CloudWatch Log Stream: ' + context.logStreamName : undefined;

	var responseBody = JSON.stringify({
		StackId: event.StackId,
		RequestId: event.RequestId,
		Status: responseStatus,
		Reason: reason,
		PhysicalResourceId: physicalResourceId || context.logStreamName,
		LogicalResourceId: event.LogicalResourceId,
		Data: responseData
	});

	var responseOptions = {
		headers: {
			'Content-Type': '',
			'Content-Length': responseBody.length
		}
	};

	console.info('Response body:\n', responseBody);

	try {
		await axios.put(event.ResponseURL, responseBody, responseOptions);

		console.info('CloudFormationSendResponse Success');
	} catch (error) {
		console.error('CloudFormationSendResponse Error:');

		if (error.response) {
			console.error(error.response.data);
			console.error(error.response.status);
			console.error(error.response.headers);
		} else if (error.request) {
			console.error(error.request);
		} else {
			console.error('Error', error.message);
		}

		console.error(error.config);

		throw new Error('Could not send CloudFormation response');
	}
}
