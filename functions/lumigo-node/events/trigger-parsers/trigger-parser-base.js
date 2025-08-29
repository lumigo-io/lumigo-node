export class EventTriggerParser {
    constructor() {
        // Note: This file is a copy of the file in the node-core package.
        // It is copied here because of ts compilation issues: https://stackoverflow.com/questions/51860043/javascript-es6-typeerror-class-constructor-client-cannot-be-invoked-without-ne
        this.INNER_IDENTIFIER = null;
        this.shouldHandle = (message) => {
            try {
                return this._shouldHandle(message);
            }
            catch (e) {
                return false;
            }
        };
        this.extractInner = (message) => {
            return [];
        };
    }
}
