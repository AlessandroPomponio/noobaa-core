'use strict';

/**
 *
 * BUCKET API
 *
 * client (currently web client) talking to the web server to work on bucket
 *
 */
module.exports = {

    id: 'bucket_api',

    methods: {

        create_bucket: {
            method: 'POST',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    tiering: {
                        type: 'string',
                    },
                    tag: {
                        type: 'string',
                    },
                }
            },
            reply: {
                $ref: '#/definitions/bucket_info'
            },
            auth: {
                system: 'admin'
            }
        },

        read_bucket: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            reply: {
                $ref: '#/definitions/bucket_info'
            },
            auth: {
                system: 'admin'
            }
        },

        update_bucket: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    new_name: {
                        type: 'string',
                    },
                    tiering: {
                        type: 'string',
                    },
                    new_tag: {
                        type: 'string',
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        delete_bucket: {
            method: 'DELETE',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            auth: {
                system: 'admin'
            }
        },

        list_buckets: {
            method: 'GET',
            reply: {
                type: 'object',
                required: ['buckets'],
                properties: {
                    buckets: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['name'],
                            properties: {
                                name: {
                                    type: 'string'
                                },
                            }
                        }
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        list_bucket_s3_acl: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            },
            reply: {
                $ref: '#/definitions/bucket_s3_acl'
            },
            auth: {
                system: 'admin'
            }
        },

        update_bucket_s3_acl: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name', 'access_control'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    access_control: {
                        $ref: '#/definitions/bucket_s3_acl'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        get_cloud_sync: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            reply: {
                $ref: '#/definitions/cloud_sync_info'
            },
            auth: {
                system: 'admin'
            }
        },

        get_all_cloud_sync: {
            method: 'GET',
            reply: {
                type: 'array',
                items: {
                    $ref: '#/definitions/cloud_sync_info'
                }
            },
            auth: {
                system: 'admin'
            }
        },

        delete_cloud_sync: {
            method: 'DELETE',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        set_cloud_sync: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name', 'policy'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    connection: {
                        type: 'string'
                    },
                    target_bucket: {
                        type: 'string'
                    },
                    policy: {
                        $ref: '#/definitions/cloud_sync_policy'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        update_cloud_sync: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name', 'policy'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    policy: {
                        $ref: '#/definitions/cloud_sync_policy'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        toggle_cloud_sync: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name', 'pause'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    pause: {
                        type: 'boolean'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        // TODO Removed by request of Ohad, because seems like we won't be using it
        /*generate_bucket_access: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    }
                }
            },
            reply: {
                type: 'object',
                required: ['access_key', 'secret_key'],
                properties: {
                    access_key: {
                        type: 'string',
                    },
                    secret_key: {
                        type: 'string',
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },*/

        get_cloud_buckets: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['connection'],
                properties: {
                    connection: {
                        type: 'string'
                    }
                }
            },
            reply: {
                type: 'array',
                items: {
                    type: 'string'
                }
            },
            auth: {
                system: 'admin'
            }
        }

    },

    definitions: {

        bucket_info: {
            type: 'object',
            required: ['name', 'tiering', 'storage', 'num_objects'],
            properties: {
                name: {
                    type: 'string',
                },
                tiering: {
                    $ref: 'tiering_policy_api#/definitions/tiering_policy'
                },
                storage: {
                    $ref: 'common_api#/definitions/storage_info'
                },
                num_objects: {
                    type: 'integer'
                },
                cloud_sync: {
                    $ref: '#/definitions/cloud_sync_info'
                },
                tag: {
                    type: 'string'
                },
                demo_bucket: {
                    type: 'boolean'
                }
            }
        },

        cloud_sync_info: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                endpoint: {
                    type: 'string'
                },
                access_key: {
                    type: 'string'
                },
                target_bucket: {
                    type: 'string'
                },
                policy: {
                    $ref: '#/definitions/cloud_sync_policy'
                },
                health: {
                    type: 'boolean'
                },
                status: {
                    $ref: '#/definitions/api_cloud_sync_status'
                },
                last_sync: {
                    format: 'idate'
                }
            }
        },

        cloud_sync_policy: {
            type: 'object',
            required: ['schedule_min'],
            properties: {
                schedule_min: {
                    type: 'integer'
                },
                c2n_enabled: {
                    type: 'boolean',
                },
                n2c_enabled: {
                    type: 'boolean',
                },
                //If true, only additions will be synced
                additions_only: {
                    type: 'boolean',
                }
            }
        },

        bucket_s3_acl: {
            type: 'array',
            items: {
                type: 'object',
                required: ['account', 'is_allowed'],
                properties: {
                    account: {
                        type: 'string'
                    },
                    is_allowed: {
                        type: 'boolean'
                    }
                }
            }
        },

        api_cloud_sync_status: {
            enum: ['PENDING', 'SYNCING', 'PAUSED', 'UNABLE', 'SYNCED', 'NOTSET'],
            type: 'string',
        },

        sync_status_enum: {
            enum: ['IDLE', 'SYNCING'],
            type: 'string',
        },
    },
};
