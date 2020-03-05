/* Copyright (C) 2016 NooBaa */

export default {
    type: 'object',
    additionalProperties: {
        type: 'object',
        required: [
            'name',
            'creationTime',
            'mode',
            'isManaged',
            'activities',
            'associatedAccounts',
            'hostCount',
            'hostsByMode',
            'configuredHostCount',
            'storageNodeCount',
            'storageNodesByMode',
            'endpointNodeCount',
            'endpointNodesByMode',
            'storage'
        ],
        properties: {
            name: {
                type: 'string'
            },
            creationTime: {
                type: 'integer'
            },
            mode: {
                type: 'string',
                enum: [
                    'BEING_CREATED',
                    'INITIALIZING',
                    'INITIALIZING_FAILED',
                    'DELETING',
                    'HAS_NO_NODES',
                    'SCALING',
                    'ALL_NODES_OFFLINE',
                    'NO_CAPACITY',
                    'ALL_HOSTS_IN_PROCESS',
                    'MOST_NODES_ISSUES',
                    'MANY_NODES_ISSUES',
                    'MOST_STORAGE_ISSUES',
                    'MANY_STORAGE_ISSUES',
                    'MOST_S3_ISSUES',
                    'MANY_S3_ISSUES',
                    'MANY_NODES_OFFLINE',
                    'LOW_CAPACITY',
                    'HIGH_DATA_ACTIVITY',
                    'IO_ERRORS',
                    'STORAGE_NOT_EXIST',
                    'AUTH_FAILED',
                    'OPTIMAL'
                ]
            },
            isManaged: {
                type: 'boolean'
            },
            activities: {
                type: 'object',
                required: [
                    'hostCount',
                    'list'
                ],
                properties: {
                    hostCount: {
                        type: 'integer'
                    },
                    list: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: [
                                'kind',
                                'nodeCount'
                            ],
                            properties: {
                                kind: {
                                    type: 'string',
                                    enum: [
                                        'RESTORING',
                                        'MIGRATING',
                                        'DECOMMISSIONING',
                                        'DELETING'
                                    ]
                                },
                                nodeCount: {
                                    type: 'integer'
                                },
                                progress: {
                                    type: 'number',
                                    minimum: 0,
                                    maximum: 1
                                },
                                eta: {
                                    type: 'integer'
                                }
                            }
                        }
                    }
                }
            },
            associatedAccounts: {
                type: 'array',
                items: {
                    type: 'string'
                }
            },
            hostCount: {
                type: 'integer'
            },
            hostsByMode: {
                type: 'object',
                additionalProperties: {
                    type: 'integer'
                }
            },
            configuredHostCount: {
                type: 'integer'
            },
            storageNodeCount: {
                type: 'integer'
            },
            storageNodesByMode: {
                type: 'object',
                additionalProperties: {
                    type: 'integer'
                }
            },
            endpointNodeCount: {
                type: 'integer'
            },
            endpointNodesByMode: {
                type: 'object',
                additionalProperties: {
                    type: 'integer'
                }
            },
            storage: {
                $ref: '#/def/common/storage'
            },
            region: {
                type: 'string'
            },
            undeletable: {
                type: 'string',
                enum: [
                    'SYSTEM_ENTITY',
                    'NOT_EMPTY',
                    'IN_USE',
                    'DEFAULT_RESOURCE',
                    'BEING_DELETED',
                    'CONNECTED_BUCKET_DELETING',
                    'IS_BACKINGSTORE'
                ]
            },
            hostConfig: {
                type: 'object',
                required: [
                    'volumeSize'
                ],
                properties: {
                    volumeSize: {
                        $ref: '#/def/common/size'
                    }
                }
            }
        }
    }
};
