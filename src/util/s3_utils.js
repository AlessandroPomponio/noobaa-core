/* Copyright (C) 2016 NooBaa */
'use strict';

var _ = require('lodash');
// var P = require('../util/promise');
var dbg = require('../util/debug_module')(__filename);
var s3_util = require('aws-sdk/lib/util');
var moment = require('moment');

// The original s3 code doesn't work well with express and query string.
// It expects to see query string as part of the request.path.
// This is a copy of aws javascript sdk code, with minor modifications.

module.exports = {
    noobaa_string_to_sign: noobaa_string_to_sign,
    canonicalizedResource: canonicalizedResource,
    canonicalizedAmzHeaders: canonicalizedAmzHeaders,
    noobaa_string_to_sign_v4: noobaa_string_to_sign_v4,
    noobaa_signature_v4: noobaa_signature_v4,
    authenticate_request: authenticate_request,
};



var subResources = {
    acl: 1,
    cors: 1,
    lifecycle: 1,
    delete: 1,
    location: 1,
    logging: 1,
    notification: 1,
    partNumber: 1,
    policy: 1,
    requestPayment: 1,
    restore: 1,
    tagging: 1,
    torrent: 1,
    uploadId: 1,
    uploads: 1,
    versionId: 1,
    versioning: 1,
    versions: 1,
    website: 1
};

function canonicalizedResource(request) {
    //handle path - modification on top of aws code.
    var r = request;
    var parts = r.url.split('?');
    var path = r.path;
    var querystring = parts[1];
    // console.log('path:',path, 'parts',parts);
    //Quick patch - add prefix for REST routing on top of MD server
    //TODO: Replace with s3 rest param, initiated from the constructor

    // path = '/s3'+path;
    // parts[0] = '/s3' +parts[0];
    var resource = '';

    if (r.virtualHostedBucket) {
        resource += '/' + r.virtualHostedBucket;
    }

    resource += path;
    if (querystring) {

        // collect a list of sub resources and query params that need to be signed
        var resources = [];

        s3_util.arrayEach(querystring.split('&'), function(param) {
            var name = param.split('=')[0];
            var value = param.split('=')[1];
            if (subResources[name]) {
                var subresource = {
                    name: name
                };
                //another modification on top of aws code.
                //fixed to isEmpty, instead of undefined comparison
                if (!_.isEmpty(value)) {
                    if (subResources[name]) {
                        subresource.value = value;
                    } else {
                        subresource.value = decodeURIComponent(value);
                    }
                }
                resources.push(subresource);
            }
        });

        resources.sort(function(a, b) {
            return a.name < b.name ? -1 : 1;
        });

        if (resources.length) {
            querystring = [];
            s3_util.arrayEach(resources, function(res) {
                if (res.value === undefined) {
                    querystring.push(res.name);
                } else {
                    querystring.push(res.name + '=' + res.value);
                }
            });

            resource += '?' + querystring.join('&');
        }

    }
    return resource;
}

function canonicalizedAmzHeaders(request) {
    var amzHeaders = [];

    s3_util.each(request.headers, function(name) {
        if (name.match(/^x-amz-/i)) {
            amzHeaders.push(name);
        }
    });

    amzHeaders.sort(function(a, b) {
        return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
    });

    var parts = [];
    s3_util.arrayEach(amzHeaders, function(name) {
        parts.push(name.toLowerCase() + ':' + String(request.headers[name]));
    });

    return parts.join('\n');
}

function noobaa_string_to_sign(request) {
    var r = request;
    var parts = [];
    parts.push(r.method);
    //changed to lower case (on top of aws code)
    parts.push(r.headers['content-md5'] || '');
    parts.push(r.headers['content-type'] || '');

    // This is the "Date" header, but we use X-Amz-Date.
    // The S3 signing mechanism requires us to pass an empty
    // string for this Date header regardless.

    //another noobaa addition - take into account signed urls
    if (r.headers['presigned-expires'] || r.query.Expires) {
        checkExpired(Number(r.headers['presigned-expires'] || r.query.Expires));
        parts.push(r.headers['presigned-expires'] || r.query.Expires);
    } else if (r.headers.date) {
        parts.push(r.headers.date);
    } else {
        parts.push('');
    }


    var headers = canonicalizedAmzHeaders(request);
    if (headers) parts.push(headers);
    parts.push(canonicalizedResource(request));

    parts = parts.join('\n');

    return parts;

}

