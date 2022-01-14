import { readFileSync, writeFileSync } from 'fs';
import { intersection } from 'lodash';

// this code generates all possible phrases for a given phone number.
// this idea was discarded as a different and faster approach was used.
// this file is probably broken and is not useable without alterations.
// this exists for documentation purpose only.

const words = JSON.parse(readFileSync('./data/words_dictionary.json', 'utf8'));

const phoneNumber:string = "3569377"

const vanityDict:Record<string, Partial<string[]>> = {
    "2":["a","b","c"," "],
    "3":["d","e","f"," "],
    "4":["g","h","i"," "],

    "5":["j","k","l"," "],
    "6":["m","n","o"," "],
    "7":["p","q","r","s"," "],
    "8":["t","u","v"," "],
    "9":["w","x","y","z"," "]
}

let vanityLanguage:Array<string[]> = []
let vanitySet = []
for (let i = 0; i < phoneNumber.length; i++) {
    if(phoneNumber[i] === "0" || phoneNumber[i] === "1") continue;
    vanityLanguage.push(vanityDict[phoneNumber.charAt(i)])
}


let indexies = []
for(let i=0; i<vanityLanguage.length; i++) { // word length
    indexies.push(vanityLanguage[i].length-1);
}

// indexies = [1,1,5];
const originalIndexies = [...indexies];
let j = indexies.length-1;

vanitySet.push(getWordFromIndexies([...indexies],vanityLanguage));
while (true) {
    indexies[j] = indexies[j] - 1;
    vanitySet.push(getWordFromIndexies([...indexies],vanityLanguage));
    if(sumofIndexies([...indexies])===0) break;

    if(indexies[j]===0){
        // console.log("reached zero")
        let k = j;
        // console.log("now i am looking left to find a value to decrement")
        while(true) {
            k--;
            if(indexies[k]>0){
                // console.log("k=",k)
                // console.log("value found. now decrementing the value")
                indexies[k] = indexies[k] - 1;
                break;
            }
        }
        // console.log("now restoring all the values on the right",k)
        k++;
        while(k < originalIndexies.length){
            indexies[k] = originalIndexies[k];
            k++;
        }
        // console.log("restoring done. and capturing")
        vanitySet.push(getWordFromIndexies([...indexies],vanityLanguage));
    }
}

const vanity = intersection(vanitySet,Object.keys(words));

console.log(vanitySet,vanity);

let data = JSON.stringify(vanity.sort((a,b) => a.length - b.length));
writeFileSync('./data/vanity.json', data);

function getWordFromIndexies(indexies:Array<number>,language:Array<string[]>):string {
    let word = '';
    for (let i = 0; i < indexies.length; i++) {
        word = word.concat(language[i][indexies[i]]);
    }

    return word.trim();
}

function sumofIndexies(indexies:Array<number>):number{
    let sum = 0;
    indexies.forEach(n => sum += n);
    return sum;
}