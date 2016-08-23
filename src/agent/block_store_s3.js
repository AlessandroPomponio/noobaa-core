/**
 *
 * BLOCK STORE S3
 *
 * block store which uses s3 cloud storage
 *
 */
'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');
const path = require('path');
const https = require('https');

const P = require('../util/promise');
const dbg = require('../util/debug_module')(__filename);
const BlockStoreBase = require('./block_store_base').BlockStoreBase;

const https_agent = new https.Agent({
    rejectUnauthorized: false,
});

class BlockStoreS3 extends BlockStoreBase {

    constructor(options) {
        super(options);
        this.cloud_info = options.cloud_info;
        this.blocks_path = this.cloud_info.blocks_path || 'noobaa_blocks/' + options.node_name + '/blocks_tree';
        this.usage_path = 'noobaa_blocks/' + options.node_name + '/usage';
        this.usage_md_key = 'noobaa_usage';
        this._usage = {
            size: 0,
            count: 0
        };
        // upload copy to s3 cloud storage.
        if (this.cloud_info.endpoint === 'https://s3.amazonaws.com') {
            this.s3cloud = new AWS.S3({
                endpoint: this.cloud_info.endpoint,
                accessKeyId: this.cloud_info.access_keys.access_key,
                secretAccessKey: this.cloud_info.access_keys.secret_key,
                region: 'us-east-1'
            });
        } else {
            this.s3cloud = new AWS.S3({
                endpoint: this.cloud_info.endpoint,
                s3ForcePathStyle: true,
                accessKeyId: this.cloud_info.access_keys.access_key,
                secretAccessKey: this.cloud_info.access_keys.secret_key,
                httpOptions: {
                    agent: https_agent
                }
            });
        }
    }

    init() {
        let params = {
            Bucket: this.cloud_info.target_bucket,
            Key: this._block_key(this.usage_path)
        };
        return P.ninvoke(this.s3cloud, 'headObject', params)
            .then(head => {
                let usage_data = head.Metadata[this.usage_md_key];
                dbg.log0('DZDZ:', 'found usage data in', this.usage_path);
                if (usage_data) {
                    this._usage = JSON.parse(this._decode_block_md(usage_data));
                    dbg.log0('DZDZ:', 'usage_data = ', this._usage);
                }
            }, err => {});
    }

    get_storage_info() {
        const TERA = 1024 * 1024 * 1024 * 1024 * 1024;
        return P.resolve(this._get_usage())
            .then(usage => ({
                total: TERA + usage.size,
                free: TERA,
                used: usage.size
            }));
    }

    _get_usage() {
        return this._usage || this._count_usage();
    }

    _count_usage() {
        return 0;
    }


    _read_block(block_md) {
        return P.ninvoke(this.s3cloud, 'getObject', {
                Bucket: this.cloud_info.target_bucket,
                Key: this._block_key(block_md.id),
            })
            .then(data => {
                return {
                    data: data.Body,
                    block_md: this._decode_block_md(data.Metadata.noobaa_block_md)
                };
            })
            .catch(err => {
                if (this._try_change_region(err)) {
                    return this._read_block(block_md);
                }
                dbg.error('_read_block failed:', err, this.cloud_info);
                throw err;
            });
    }

    _write_block(block_md, data) {
        let overwrite_size = 0;
        let overwrite_count = 0;
        let encoded_md;
        let params = {
            Bucket: this.cloud_info.target_bucket,
            Key: this._block_key(block_md.id),
        };
        // check to see if the object already exists
        return P.ninvoke(this.s3cloud, 'headObject', params)
            .then(head => {
                overwrite_size = Number(head.ContentLength);
                let md_size = head.Metadata.noobaa_block_md ? head.Metadata.noobaa_block_md.length : 0;
                overwrite_size += md_size;
                console.warn('block already found in cloud, will overwrite. id =', block_md.id);
                overwrite_count = 1;
            }, err => {})
            .then(() => {
                dbg.log0('DZDZ:', 'writing block id to cloud: ', params.Key);
                //  write block + md to cloud
                encoded_md = this._encode_block_md(block_md);
                params.Metadata = {
                    noobaa_block_md: encoded_md
                };
                params.Body = data;
                return this._put_object(params);
            })
            .then(() => {
                // return usage count for the object
                let usage = {
                    size: data.length + encoded_md.length - overwrite_size,
                    count: 1 - overwrite_count
                };
                dbg.log0('DZDZ:', 'updating usage: ', usage);
                return this._update_usage(usage);
            });
    }


    _update_usage(usage) {
        if (this._usage) {
            dbg.log0('DZDZ:', 'updating usage by ', usage, this.usage_path);
            this._usage.size += usage.size;
            this._usage.count += usage.count;
            let usage_data = this._encode_block_md(this._usage);
            let params = {
                Bucket: this.cloud_info.target_bucket,
                Key: this.usage_path,
                Metadata: {}
            };
            params.Metadata[this.usage_md_key] = usage_data;
            return this._put_object(params);

        }
    }


    _put_object(params) {
        return P.ninvoke(this.s3cloud, 'putObject', params)
            .catch(err => {
                if (this._try_change_region(err)) {
                    return this._put_object(params);
                }
                dbg.error('_write_block failed:', err, this.cloud_info);
                throw err;
            });
    }

    _delete_blocks(block_ids) {
        return P.ninvoke(this.s3cloud, 'deleteObjects', {
                Bucket: this.cloud_info.target_bucket,
                Delete: {
                    Objects: _.map(block_ids, block_id => ({
                        Key: this._block_key(block_id)
                    }))
                }
            })
            .catch(err => {
                if (this._try_change_region(err)) {
                    return this._delete_blocks(block_ids);
                }
                dbg.error('_delete_blocks failed:', err, this.cloud_info);
                throw err;
            });
    }


    _block_key(block_id) {
        let block_dir = this._get_block_internal_dir(block_id);
        return path.join(this.blocks_path, block_dir, block_id);
    }

    _encode_block_md(block_md) {
        return new Buffer(JSON.stringify(block_md)).toString('base64');
    }

    _decode_block_md(noobaa_block_md) {
        return JSON.parse(new Buffer(noobaa_block_md, 'base64'));
    }

    _try_change_region(err) {
        // try to change default region from US to EU
        // due to restricted signature of v4 and end point
        if ((err.statusCode === 400 || err.statusCode === 301) &&
            this.s3cloud.config.signatureVersion !== 'v4') {
            dbg.log0('Resetting signature type and region to eu-central-1 and v4');
            this.s3cloud.config.signatureVersion = 'v4';
            this.s3cloud.config.region = 'eu-central-1';
            return true;
        }
        return false;
    }

}

// EXPORTS
exports.BlockStoreS3 = BlockStoreS3;