// TODO: S3 V4 Auth Methods

var expiresHeader = 'X-Amz-Expires';

function noobaa_signature_v4(params) {

    var date = params.xamzdate.substr(0, 8);
    var kSecret = params.secret_key;
    var kDate = s3_util.crypto.hmac('AWS4' + kSecret, date, 'buffer');
    var kRegion = s3_util.crypto.hmac(kDate, params.region, 'buffer');
    var kService = s3_util.crypto.hmac(kRegion, params.service, 'buffer');
    var kCredentials = s3_util.crypto.hmac(kService, 'aws4_request', 'buffer');
    return s3_util.crypto.hmac(kCredentials, params.string_to_sign, 'hex');
}

function noobaa_string_to_sign_v4(req) {
    var parts = [];

    var canonicalStringstr = canonicalString(req);
    //console.warn('CANONICAL CHECK: ', canonicalStringstr);
    parts.push('AWS4-HMAC-SHA256');
    parts.push(req.noobaa_v4.xamzdate);
    parts.push(credentialString(req));
    parts.push(hexEncodedHash(canonicalStringstr));
    //console.warn('ALGO noobaa_string_to_sign_v4:', parts);
    return parts.join('\n');
}

function canonicalString(req) {
    let parts = [];
    let pathname = req.path;
    let querystr = queryParse(req);
    //console.warn('THE QUERRY STRING: ', querystr);

    if (req.noobaa_v4.service !== 's3') pathname = s3_util.uriEscapePath(pathname);

    parts.push(req.method);
    parts.push(pathname);
    parts.push(querystr);
    parts.push(canonicalHeaders(req) + '\n');
    parts.push(signedHeaders(req));
    parts.push(hexEncodedBodyHash(req));
    return parts.join('\n');
}

function canonicalHeaders(req) {
    var headers = [];

    s3_util.each(req.headers, function(key, item) {
        headers.push([key, item]);
    });
    headers.sort(function(a, b) {
        return a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1;
    });

    var parts = [];
    s3_util.arrayEach(headers, function(item) {
        var key = item[0].toLowerCase();
        if (isSignableHeader(req, key)) {
            parts.push(key + ':' +
                canonicalHeaderValues(item[1].toString()));
        }
    });
    return parts.join('\n');
}

