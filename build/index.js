"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const lodash_1 = require("lodash");
const words = JSON.parse(fs_1.readFileSync('./data/words_dictionary.json', 'utf8'));
const phoneNumber = "3569377";
const vanityDict = {
    "2": ["a", "b", "c", " "],
    "3": ["d", "e", "f", " "],
    "4": ["g", "h", "i", " "],
    "5": ["j", "k", "l", " "],
    "6": ["m", "n", "o", " "],
    "7": ["p", "q", "r", "s", " "],
    "8": ["t", "u", "v", " "],
    "9": ["w", "x", "y", "z", " "]
};
let vanityLanguage = [];
let vanitySet = [];
for (let i = 0; i < phoneNumber.length; i++) {
    if (phoneNumber[i] === "0" || phoneNumber[i] === "1")
        continue;
    vanityLanguage.push(vanityDict[phoneNumber.charAt(i)]);
}
let indexies = [];
for (let i = 0; i < vanityLanguage.length; i++) {
    indexies.push(vanityLanguage[i].length - 1);
}
const originalIndexies = [...indexies];
let j = indexies.length - 1;
vanitySet.push(getWordFromIndexies([...indexies], vanityLanguage));
while (true) {
    indexies[j] = indexies[j] - 1;
    vanitySet.push(getWordFromIndexies([...indexies], vanityLanguage));
    if (sumofIndexies([...indexies]) === 0)
        break;
    if (indexies[j] === 0) {
        let k = j;
        while (true) {
            k--;
            if (indexies[k] > 0) {
                indexies[k] = indexies[k] - 1;
                break;
            }
        }
        k++;
        while (k < originalIndexies.length) {
            indexies[k] = originalIndexies[k];
            k++;
        }
        vanitySet.push(getWordFromIndexies([...indexies], vanityLanguage));
    }
}
const vanity = lodash_1.intersection(vanitySet, Object.keys(words));
console.log(vanitySet, vanity);
let data = JSON.stringify(vanity.sort((a, b) => a.length - b.length));
fs_1.writeFileSync('./data/vanity.json', data);
function getWordFromIndexies(indexies, language) {
    let word = '';
    for (let i = 0; i < indexies.length; i++) {
        word = word.concat(language[i][indexies[i]]);
    }
    return word.trim();
}
function sumofIndexies(indexies) {
    let sum = 0;
    indexies.forEach(n => sum += n);
    return sum;
}
//# sourceMappingURL=index.js.map