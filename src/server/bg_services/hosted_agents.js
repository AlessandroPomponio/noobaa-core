'use strict';

const _ = require('lodash');
const child_process = require('child_process');
const dbg = require('../../util/debug_module')(__filename);
const supervisor = require('../utils/supervisor_ctrl.js');
const os_utils = require('../../util/os_utils');


let spawned_hosted_agents = {};

function create_agent(req) {
    let port = process.env.SSL_PORT || 5443;
    let args = ['--address', 'wss://127.0.0.1:' + port, '--node_name', req.params.name];

    if (req.params.demo) {
        args.push('--demo');
    }

    if (req.params.scale) {
        // regular agents
        args = args.concat(['--scale', req.params.scale.toString()]);
    }

    if (req.params.cloud_info) {
        // cloud agents
        args = args.concat([
            '--cloud_endpoint', req.params.cloud_info.endpoint,
            '--cloud_bucket', req.params.cloud_info.target_bucket,
            '--cloud_access_key', req.params.cloud_info.access_keys.access_key,
            '--cloud_secret_key', req.params.cloud_info.access_keys.secret_key
        ]);
    }

    if (req.params.storage_limit) {
        args = args.concat(['--storage_limit', req.params.storage_limit.toString()]);
    }

    if (req.params.access_keys) {
        args = args.concat([
            '--access_key', req.params.access_keys.access_key,
            '--secret_key', req.params.access_keys.secret_key
        ]);
    }

    if (os_utils.is_supervised_env()) {
        return supervisor.remove_program('agent_' + req.params.name).then(() => {
            dbg.log0('adding agent to supervior with arguments:', _.join(args, ' '));
            return supervisor.add_agent(req.params.name, _.join(args, ' '));
        });
    } else {
        args.splice(0, 0, 'src/agent/agent_cli.js');
        dbg.log0('executing: node', _.join(args, ' '));
        let child = child_process.spawn('node', args, {
            stdio: 'inherit'
        });
        spawned_hosted_agents[req.params.name] = child;
        dbg.log0('spawned process. pid =', child.pid);
    }
}


function remove_agent(req) {
    if (os_utils.is_supervised_env()) {
        dbg.log0('removing agent from supervisor configuration', req.params.name);
        return supervisor.remove_program(req.params.name)
            .then(() => supervisor.apply_changes());
    } else {
        dbg.log0('looking for child process of', req.params.name);
        let child = spawned_hosted_agents[req.params.name];
        if (child) {
            dbg.log0('killing agent', req.params.name, 'PID=', child.pid, ')');
            child.kill('SIGKILL');
            delete spawned_hosted_agents[req.params.name];
        }

    }
}
// EXPORTS
exports.create_agent = create_agent;
exports.remove_agent = remove_agent;
