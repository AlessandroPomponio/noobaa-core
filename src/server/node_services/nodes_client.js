'use strict';

const _ = require('lodash');
const P = require('../../util/promise');
const dbg = require('../../util/debug_module')(__filename);
const server_rpc = require('../server_rpc');
const node_server = require('./node_server');
const auth_server = require('../common_services/auth_server');
const mongo_utils = require('../../util/mongo_utils');
const node_allocator = require('./node_allocator');

const NODE_FIELDS_FOR_MAP = [
    'name',
    'pool',
    'ip',
    'host_id',
    'heartbeat',
    'rpc_address',
    'is_cloud_node',
    'online',
    'readable',
    'writable',
    'storage_full',
    'latency_of_disk_read',
    // ... more?
];

class NodesClient {

    // LOCAL CALLS

    list_nodes_by_system(system_id) {
        return P.resolve(node_server.get_local_monitor().list_nodes({
                system: system_id
            }))
            .tap(res => mongo_utils.fix_id_type(res.nodes));
    }

    list_nodes_by_pool(pool_id) {
        return P.resolve(node_server.get_local_monitor().list_nodes({
                pools: new Set([pool_id])
            }))
            .tap(res => mongo_utils.fix_id_type(res.nodes));
    }

    aggregate_nodes_by_pool(pool_ids, system_id, skip_cloud_nodes) {
        const res = node_server.get_local_monitor().aggregate_nodes({
            system: system_id && String(system_id),
            pools: pool_ids && new Set(_.map(pool_ids, String)),
            skip_cloud_nodes: skip_cloud_nodes
        }, 'pool');
        // recreating a structure existing code callers expect,
        // might want to change the callers instead.
        const nodes_aggregate_pool = _.mapValues(res.groups,
            group => _.assign({}, group.storage, group.nodes));
        nodes_aggregate_pool[''] = _.assign({}, res.storage, res.nodes);
        return nodes_aggregate_pool;
    }

    migrate_nodes_to_pool(node_identities, pool_id) {
        return node_server.get_local_monitor().migrate_nodes_to_pool(node_identities, pool_id);
    }

    collect_agent_diagnostics(node_identity) {
        return node_server.get_local_monitor().collect_agent_diagnostics(node_identity);
    }

    // REMOTE CALLS

    read_node_by_name(system_id, node_name) {
        if (!system_id) {
            dbg.error('read_node_by_name: expected system_id. node_name', node_name);
            throw new Error('read_node_by_name: expected system_id');
        }
        return server_rpc.client.node.read_node({
                name: node_name
            }, {
                auth_token: auth_server.make_auth_token({
                    system_id: system_id,
                    role: 'admin'
                })
            })
            .tap(node => mongo_utils.fix_id_type(node));
    }

    delete_node_by_name(system_id, node_name) {
        if (!system_id) {
            dbg.error('read_node_by_name: expected system_id. node_name', node_name);
            throw new Error('read_node_by_name: expected system_id');
        }
        return server_rpc.client.node.delete_node({
            name: node_name
        }, {
            auth_token: auth_server.make_auth_token({
                system_id: system_id,
                role: 'admin'
            })
        });
    }

    allocate_nodes(system_id, pool_id) {
        if (!system_id) {
            dbg.error('allocate_nodes: expected system_id. pool_id', pool_id);
            throw new Error('allocate_nodes: expected system_id');
        }
        return P.resolve(server_rpc.client.node.allocate_nodes({
                pool_id: String(pool_id),
                fields: NODE_FIELDS_FOR_MAP
            }, {
                auth_token: auth_server.make_auth_token({
                    system_id: system_id,
                    role: 'admin'
                })
            }))
            .tap(res => mongo_utils.fix_id_type(res.nodes));
    }

    populate_nodes(system_id, docs, doc_path, fields) {
        const docs_list = docs && !_.isArray(docs) ? [docs] : docs;
        const ids = mongo_utils.uniq_ids(docs_list, doc_path);
        if (!ids.length) return P.resolve(docs);
        const params = {
            query: {
                nodes: _.map(ids, id => ({
                    id: String(id)
                }))
            }
        };
        if (fields) params.fields = fields;
        if (!system_id) {
            dbg.error('populate_nodes: expected system_id. docs', docs);
            throw new Error('populate_nodes: expected system_id');
        }
        return P.resolve()
            .then(() => server_rpc.client.node.list_nodes(params, {
                auth_token: auth_server.make_auth_token({
                    system_id: system_id,
                    role: 'admin'
                })
            }))
            .then(res => {
                const idmap = _.keyBy(res.nodes, '_id');
                _.each(docs_list, doc => {
                    const id = _.get(doc, doc_path);
                    const node = idmap[String(id)];
                    if (node) {
                        mongo_utils.fix_id_type(node);
                        _.set(doc, doc_path, node);
                    } else {
                        dbg.warn('populate_nodes: missing node for id',
                            id, 'DOC', doc, 'IDMAP', _.keys(idmap));
                    }
                });
                return docs;
            })
            .catch(err => {
                dbg.error('populate_nodes: ERROR', err.stack);
                throw err;
            });
    }

    populate_nodes_for_map(system_id, docs, doc_path) {
        return this.populate_nodes(system_id, docs, doc_path, NODE_FIELDS_FOR_MAP);
    }

    report_error_on_node_blocks(system_id, blocks_report) {

        // node_allocator keeps nodes in memory,
        // and in the write path it allocated a block on a node that failed to write
        // so we notify about the error to remove the node from next allocations
        // until it will refresh the alloc.
        _.each(blocks_report, block_report => {
            const node_id = block_report.block_md.node;
            node_allocator.report_error_on_node_alloc(node_id);
        });

        return server_rpc.client.node.report_error_on_node_blocks({
            blocks_report: blocks_report
        }, {
            auth_token: auth_server.make_auth_token({
                system_id: system_id,
                role: 'admin'
            })
        });
    }

    static instance() {
        if (!NodesClient._instance) {
            NodesClient._instance = new NodesClient();
        }
        return NodesClient._instance;
    }

}

exports.NodesClient = NodesClient;
exports.instance = NodesClient.instance;
