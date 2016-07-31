'use strict';

const system_store = require('../system_services/system_store').get_instance();
const promise_utils = require('../../util/promise_utils');
const config = require('../../../config.js');
const dbg = require('../../util/debug_module')(__filename);
const MongoCtrl = require('../utils/mongo_ctrl');
const bg_workers_starter = require('../../bg_workers/bg_workers_starter');
const server_rpc = require('../server_rpc');
const P = require('../../util/promise');
var is_cluster_master = false;

exports.background_worker = background_worker;

function background_worker() {
    if (!system_store.is_finished_initial_load) {
        dbg.log0('System did not finish initial load');
        return;
    }

    let current_clustering = system_store.get_local_cluster_info();
    if (current_clustering && current_clustering.is_clusterized) {
        // TODO: Currently checks the replica set master since we don't have shards
        // We always need to send so the webserver will be updated if the
        return MongoCtrl.is_master()
            .then((is_master) => {
                if (!is_master.ismaster && is_cluster_master) {
                    bg_workers_starter.remove_master_workers();
                } else if (is_master.ismaster && !is_cluster_master) {
                    // Used in order to disable race condition on master switch
                    promise_utils.delay_unblocking(config.CLUSTER_MASTER_INTERVAL)
                        .then(() => {
                            // Need to run the workers only if the server still master
                            if (system_store.is_cluster_master) {
                                return bg_workers_starter.run_master_workers();
                            }
                        });
                }
                is_cluster_master = is_master.ismaster;
                return send_master_update(is_cluster_master);
            })
            .catch((err) => {
                is_cluster_master = false;
                bg_workers_starter.remove_master_workers();
                return send_master_update(is_cluster_master);
            });
    } else if (!is_cluster_master) {
        dbg.log0('no local cluster info or server is not part of a cluster. therefore will be cluster master');
        return send_master_update(true).then(() => {
            bg_workers_starter.run_master_workers();
            is_cluster_master = true;
        });
    }
}

function send_master_update(is_master) {
    return P.fcall(() => {
            if (!server_rpc.client.options.auth_token) {
                let system = system_store.data.systems[0];
                let auth_params = {
                    email: 'support@noobaa.com',
                    password: 'help',
                    system: system.name,
                };
                return server_rpc.client.create_auth_token(auth_params);
            }
            return;
        })
        .then(() => {
            return server_rpc.client.system.set_webserver_master_state({
                is_master: is_master
            });
        })
        .return();
}
