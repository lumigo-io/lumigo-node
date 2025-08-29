//Copied from https://github.com/ThomasR/JSON.sortify/blob/master/src/index.js
//Because its not TS compatible
const sortKeys = (o) => {
    if (Array.isArray(o)) {
        return o.map(sortKeys);
    }
    if (o instanceof Object) {
        // put numeric keys first
        let numeric = [];
        let nonNumeric = [];
        Object.keys(o).forEach((key) => {
            if (/^(0|[1-9][0-9]*)$/.test(key)) {
                numeric.push(+key);
            }
            else {
                nonNumeric.push(key);
            }
        });
        // do the rearrangement
        return numeric
            .sort((a, b) => a - b)
            .concat(nonNumeric.sort())
            .reduce((result, key) => {
            result[key] = sortKeys(o[key]); // recurse!
            return result;
        }, {});
    }
    return o;
};
const jsonStringify = JSON.stringify.bind(JSON); // this allows redefinition like JSON.stringify = require('json.sortify')
export const sortify = (value, replacer, space) => {
    // replacer, toJSON(), cyclic references and other stuff is better handled by native stringifier.
    // So we do JSON.stringify(sortKeys( JSON.parse(JSON.stringify()) )).
    // This approach is slightly slower but much safer than a manual stringification.
    let nativeJson = jsonStringify(value, replacer, 0);
    if (!nativeJson || (nativeJson[0] !== '{' && nativeJson[0] !== '[')) {
        // if value is not an Object or Array
        return nativeJson;
    }
    let cleanObj = JSON.parse(nativeJson);
    return jsonStringify(sortKeys(cleanObj), null, space);
};
