export const runOneTimeWrapper = (func, context = undefined) => {
    let done = false;
    return (...args) => {
        if (!done) {
            const result = func.apply(context || this, args);
            done = true;
            return result;
        }
    };
};
