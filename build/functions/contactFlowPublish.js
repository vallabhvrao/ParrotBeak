'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
var response = require('cfn-response');
const connect = new AWS.Connect({ apiVersion: '2017-08-08' });
module.exports.handler = async (event, context) => {
    try {
        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            var params = {
                Content: "{\"Version\":\"2019-10-30\",\"StartAction\":\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\",\"Metadata\":{\"entryPointPosition\":{\"x\":20,\"y\":20},\"snapToGrid\":false,\"ActionMetadata\":{\"15ccc138-c6ac-4967-a926-591505f99967\":{\"position\":{\"x\":615,\"y\":148},\"useDynamic\":true},\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\":{\"position\":{\"x\":134,\"y\":180},\"useDynamic\":false},\"85fae6ff-1e37-40ff-b178-312820a736d4\":{\"position\":{\"x\":149,\"y\":360}},\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\":{\"position\":{\"x\":389,\"y\":146},\"dynamicMetadata\":{\"connect\":false},\"useDynamic\":false},\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\":{\"position\":{\"x\":625,\"y\":322},\"useDynamic\":false}}},\"Actions\":[{\"Identifier\":\"15ccc138-c6ac-4967-a926-591505f99967\",\"Parameters\":{\"Text\":\"$.External.tts\"},\"Transitions\":{\"NextAction\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"},{\"Identifier\":\"b0f84693-8c33-44ec-9d42-b4ce5c87a3e6\",\"Parameters\":{\"Text\":\"Thanks for calling. Please wait while we lookup vanity numbers for the dialed phone number.\"},\"Transitions\":{\"NextAction\":\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"},{\"Identifier\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Type\":\"DisconnectParticipant\",\"Parameters\":{},\"Transitions\":{}},{\"Identifier\":\"3751b6f6-c3c8-4f9b-ac99-ecbce6f375a0\",\"Parameters\":{\"LambdaFunctionARN\":\"arn:aws:lambda:eu-west-2:012700660634:function:parrot-beak-dev-VanityLookup\",\"InvocationTimeLimitSeconds\":\"8\",\"LambdaInvocationAttributes\":{\"connect\":\"true\"}},\"Transitions\":{\"NextAction\":\"15ccc138-c6ac-4967-a926-591505f99967\",\"Errors\":[{\"NextAction\":\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\",\"ErrorType\":\"NoMatchingError\"}],\"Conditions\":[]},\"Type\":\"InvokeLambdaFunction\"},{\"Identifier\":\"c626e86c-78e7-4ce3-84ac-9ec27de21d10\",\"Parameters\":{\"Text\":\"oops, looks like there was an error, we'll get back to you shortly.\"},\"Transitions\":{\"NextAction\":\"85fae6ff-1e37-40ff-b178-312820a736d4\",\"Errors\":[],\"Conditions\":[]},\"Type\":\"MessageParticipant\"}]}",
                InstanceId: 'bef6f726-7fce-457f-9083-d8786ac92154',
                Name: 'Vanity-ContactFlow',
                Type: "CONTACT_FLOW",
                Description: 'This Contact Flow return the vanity numbers of caller',
            };
            await connect.createContactFlow(params).promise();
        }
        else if (event.RequestType === 'Delete') {
        }
        console.info(`Success for request type ${event.RequestType}`);
        response.send(event, context, response.SUCCESS, {});
    }
    catch (error) {
        console.log(JSON.stringify(event));
        console.error(`Error for request type ${event.RequestType}: `, error);
        response.send(event, context, response.FAILED, {});
    }
};
//# sourceMappingURL=contactFlowPublish.js.map