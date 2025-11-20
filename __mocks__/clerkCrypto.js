const crypto = global.crypto || {
    subtle: {
        digest: () => Promise.resolve(new Uint8Array(32).buffer)
    },
    getRandomValues: (arr) => arr
};

module.exports = {
    webcrypto: crypto
};