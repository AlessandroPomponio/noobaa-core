'use strict';

/**
 *
 * CLUSTER INTERNAL API
 *
 * Cluster & HA
 *
 */
module.exports = {

    id: 'cluster_internal_api',

    methods: {
        join_to_cluster: {
            doc: 'direct current server to join to the cluster',
            method: 'POST',
            params: {
                type: 'object',
                required: ['topology', 'cluster_id', 'secret', 'role', 'shard'],
                properties: {
                    ip: {
                        type: 'string',
                    },
                    cluster_id: {
                        type: 'string'
                    },
                    secret: {
                        type: 'string'
                    },
                    role: {
                        $ref: 'cluster_server_api#/definitions/cluster_member_role'
                    },
                    shard: {
                        type: 'string',
                    },
                    location: {
                        type: 'string'
                    },
                    topology: {
                        type: 'object',
                        additionalProperties: true,
                        properties: {}
                    },
                }
            },
            auth: {
                system: false
            }
        },

        news_config_servers: {
            doc: 'published the config server IPs to the cluster',
            method: 'POST',
            params: {
                type: 'object',
                required: ['IPs', 'cluster_id'],
                properties: {
                    IPs: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                address: {
                                    type: 'string'
                                },
                            }
                        },
                    },
                    cluster_id: {
                        type: 'string'
                    },
                },
            },
            auth: {
                system: false
            }
        },

        redirect_to_cluster_master: {
            doc: 'redirect to master server to our knowledge',
            method: 'GET',
            reply: {
                type: 'string',
            },
            auth: {
                system: false
            }
        },

        news_updated_topology: {
            doc: 'published updated clustering topology info',
            method: 'POST',
            params: {
                type: 'object',
                additionalProperties: true,
                properties: {}
            },
            auth: {
                system: false
            }
        },

        news_replicaset_servers: {
            doc: 'published updated replica set clustering topology info',
            method: 'POST',
            params: {
                type: 'object',
                additionalProperties: true,
                properties: {}
            },
            auth: {
                system: false
            }
        },

        apply_updated_time_config: {
            method: 'POST',
            params: {
                $ref: '#/definitions/time_config'
            },
            auth: {
                system: false,
            }
        },

        apply_updated_dns_servers: {
            method: 'POST',
            params: {
                $ref: '#/definitions/dns_servers_config'
            },
            auth: {
                system: false,
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
                system: false,
            }
        },
    },

    definitions: {
        time_config: {
            type: 'object',
            required: ['config_type', 'timezone'],
            properties: {
                target_secret: {
                    type: 'string'
                },
                config_type: {
                    $ref: '#/definitions/time_config_type'
                },
                timezone: {
                    type: 'string'
                },
                server: {
                    type: 'string'
                },
                epoch: {
                    type: 'number'
                },
            },
        },

        dns_servers_config: {
            type: 'object',
            required: ['dns_servers'],
            properties: {
                target_secret: {
                    type: 'string'
                },
                dns_servers: {
                    type: 'array',
                    items: {
                        type: 'string'
                    },
                }
            },
        },

        time_config_type: {
            enum: ['NTP', 'MANUAL'],
            type: 'string',
        }
    },
};
