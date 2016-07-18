'use strict';

/**
 *
 * CLUSTER SERVER API
 *
 * Cluster & HA
 *
 */
module.exports = {

    id: 'cluster_server_api',

    methods: {
        add_member_to_cluster: {
            doc: 'Add new member to the cluster',
            method: 'POST',
            params: {
                type: 'object',
                required: ['address', 'secret', 'role', 'shard'],
                properties: {
                    address: {
                        type: 'string',
                    },
                    secret: {
                        type: 'string'
                    },
                    role: {
                        $ref: '#/definitions/cluster_member_role'
                    },
                    shard: {
                        type: 'string'
                    },
                    location: {
                        type: 'string'
                    }
                },
            },
            auth: {
                system: 'admin'
            }
        },

        update_server_location: {
            doc: 'Add new member to the cluster',
            method: 'POST',
            params: {
                type: 'object',
                required: ['secret', 'location'],
                properties: {
                    secret: {
                        type: 'string',
                    },
                    location: {
                        type: 'string'
                    }
                },
            },
            auth: {
                system: 'admin',
            }
        },

        update_time_config: {
            method: 'POST',
            params: {
                $ref: 'cluster_internal_api#/definitions/time_config'
            },
            auth: {
                system: 'admin',
            }
        },

        update_dns_servers: {
            method: 'POST',
            params: {
                $ref: 'cluster_internal_api#/definitions/dns_servers_config'
            },
            auth: {
                system: 'admin',
            }
        },

        read_server_time: {
            method: 'POST',
            params: {
                type: 'object',
                required: ['target_secret'],
                properties: {
                    target_secret: {
                        type: 'string',
                    }
                },
            },
            reply: {
                format: 'idate',
            },
            auth: {
                system: 'admin',
            }
        },
    },

    definitions: {
        cluster_member_role: {
            enum: ['SHARD', 'REPLICA'],
            type: 'string',
        },
    },
};
