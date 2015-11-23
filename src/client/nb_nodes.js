/* global angular */
'use strict';

var _ = require('lodash');
var P = require('../util/promise');
var moment = require('moment');
var chance = require('chance')();
var promise_utils = require('../util/promise_utils');
var config = require('../../config');
var dbg = require('../util/debug_module')(__filename);

var nb_api = angular.module('nb_api');

nb_api.factory('nbNodes', [
    '$q', '$timeout', 'nbGoogle', '$window', '$rootScope',
    '$location', 'nbAlertify', 'nbModal', 'nbClient', 'nbSystem',
    function($q, $timeout, nbGoogle, $window, $rootScope,
        $location, nbAlertify, nbModal, nbClient, nbSystem) {
        var $scope = {};
        $scope.refresh_node_groups = refresh_node_groups;
        $scope.draw_nodes_map = draw_nodes_map;
        $scope.list_nodes = list_nodes;
        $scope.read_node = read_node;
        $scope.goto_node_by_block = goto_node_by_block;
        $scope.reconnect_node = reconnect_node;
        $scope.disable_node = disable_node;
        $scope.decommission_node = decommission_node;
        $scope.remove_node = remove_node;
        $scope.add_node = add_node;
        $scope.self_test = self_test;
        $scope.diagnose_node = diagnose_node;
        $scope.set_debug_node = set_debug_node;


        function refresh_node_groups(selected_geo) {
            return $q.when()
                .then(function() {
                    return nbClient.client.node.group_nodes({
                        group_by: {
                            geolocation: true
                        }
                    });
                })
                .then(function(res) {
                    console.log('NODE GROUPS', res);
                    $scope.node_groups = res.groups;
                    $scope.node_groups_by_geo = _.indexBy(res.groups, 'geolocation');
                    $scope.nodes_count = _.reduce(res.groups, function(sum, g) {
                        return sum + g.count;
                    }, 0);
                    if (res.groups.length) {
                        $scope.has_nodes = true;
                        $scope.has_no_nodes = false;
                    } else {
                        $scope.has_nodes = false;
                        $scope.has_no_nodes = true;
                    }
                    return draw_nodes_map(selected_geo);
                });
        }

        function list_nodes(params) {
            return $q.when()
                .then(function() {
                    return nbClient.client.node.list_nodes(params);
                })
                .then(function(res) {
                    console.log('NODES', res);
                    var nodes = res.nodes;
                    _.each(nodes, extend_node_info);
                    return res;
                });
        }

        function read_node(name) {
            return $q.when()
                .then(function() {
                    return nbClient.client.node.read_node({
                        name: name
                    });
                })
                .then(function(res) {
                    console.log('READ NODE', res);
                    var node = res;
                    extend_node_info(node);
                    return node;
                });
        }

        function goto_node_by_block(block) {
            var path = '/tier/' + block.adminfo.tier_name + '/' + block.adminfo.node_name;
            console.log('goto', path);
            $location.path(path);
            $location.hash('');
        }

        function extend_node_info(node) {
            node.hearbeat_moment = moment(new Date(node.heartbeat));
            if (node.os_info) {
                node.os_info.uptime_moment = moment(new Date(node.os_info.uptime));
                var cpus = _.countBy(node.os_info.cpus, 'model');
                node.os_info.cpus_str = _.map(cpus,
                    function(count, model) {
                        return count + 'x  ' + model;
                    }).join(', ');
                node.os_info.addresses = [];
                node.os_info.addresses6 = [];
                _.each(node.os_info.networkInterfaces,
                    function(ifc, name) {
                        _.each(ifc, function(addr) {
                            addr = _.extend({
                                name: name
                            }, addr);
                            if (addr.family === 'IPv4') {
                                node.os_info.addresses.push(addr);
                            } else {
                                node.os_info.addresses6.push(addr);
                            }
                        });
                    });
                node.os_info.loadavg_str = _.map(node.os_info.loadavg,
                    function(x) {
                        return x.toFixed(1);
                    }).join(' ');
            }
            extend_storage_info(node.storage);
            _.each(node.drives, function(drive) {
                extend_storage_info(drive.storage);
            });
        }

        function extend_storage_info(storage) {
            // allowing used to be undefined
            var used = storage.used || 0;
            storage.used_os = storage.total - used - storage.free;
            storage.used_percent = 100 * used / storage.total;
            storage.used_os_percent = 100 * storage.used_os / storage.total;
            storage.free_percent = 100 * storage.free / storage.total;
        }

        function update_srvmode(node, srvmode) {
            return $q.when()
                .then(function() {
                    return nbClient.client.node.update_node({
                        name: node.name,
                        srvmode: srvmode
                    });
                });
        }

        function reconnect_node(node) {
            return update_srvmode(node, 'connect')
                .then(function() {
                    delete node.srvmode;
                });
        }

        function disable_node(node) {
            return update_srvmode(node, 'disabled')
                .then(function() {
                    node.srvmode = 'disabled';
                });
        }

        function decommission_node(node) {
            return update_srvmode(node, 'decommissioning')
                .then(function() {
                    node.srvmode = 'decommissioning';
                });
        }

        function remove_node(node) {
            return nbAlertify.confirm('Really remove node ' +
                node.name + ' @ ' + node.geolocation + ' ?').then(
                function() {
                    return $q.when(nbClient.client.node.delete_node({
                        name: node.name
                    })).then(refresh_node_groups);
                }
            );
        }

        function add_node() {
            var scope = $rootScope.$new();

            scope.$location = $location;
            scope.stage = 1;
            var config_json = {
                dbg_log_level: 2,
                tier: 'nodes',
                prod: true,
                bucket: 'files',
                root_path: './agent_storage/',
                port: 8888,
                secure_port: 9999
            };

            config_json.address = 'wss://noobaa.local:' + nbSystem.system.ssl_port;
            config_json.system = nbSystem.system.name;
            config_json.access_key = nbSystem.system.access_keys[0].access_key;
            config_json.secret_key = nbSystem.system.access_keys[0].secret_key;
            var encodedData = $window.btoa(JSON.stringify(config_json));
            scope.encodedData = encodedData;
            var secured_host = ($window.location.host).replace(':' + nbSystem.system.web_port, ':' + nbSystem.system.ssl_port);
            config_json.address = 'wss://' + secured_host;
            encodedData = $window.btoa(JSON.stringify(config_json));
            scope.encodedDataIP = encodedData;
            scope.current_host = $window.location.host;
            scope.typeOptions = [{
                name: 'Use custom DNS',
                value: ''
            }, {
                name: 'Use ' + secured_host,
                value: scope.encodedDataIP
            }, ];
            console.log('type options', scope.typeOptions);
            scope.encoding = {
                type: scope.typeOptions[0].value,
                new_dns: '',
                show_other_dns: true
            };

            console.log(JSON.stringify(config_json), String.toString(config_json), 'encoded', encodedData);

            scope.dns_select = function(selected_value) {
                if (scope.typeOptions[1].value !== selected_value) {
                    scope.encoding.show_other_dns = true;
                } else {
                    scope.encoding.show_other_dns = false;
                }
            };
            scope.new_dns = function() {
                config_json.address = 'wss://' + scope.encoding.new_dns + ':' + nbSystem.system.ssl_port;
                encodedData = $window.btoa(JSON.stringify(config_json));
                scope.typeOptions[0].value = encodedData;
                scope.encoding.type = scope.typeOptions[0].value;
            };
            scope.next_stage = function() {
                scope.stage += 1;
                if (scope.stage > 4) {
                    scope.modal.modal('hide');
                }
            };
            scope.prev_stage = function() {
                scope.stage -= 1;
                if (scope.stage < 1) {
                    scope.stage = 1;
                }
            };
            scope.goto_nodes_list = function() {
                scope.modal.modal('hide');
                scope.modal.on('hidden.bs.modal', function() {
                    $timeout(function() {
                        $location.path('/tier/' + nbSystem.system.tiers[0].name);
                        $location.hash('nodes');
                        console.log('$location', $location.absUrl());
                    }, 1);
                });
            };
            scope.download_agent = function() {
                var link;
                return nbSystem.get_agent_installer()
                    .then(function(url) {
                        link = $window.document.createElement("a");
                        link.download = '';
                        link.href = url;
                        $window.document.body.appendChild(link);
                        link.click();
                        return P.delay(2000);
                    }).then(function() {
                        $window.document.body.removeChild(link);
                        scope.next_stage();
                    });
            };
            scope.download_linux_agent = function() {
                var link;
                return nbSystem.get_linux_agent_installer()
                    .then(function(url) {
                        link = $window.document.createElement("a");
                        link.download = '';
                        link.href = url;
                        $window.document.body.appendChild(link);
                        link.click();
                        return P.delay(2000);
                    }).then(function() {
                        $window.document.body.removeChild(link);
                        scope.next_stage();
                    });
            };

            scope.copy_to_clipboard = function() {
                var copyFrom = $window.document.getElementById('copy-text-area');
                var selection = $window.getSelection();
                selection.removeAllRanges();
                var range = $window.document.createRange();
                range.selectNodeContents(copyFrom);
                selection.addRange(range);
                try {
                    var success = $window.document.execCommand('copy', false, null);
                    if (success) {
                        nbAlertify.success('Agent configuration copied to clipboard');
                    } else {
                        nbAlertify.error('Cannot copy agent configuration to clipboard, please copy manually');
                    }
                    selection.removeAllRanges();
                } catch (err) {
                    console.error('err while copy', err);
                    nbAlertify.error('Cannot copy agent configuration to clipboard, please copy manually');
                }
            };
            scope.modal = nbModal({
                template: 'console/add_node_dialog.html',
                scope: scope,
            });
        }

        function self_test(node, kind) {
            var had_error = false;
            var online_nodes;
            $scope.self_test_results = [];

            function define_phase(test) {
                if (_.contains(test.kind, kind)) {
                    $scope.self_test_results.push(test);
                }
            }

            function run_phases() {
                return promise_utils.iterate($scope.self_test_results, run_phase);
            }

            function run_phase(test) {
                dbg.log0('SELF TEST running phase:', test.name);
                test.start = Date.now();
                $rootScope.safe_apply();

                return P.fcall(test.func.bind(test))
                    .then(function(res) {
                        test.done = true;
                        test.took = (Date.now() - test.start) / 1000;
                        dbg.log0('SELF TEST completed phase', test.name, 'took', test.took, 'sec');
                        $rootScope.safe_apply();
                    }, function(err) {
                        dbg.log0('SELF TEST failed phase', test.name, err.stack || err);
                        test.error = err;
                        // mark and swallow errors to run next tests
                        had_error = true;
                        $rootScope.safe_apply();
                    }, function(progress) {
                        test.progress = progress;
                        $rootScope.safe_apply();
                    });
            }

            return $q.when()
                .then(function() {
                    dbg.log0('SELF TEST listing nodes');
                    return list_nodes({})
                        .then(function(res) {
                            var nodes = res.nodes;
                            online_nodes = _.filter(nodes, function(target_node) {
                                if (target_node.online) return true;
                                dbg.log0('SELF TEST filter offline node', target_node.name);
                            });
                            dbg.log0('SELF TEST got', online_nodes.length,
                                'online nodes out of', nodes.length, 'total nodes');
                            if (online_nodes.length < config.min_node_number) {
                                nbAlertify.error('Not enough online nodes');
                                throw new Error('Not enough online nodes');
                            }
                        });
                })
                .then(function() {
                    /*
                    define_phase({
                        name: 'write 0.5 MB from browser to ' + node.name,
                        kind: ['full', 'rw'],
                        func: function() {
                            return self_test_io(node, 0.5 * 1024 * 1024, 0);
                        }
                    });
                    define_phase({
                        name: 'read 0.5 MB from ' + node.name + ' to browser',
                        kind: ['full', 'rw'],
                        func: function() {
                            return self_test_io(node, 0, 0.5 * 1024 * 1024);
                        }
                    });
                    define_phase({
                        name: 'write 3 MB from browser to ' + node.name,
                        kind: ['full', 'rw'],
                        func: function() {
                            return self_test_io(node, 3 * 1024 * 1024, 0);
                        }
                    });
                    define_phase({
                        name: 'read 3 MB from ' + node.name + ' to browser',
                        kind: ['full', 'rw'],
                        func: function() {
                            return self_test_io(node, 0, 3 * 1024 * 1024);
                        }
                    });
                    define_phase({
                        name: 'connect from browser to test agent',
                        kind: ['full', 'conn'],
                        func: function() {
                            return self_test_io(node);
                        }
                    });
                    _.each(online_nodes, function(target_node) {
                        define_phase({
                            name: 'connect from browser to ' + target_node.name,
                            kind: ['full', 'conn'],
                            func: function() {
                                return self_test_io(target_node);
                            }
                        });
                    });
                    */
                    _.each(online_nodes, function(target_node) {
                        define_phase({
                            name: 'connect from ' + node.name + ' to ' + target_node.name,
                            kind: ['full', 'conn'],
                            func: function() {
                                return self_test_to_node_via_web(node, target_node);
                            }
                        });
                    });

                    define_phase({
                        name: 'LOAD WRITE: connect from all to one node and send 0.5MB (10 times from each)',
                        kind: ['full', 'load'],
                        total: 0,
                        position: 0,
                        func: function(target_node) {
                            var self = this;
                            var advance_pos = function() {
                                self.position += 1;
                                self.progress = (100 * (self.position / self.total)).toFixed(0) + '%';
                                $rootScope.safe_apply();
                            };
                            return P.all(_.map(online_nodes, function(target_node) {
                                self.total += 10;
                                return promise_utils.loop(10, function() {
                                    return self_test_to_node_via_web(
                                            target_node, node, 0, 512 * 1024)
                                        .then(advance_pos);
                                });
                            }));
                        }
                    });

                    define_phase({
                        name: 'LOAD READ: connect from all to one node and read 0.5MB (10 times from each)',
                        kind: ['full', 'load'],
                        total: 0,
                        position: 0,
                        func: function(target_node) {
                            var self = this;
                            var advance_pos = function() {
                                self.position += 1;
                                self.progress = (100 * (self.position / self.total)).toFixed(0) + '%';
                                $rootScope.safe_apply();
                            };
                            return P.all(_.map(online_nodes, function(target_node) {
                                self.total += 10;
                                return promise_utils.loop(10, function() {
                                    return self_test_to_node_via_web(
                                            target_node, node, 512 * 1024, 0)
                                        .then(advance_pos);
                                });
                            }));
                        }
                    });

                    define_phase({
                        name: 'transfer 100 MB between ' + node.name + ' and the other nodes',
                        kind: ['full', 'tx'],
                        total: 100 * 1024 * 1024,
                        position: 0,
                        func: function() {
                            var self = this;
                            if (self.position >= self.total) return;
                            var target_node = chance.pick(online_nodes);
                            return self_test_to_node_via_web(
                                    target_node, node, 512 * 1024, 512 * 1024)
                                .then(function() {
                                    self.position += 1024 * 1024;
                                    self.progress = (100 * (self.position / self.total)).toFixed(0) + '%';
                                    $rootScope.safe_apply();
                                    return self.func();
                                });
                        }
                    });

                    /*
                    define_phase({
                        name: 'transfer 100 MB between browser and ' + node.name,
                        kind: ['full', 'tx'],
                        total: 100 * 1024 * 1024,
                        position: 0,
                        func: function() {
                            var self = this;
                            if (self.position >= self.total) return;
                            return self_test_io(node, 512 * 1024, 512 * 1024)
                                .then(function() {
                                    self.position += 1024 * 1024;
                                    self.progress = (100 * (self.position / self.total)).toFixed(0) + '%';
                                    $rootScope.safe_apply();
                                    return self.func();
                                });
                        }
                    });
                    */

                    return run_phases();
                })
                .then(function() {
                    if (had_error) throw new Error('had_error');
                    nbAlertify.log('Self test completed :)');
                })
                .then(null, function(err) {
                    nbAlertify.error('Self test had errors :(');
                });
        }

        function diagnose_node(node) {
            var link;

            return $q.when(nbClient.client.node.collect_agent_diagnostics({
                    target: node.rpc_address,
                }))
                .then(function(url) {
                    if (url !== '') {
                        link = $window.document.createElement("a");
                        link.download = '';
                        link.href = url;
                        $window.document.body.appendChild(link);
                        link.click();
                        return P.delay(2000);
                    }
                })
                .then(function() {
                    $window.document.body.removeChild(link);
                })
                .then(null, function(err) {
                    dbg.log0('Diagnose node encountered errors', err, err.stack);
                    nbAlertify.error('Diagnose node encountered errors');
                });
        }

        function set_debug_node(node) {
            var link;

            return $q.when(nbClient.client.node.set_debug_node({
                    target: node.rpc_address,
                }))
                .then(function() {
                    $window.document.body.removeChild(link);
                })
                .then(function() {
                    nbAlertify.success('Collecting Debug Information');
                })
                .then(null, function(err) {
                    dbg.log0('Setting Node Debug collection encountered errors', err, err.stack);
                    nbAlertify.error('Setting Node Debug collection encountered errors');
                });
        }

        /*
        function self_test_io(node, request_length, response_length) {
            return nbClient.client.agent.self_test_io({
                data: new Buffer(request_length || 0),
                response_length: response_length || 0,
            }, {
                address: node.rpc_address,
            });
        }

        function self_test_to_node(node, target_node, request_length, response_length) {
            console.log('SELF TEST', node.name, 'to', target_node.name);

            return nbClient.client.agent.self_test_peer({
                target: target_node.rpc_address,
                request_length: request_length || 0,
                response_length: response_length || 0,
            }, {
                address: node.rpc_address,
            });
        }
        */

        function self_test_to_node_via_web(node, target_node, request_length, response_length) {
            console.log('SELF TEST', node.name, 'to', target_node.name);

            return nbClient.client.node.self_test_to_node_via_web({
                target: target_node.rpc_address,
                source: node.rpc_address,
                request_length: request_length || 0,
                response_length: response_length || 0,
            });
        }


        function draw_nodes_map(selected_geo, google) {
            if (!google) {
                return nbGoogle.then(function(google) {
                    return draw_nodes_map(selected_geo, google);
                });
            }
            var element = $window.document.getElementById('nodes_map');
            if (!element) {
                return;
            }
            var min_alloc = Infinity;
            var max_alloc = -Infinity;
            var min_num_nodes = Infinity;
            var max_num_nodes = -Infinity;
            var data = new google.visualization.DataTable();
            data.addColumn('string', 'Location');
            data.addColumn('number', 'Nodes');
            data.addColumn('number', 'Capacity');
            var selected_row = -1;
            _.each($scope.node_groups, function(stat, index) {
                if (stat.geolocation === selected_geo) {
                    selected_row = index;
                }
                if (stat.storage.alloc > max_alloc) {
                    max_alloc = stat.storage.alloc;
                }
                if (stat.storage.alloc < min_alloc) {
                    min_alloc = stat.storage.alloc;
                }
                if (stat.online > max_num_nodes) {
                    max_num_nodes = stat.online;
                }
                if (stat.online < min_num_nodes) {
                    min_num_nodes = stat.online;
                }
                data.addRow([stat.geolocation, {
                    v: stat.count ? (100 * stat.online / stat.count) : 0,
                    f: stat.online + ' online, ' + (stat.count - stat.online) + ' offline'
                }, {
                    v: stat.storage.alloc,
                    f: $rootScope.human_size(stat.storage.alloc)
                }]);
                console.log(stat, min_alloc, max_alloc, min_num_nodes, max_num_nodes);
            });
            var options = {
                displayMode: 'markers',
                enableRegionInteractivity: true,
                keepAspectRatio: true,
                backgroundColor: 'transparent',
                datalessRegionColor: '#242c33', // darker than body bg
                colorAxis: {
                    colors: ['#888888', '#F500FF'], // gray to pink-purple
                    minValue: 0,
                    maxValue: 100,
                },
                sizeAxis: {
                    minSize: 5,
                    maxSize: 9,
                    minValue: min_alloc,
                    maxValue: max_alloc,
                },
                legend: 'none' || {
                    textStyle: {
                        color: 'black',
                        fontSize: 16
                    }
                },
                magnifyingGlass: {
                    enable: false,
                    zoomFactor: 10
                },
                tooltip: {
                    trigger: 'both' // 'focus' / 'selection'
                },
            };
            var chart = new google.visualization.GeoChart(element);
            google.visualization.events.addListener(chart, 'ready', function() {
                if (selected_row >= 0) {
                    chart.setSelection([{
                        row: selected_row,
                        column: null,
                    }]);
                }
            });
            google.visualization.events.addListener(chart, 'select', function() {
                var selection = chart.getSelection();
                if (selection[0]) {
                    var geo = data.getValue(selection[0].row, 0);
                    $location.path('/tier/' + nbSystem.system.tiers[0].name);
                    $location.hash('nodes&geo=' + geo);
                }
                $rootScope.safe_apply();
            });
            chart.draw(data, options);
        }

        return $scope;
    }
]);
