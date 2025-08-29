/*
  XML TO JSON
  Taken from: https://github.com/alabianca/xml-to-json with tests
  Be aware, this code is not 100% covered by tests
*/
const clean = function cleanXML(xml) {
    return xml
        .replace(/>\s*</g, '><') //remove white spaces between elements
        .replace(/<\?xml.*\?>/g, '') //remove the root element
        .replace(/<!--.*-->/g, '') //remove comments
        .replace(/>\s*/g, '>') // remove any white spaces at the end of the xml string if any
        .replace(/\s*</g, '<'); // remove any white spaces that are left at the beginning of the xml string
};
export const traverse = (xml, attributeMode) => {
    xml = clean(xml);
    const tagFinder = new RegExp('<(.*?)[>|\\s|/]', 'g'); //find the current tag we are working on
    const json = {};
    let tagShouldBeArray = false;
    //recursion base case
    if (xml === '' || (xml.charAt(0) !== '<' && xml.charAt(xml.length - 1) !== '>')) {
        return xml;
    }
    var currentLevelTags;
    var skip = 0;
    while ((currentLevelTags = tagFinder.exec(xml)) !== null) {
        let selfClosing = false;
        const tag = currentLevelTags[1];
        const finishTag = '</' + tag + '>';
        const input = currentLevelTags.input;
        const tagLength = input.indexOf('>', skip) + 1;
        const start = currentLevelTags.index;
        const end = currentLevelTags.input.indexOf('>', start) + 1;
        const currentTag = currentLevelTags.input.substring(start, end);
        selfClosing = isSelfClosing(currentTag);
        if (!validate(currentTag)) {
            const err = new Error('Invalid XML tag');
            throw err;
        }
        //const closingTagIndex = input.indexOf(finishTag,tagLength);
        const closingTagIndex = findClosingIndex(input, finishTag, tagLength);
        if (selfClosing === false && closingTagIndex < 0) {
            return {};
        }
        let substring; //substring will be either all child tags or if self closing tag just a blank string. i.e: <employee><name>Alex</name></employee> : <name>Alex</name> will be the substring of the <employee> parent tag
        if (selfClosing) {
            substring = '';
            skip = currentTag.length + skip;
        }
        else {
            substring = input.substring(input.indexOf('>', skip) + 1, closingTagIndex);
            skip = tagLength + substring.length + finishTag.length;
        }
        tagFinder.lastIndex = skip; //skip all child tags of current level
        if (!json[tag]) {
            json[tag] = {};
        }
        else {
            tagShouldBeArray = true;
        }
        let temporary = {};
        let attributes;
        if (attributeMode) {
            attributes = collectAttributes(currentTag);
        }
        //if currentTag contains attributes and attributeMode is enabled, attach them to json
        if (tagShouldBeArray && attributeMode) {
            temporary = attributes;
        }
        else if (!tagShouldBeArray && attributeMode) {
            for (let key in attributes) {
                json[tag][key] = attributes[key];
            }
        }
        //go one level deeper
        const next = traverse(substring, attributeMode);
        //when returning from recursion, build up the json
        if (typeof next === 'object') {
            //const key = Object.keys(next)[0];
            if (tagShouldBeArray && !json[tag].length) {
                const temp = json[tag];
                json[tag] = [temp];
                const nextObj = {};
                for (let key in next) {
                    nextObj[key] = next[key];
                }
                temporary = Object.assign(Object.assign({}, temporary), nextObj);
                json[tag].push(temporary);
            }
            else if (tagShouldBeArray) {
                const nextObj = {};
                for (let key in next) {
                    nextObj[key] = next[key];
                }
                temporary = Object.assign(Object.assign({}, temporary), nextObj);
                json[tag].push(temporary);
            }
            else {
                for (let key in next) {
                    json[tag][key] = next[key];
                }
            }
        }
        else if (Object.keys(json[tag]).length > 0) {
            if ((tagShouldBeArray && !json[tag].length) || typeof json[tag] === 'string') {
                const temp = json[tag];
                json[tag] = [temp];
                if (typeof next !== 'object') {
                    if (Object.keys(temporary).length === 0) {
                        json[tag].push(next);
                    }
                    else {
                        // temporary['data'] = next;
                        if (next !== '') {
                            temporary['textNode'] = next;
                        }
                        json[tag].push(temporary);
                    }
                }
                else {
                    temporary = Object.assign(Object.assign({}, temporary), { next });
                    json[tag].push(next);
                }
                //json[tag].push(next);
            }
            else if (tagShouldBeArray) {
                //json[tag].push(next);
                if (typeof next !== 'object') {
                    if (Object.keys(temporary).length === 0) {
                        json[tag].push(next);
                    }
                    else {
                        //temporary['data'] = next;
                        if (next !== '') {
                            temporary['textNode'] = next;
                        }
                        json[tag].push(temporary);
                    }
                }
                else {
                    temporary = Object.assign(Object.assign({}, temporary), { next });
                    json[tag].push(next);
                }
            }
            else {
                if (next !== '') {
                    json[tag] = Object.assign(Object.assign({}, json[tag]), { textNode: next });
                }
            }
        }
        else {
            if (tagShouldBeArray && typeof json[tag] !== 'object') {
                const temp = json[tag];
                json[tag] = [];
                json[tag].push(...temp, next);
            }
            else {
                json[tag] = next;
            }
            //json[tag] = next;
        }
    }
    return json;
};
//Helper methods
//Determine if a tag is self closing or not. Could be improved
function isSelfClosing(currentTag) {
    if (currentTag.indexOf('/>') > -1) {
        return true;
    }
    return false;
}
//Collect all the attributes of the current tag and return an object in form of {attribute:values}
function collectAttributes(currentTag) {
    const attributeFinder = new RegExp('(\\S*)="(.*?)"', 'g');
    const foundAttributes = {};
    let attributes;
    while ((attributes = attributeFinder.exec(currentTag)) !== null) {
        const key = attributes[1];
        const value = attributes[2];
        foundAttributes[key] = value;
    }
    return foundAttributes;
}
function validate(currentTag) {
    if (currentTag.charAt(0) === '<' &&
        currentTag.charAt(1) === '?' &&
        currentTag.charAt(currentTag.length - 1) === '>' &&
        currentTag.charAt(currentTag.length - 2) === '?') {
        return true;
    }
    if (currentTag.charAt(0) === '<' &&
        (currentTag.charAt(currentTag.length - 2) + currentTag.charAt(currentTag.length - 1) === '/>' ||
            currentTag.charAt(currentTag.length - 1) === '>')) {
        return true;
    }
    return false;
}
function findClosingIndex(searchString, tag, start) {
    const openinTag = tag.replace('</', '<').replace('>', '');
    let closingIndex = searchString.indexOf(tag, start);
    let openingIndex = searchString.indexOf(openinTag, start);
    if (closingIndex < openingIndex) {
        return closingIndex;
    }
    const sub = searchString.substr(openingIndex, closingIndex - openingIndex);
    if (!sub.match(new RegExp(openinTag + '\\W'))) {
        return closingIndex;
    }
    while (closingIndex > 0) {
        const tempIndex = searchString.indexOf(tag, closingIndex + 1);
        if (tempIndex > 0) {
            closingIndex = tempIndex;
        }
        else {
            break;
        }
    }
    return closingIndex;
}