function canonicalHeaderValues(values) {
    return values.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function signedHeaders(req) {
    var keys = [];
    s3_util.each(req.headers, function(key) {
        key = key.toLowerCase();
        if (isSignableHeader(req, key)) keys.push(key);
    });
    return keys.sort().join(';');
}

function credentialString(req) {
    var parts = [];
    parts.push(req.noobaa_v4.xamzdate.substr(0, 8));
    parts.push(req.noobaa_v4.region);
    parts.push(req.noobaa_v4.service);
    parts.push('aws4_request');
    return parts.join('/');
}

function hexEncodedHash(string) {
    return s3_util.crypto.sha256(string, 'hex');
}

function hexEncodedBodyHash(req) {
    if (isPresigned(req) && req.noobaa_v4.service === 's3') {
        return 'UNSIGNED-PAYLOAD';
    } else if (req.headers['x-amz-content-sha256']) {
        return req.headers['x-amz-content-sha256'];
    } else {
        return hexEncodedHash(req.body || '');
    }
}

function isSignableHeader(req, key) {
    // If Signed Headers param doesn't exist we sign everything in order to support
    // chunked upload: http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-streaming.html
    return !req.noobaa_v4.signedheaders ||
        req.noobaa_v4.signedheaders.has(key.toLowerCase());
}

function isPresigned(req) {
    if (req.query[expiresHeader] || req.headers[expiresHeader]) {
        checkExpired(req.noobaa_v4.xamzdate, Number(req.query[expiresHeader] || req.headers[expiresHeader]));
        return true;
    } else {
        return false;
    }
}

function queryParse(req) {
    var parts = req.url.split('?');
    var querystring = parts[1];
    var resource = '';

    if (querystring) {
        var resources = [];

        s3_util.arrayEach(querystring.split('&'), function(param) {
            var name = param.split('=')[0];
            var value = param.split('=')[1];
            //if (subResources[name]) {
            if (name.indexOf('X-Amz-Signature') < 0) {
                var subresource = {
                    name: name
                };
                //another modification on top of aws code.
                //fixed to isEmpty, instead of undefined comparison
                if (!_.isEmpty(value)) {
                    //if (subResources[name]) {
                    subresource.value = value;
                    //} else {
                    //    subresource.value = decodeURIComponent(value);
                    //}
                }
                resources.push(subresource);
                //}
            }
        });

        resources.sort(function(a, b) {
            return a.name < b.name ? -1 : 1;
        });

        if (resources.length) {
            querystring = [];
            s3_util.arrayEach(resources, function(res) {
                if (res.value === undefined) {
                    querystring.push(res.name + '=');
                } else {
                    querystring.push(res.name + '=' + res.value);
                }
            });

            resource += querystring.join('&');
        }

    }
    return resource;
}

function checkExpired(date, expiry_seconds) {
    var req_date;
    if (expiry_seconds) {
        req_date = moment(date).add(expiry_seconds, 'seconds');
    } else {
        req_date = moment.unix(date);
    }

    if (moment().diff(req_date) > 0) {
        throw new Error('Signature Expired');
    }
}

// Using noobaa's extraction function,
// due to compatibility problem in aws library with express.
function authenticate_request(req) {
    const auth_header = req.headers.authorization;
    if (auth_header) {
        // See: http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-auth-using-authorization-header.html
        // Example:
        //      Authorization: AWS4-HMAC-SHA256
        //          Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,
        //          SignedHeaders=host;range;x-amz-date,
        //          Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024
        // Notes:
        // - Cyberduck does not include spaces after the commas
        const v4 = auth_header.match(/^AWS4-HMAC-SHA256 Credential=(\S+), ?SignedHeaders=(\S+), ?Signature=(\S+)$/);
        if (v4) {
            const credentials = v4[1].split('/', 5);
            req.access_key = credentials[0];
            req.signature = v4[3];
            req.noobaa_v4 = {
                xamzdate: req.headers['x-amz-date'],
                signedheaders: v4[2] ? new Set(v4[2].split(';')) : null,
                region: credentials[2],
                service: credentials[3],
            };
            req.string_to_sign = noobaa_string_to_sign_v4(req);
        } else {
            const v2 = auth_header.match(/^AWS (\w+):(\S+)$/);
            if (!v2) {
                throw new Error('Unauthorized request!');
            }
            req.access_key = v2[1];
            req.signature = v2[2];
            req.string_to_sign = noobaa_string_to_sign(req);
        }
    } else if (req.query.AWSAccessKeyId && req.query.Signature) {
        req.access_key = req.query.AWSAccessKeyId;
        req.signature = req.query.Signature;
        req.string_to_sign = noobaa_string_to_sign(req);
    } else if (req.query['X-Amz-Credential']) {
        // See: http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
        // Example:
        //      https://s3.amazonaws.com/examplebucket/test.txt
        //          ?X-Amz-Algorithm=AWS4-HMAC-SHA256
        //          &X-Amz-Credential=<your-access-key-id>/20130721/us-east-1/s3/aws4_request
        //          &X-Amz-Date=20130721T201207Z
        //          &X-Amz-Expires=86400
        //          &X-Amz-SignedHeaders=host
        //          &X-Amz-Signature=<signature-value>
        const credentials = req.query['X-Amz-Credential'].split('/', 5);
        req.access_key = credentials[0];
        req.signature = req.query['X-Amz-Signature'];
        req.noobaa_v4 = {
            xamzdate: req.query['X-Amz-Date'],
            signedheaders: req.query['X-Amz-SignedHeaders'] ?
                new Set(req.query['X-Amz-SignedHeaders'].split(';')) : null,
            region: credentials[2],
            service: credentials[3],
        };
        req.string_to_sign = noobaa_string_to_sign_v4(req);
    } else {
        throw new Error('Unauthorized request!');
    }
    dbg.log0('authenticated request',
        'access_key', req.access_key,
        'signature', req.signature,
        req.noobaa_v4 ? 'v4' : 'v2', req.noobaa_v4 || '',
        'string_to_sign', req.string_to_sign);
}
