// module targets: nodejs & browserify
'use strict';

var _ = require('lodash');
var make_object = require('./js_utils').make_object;
var mongo_functions = require('./mongo_functions');

/**
 * functions to handle storage sizes that might not fit into single integer
 * supports either a single number;
 *      which might have a floating point fraction and therefore not completely accurate,
 * or an object for big sizes with structure -
 *  { n: bytes, peta: petabytes }
 */

var KILOBYTE = 1024;
var MEGABYTE = 1024 * KILOBYTE;
var GIGABYTE = 1024 * MEGABYTE;
var TERABYTE = 1024 * GIGABYTE;
var PETABYTE = 1024 * TERABYTE;
var EXABYTE = {
    peta: 1024
};
var ZETABYTE = {
    peta: 1024 * EXABYTE.peta
};
var YOTABYTE = {
    peta: 1024 * ZETABYTE.peta
};

// cant do 1<<32 because javascript bitwise is limited to 32 bits
var MAX_UINT32 = (1 << 16) * (1 << 16);

var SIZE_UNITS = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

const SOTRAGE_OBJ_KEYS = ['used', 'total', 'used_other', 'limit', 'reserved', 'used_reduced', 'unavailable_free', 'free', 'alloc', 'real'];

module.exports = {
    to_bigint: to_bigint,
    to_bigint_storage: to_bigint_storage,
    reduce_storage: reduce_storage,
    reduce_minimum: reduce_minimum,
    reduce_sum: mongo_functions.reduce_sum,
    human_size: human_size,
    human_offset: human_offset,
    KILOBYTE: KILOBYTE,
    MEGABYTE: MEGABYTE,
    GIGABYTE: GIGABYTE,
    TERABYTE: TERABYTE,
    PETABYTE: PETABYTE,
    EXABYTE: EXABYTE,
    ZETABYTE: ZETABYTE,
    YOTABYTE: YOTABYTE,
    MAX_UINT32: MAX_UINT32,
};

function to_bigint(x) {
    var n;
    var peta;
    if (typeof(x) === 'object' && x) {
        n = Math.floor(x.n);
        peta = Math.floor(x.peta);
    } else {
        n = Math.floor(Number(x)) || 0;
    }
    while (n >= PETABYTE) {
        n -= PETABYTE;
        peta += 1;
    }
    return !peta ? n : {
        n: n,
        peta: peta,
    };
}

function to_bigint_storage(storage) {
    return _.mapValues(storage, to_bigint);
}

/**
 * mult_factor & div_factor must be positive integers.
 */
function bigint_factor(bigint, mult_factor, div_factor) {
    var n = 0;
    var peta = 0;
    if (typeof(bigint) === 'object' && bigint) {
        n = Math.floor(bigint.n);
        peta = Math.floor(bigint.peta);
    } else {
        n = Math.floor(Number(bigint)) || 0;
    }
    peta *= mult_factor;
    var peta_mod = peta % div_factor;
    peta = (peta - peta_mod) / div_factor;
    n = Math.floor((peta_mod * PETABYTE + n * mult_factor) / div_factor);
    while (n >= PETABYTE) {
        n -= PETABYTE;
        peta += 1;
    }
    return !peta ? n : {
        n: n,
        peta: peta,
    };
}

function reduce_storage(reducer, storage_items, mult_factor, div_factor) {
    let accumulator = _.reduce(
        storage_items, (accumulator, item) => {
            _.each(SOTRAGE_OBJ_KEYS, key => item && item[key] && accumulator[key].push(item[key]));
            return accumulator;
        },
        make_object(SOTRAGE_OBJ_KEYS, key => [])
    );

    return _.reduce(
        accumulator, (storage, val, key) => {
            if (!_.isEmpty(val)) {
                storage[key] = bigint_factor(reducer(key, val), mult_factor, div_factor);
            }

            return storage;
        }, {}
    );
}


// a map-reduce part for finding the minimum value
// this function must be self contained to be able to send to mongo mapReduce()
// so not using any functions or constants from above.
function reduce_minimum(key, values) {
    var PETABYTE = 1024 * 1024 * 1024 * 1024 * 1024;
    var n_min = PETABYTE;
    var peta_min = 100000;
    values.forEach(function(v) {
        var n = 0;
        var peta = 0;
        if (typeof(v) === 'number') {
            n = v;
        } else if (v) {
            n = v.n;
            peta = v.peta;
        }
        while (n >= PETABYTE) {
            n -= PETABYTE;
            peta += 1;
        }

        if (peta < peta_min || (peta === peta_min && n < n_min)) {
            n_min = n;
            peta_min = peta;
        }
    });
    return !peta_min ? n_min : {
        n: n_min,
        peta: peta_min,
    };
}


/**
 * return a formatted string for the given size such as 12 KB or 130.5 GB.
 * supports either numbers or an object for big sizes with structure -
 *  { n: bytes, peta: petabytes }
 */
function human_size(bytes) {
    var x;
    var i = 0;
    if (typeof(bytes) === 'object') {
        if (bytes.peta) {
            x = bytes.peta + (bytes.n / PETABYTE);
            i = 5;
        } else {
            x = bytes.n;
        }
    } else {
        x = Number(bytes);
    }
    if (isNaN(x)) {
        return '';
    }
    while (x >= 1024 && i + 1 < SIZE_UNITS.length) {
        i += 1;
        x /= 1024;
    }
    if (i === 0) {
        return x.toString() + ' B';
    } else if (x < 99) {
        // precision formatting applied for 2 digits numbers for fraction rounding up/down.
        // NOTE: for some reason Number(99.5).toPrecision(2) returns '1.0e+2'
        // which we don't want, so we only use precision formating below 99
        return x.toPrecision(2) + ' ' + SIZE_UNITS[i] + 'B';
    } else {
        // fixed formatting truncates the fraction part which is negligible for 3 digit numbers
        return x.toFixed(0) + ' ' + SIZE_UNITS[i] + 'B';
    }
}


/**
 *
 * human_offset
 *
 * @param offset - must be integer
 *
 */
function human_offset(offset) {
    var res = '';
    var sign = '';
    var i;
    var n;
    var peta;
    var mod;

    if (typeof(offset) === 'object') {
        peta = offset.peta;
        n = offset.n;
        sign = '';
    } else {
        peta = 0;
        n = offset;
    }

    if (n < 0) {
        n = -n;
        sign = '-';
    }

    // always include the lowest offset unit
    i = 0;
    do {
        mod = n % 1024;
        if (res) {
            res = mod + SIZE_UNITS[i] + '.' + res;
        } else if (mod) {
            res = mod + SIZE_UNITS[i];
        }
        n = Math.floor(n / 1024);
        i++;
    } while (n);

    i = 5;
    while (peta) {
        mod = peta % 1024;
        res = mod + SIZE_UNITS[i] + '.' + res;
        peta = Math.floor(peta / 1024);
        i++;
    }

    return sign + res || '0';
}
